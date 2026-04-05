/**
 * 批量任务状态查询 API
 *
 * 功能：
 * 1. 查询批量任务的整体状态
 * 2. 获取所有子任务的状态
 * 3. 支持分页查询
 */

import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { logger } from '@/lib/logger';

// ===== Redis 配置 =====

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

function getRedisConfig() {
  return {
    host: process.env.REDIS_URL?.split('://')[1].split(':')[0] || 'localhost',
    port: Number(process.env.REDIS_URL?.split(':')[2].split('/')[0]) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB) || 0,
    maxRetriesPerRequest: null,
    // 增加重连保护
    enableReadyCheck: true,
  }
}
// 获取队列
function getReportQueue(): Queue {
  const redisConfig = getRedisConfig();
  return new Queue('report', { connection: redisConfig });
}

// ===== 类型定义 =====

export interface BatchStatusResponse {
  batchId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalTasks: number;
  tasks: TaskStatus[];
  createdAt: number;
}

export interface TaskStatus {
  taskId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

// ===== GET /api/batch/:batchId =====

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    if (!batchId) {
      return NextResponse.json(
        { error: 'batchId is required' },
        { status: 400 }
      );
    }

    const queue = getReportQueue();

    // 获取批量任务的所有子任务
    // 任务 ID 格式: batchId-0, batchId-1, ...
    const jobIds: string[] = [];
    let index = 0;
    while (index < 100) { // 最多检查 100 个任务
      const jobId = `${batchId}-${index}`;
      const job = await queue.getJob(jobId);
      if (job) {
        jobIds.push(jobId);
        index++;
      } else {
        break; // 没有更多的任务了
      }
    }

    if (jobIds.length === 0) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // 批量获取任务状态
    const tasks: TaskStatus[] = [];
    let completedCount = 0;
    let failedCount = 0;
    let totalCount = jobIds.length;
    let batchStatus: BatchStatusResponse['status'] = 'pending';

    // 分页
    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, jobIds.length);

    for (let i = startIndex; i < endIndex; i++) {
      const jobId = jobIds[i];
      const job = await queue.getJob(jobId);

      if (job) {
        const state = await job.getState();
        const progress = job.progress;

        if (state === 'completed') {
          completedCount++;
        } else if (state === 'failed') {
          failedCount++;
        }

        tasks.push({
          taskId: jobId,
          status: state as TaskStatus['status'],
          progress: typeof progress === 'number' ? progress : undefined,
          error: job.failedReason,
        });
      }
    }

    // 确定批量任务状态
    const allChecked = await Promise.all(
      jobIds.map(async (jobId) => {
        const job = await queue.getJob(jobId);
        if (!job) return null;
        return await job.getState();
      })
    );

    const hasPending = allChecked.some(s => s === 'waiting' || s === 'active');
    const hasProcessing = allChecked.some(s => s === 'active');

    if (hasPending || hasProcessing) {
      batchStatus = 'running';
    } else if (failedCount > 0) {
      batchStatus = 'failed';
    } else {
      batchStatus = 'completed';
    }

    // 获取第一个任务的时间作为创建时间
    const firstJob = await queue.getJob(jobIds[0]);

    return NextResponse.json({
      batchId,
      status: batchStatus,
      totalTasks: totalCount,
      tasks,
      completedTasks: completedCount,
      failedTasks: failedCount,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        hasMore: endIndex < totalCount,
      },
      createdAt: firstJob?.timestamp || Date.now(),
    } as BatchStatusResponse & { completedTasks: number; failedTasks: number; pagination: any });

  } catch (error) {
    logger.error({ error }, '[Batch API] 查询批量任务状态失败');
    return NextResponse.json(
      { error: 'Failed to get batch status' },
      { status: 500 }
    );
  }
}

// ===== DELETE /api/batch/:batchId (取消批量任务) =====

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    if (!batchId) {
      return NextResponse.json(
        { error: 'batchId is required' },
        { status: 400 }
      );
    }

    const queue = getReportQueue();

    // 获取批量任务的所有子任务
    const jobIds: string[] = [];
    let index = 0;
    while (index < 100) {
      const jobId = `${batchId}-${index}`;
      const job = await queue.getJob(jobId);
      if (job) {
        jobIds.push(jobId);
        index++;
      } else {
        break;
      }
    }

    if (jobIds.length === 0) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // 取消所有任务
    const cancelledTasks: string[] = [];
    const failedTasks: string[] = [];

    for (const jobId of jobIds) {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'waiting') {
          await job.remove();
          cancelledTasks.push(jobId);
        } else {
          failedTasks.push(jobId);
        }
      }
    }

    logger.info(
      { batchId, cancelledCount: cancelledTasks.length, failedCount: failedTasks.length },
      '[Batch API] 批量任务已取消'
    );

    return NextResponse.json({
      batchId,
      status: 'cancelled',
      cancelledTasks,
      failedTasks,
      message: `Cancelled ${cancelledTasks.length} tasks, ${failedTasks.length} tasks could not be cancelled`,
    });

  } catch (error) {
    logger.error({ error }, '[Batch API] 取消批量任务失败');
    return NextResponse.json(
      { error: 'Failed to cancel batch' },
      { status: 500 }
    );
  }
}
