/**
 * 任务状态查询 API
 *
 * 功能：
 * 1. 查询单个任务的状态
 * 2. 获取任务的执行进度
 * 3. 支持任务取消
 */

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { Job } from 'bullmq';
import { Queue } from 'bullmq';
import { logger } from '@/lib/logger';

// ===== Redis 配置 =====

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

function getRedisConfig() {
  if (REDIS_URL.includes('://')) {
    const auth = REDIS_URL.includes('@') ? REDIS_URL.split('@')[0] : '';
    const hostPart = REDIS_URL.includes('@') ? REDIS_URL.split('@')[1] : REDIS_URL.split('://')[1];

    const [host, portStr] = hostPart.split(':');
    const port = portStr ? parseInt(portStr, 10) : 6379;

    return {
      host,
      port,
      password: auth ? auth.replace('redis://', '').replace('@', '') || REDIS_PASSWORD : undefined,
    };
  }

  return {
    host: 'localhost',
    port: 6379,
    password: REDIS_PASSWORD,
  };
}

// 获取队列
function getReportQueue(): Queue {
  const redisConfig = getRedisConfig();
  return new Queue('report', { connection: redisConfig });
}

// ===== 类型定义 =====

export interface TaskStatusResponse {
  taskId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled' | 'not_found';
  progress?: number;
  attempts?: number;
  createdAt?: number;
  processedAt?: number;
  finishedAt?: number;
  error?: string;
  result?: any;
}

// ===== GET /api/task/:taskId =====

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    const queue = getReportQueue();
    const job = await queue.getJob(taskId);

    if (!job) {
      return NextResponse.json({
        taskId,
        status: 'not_found',
      } as TaskStatusResponse);
    }

    const state = await job.getState();
    const progress = job.progress;

    return NextResponse.json({
      taskId,
      status: state as TaskStatusResponse['status'],
      progress: typeof progress === 'number' ? progress : undefined,
      attempts: job.attemptsMade,
      createdAt: job.timestamp,
      processedAt: job.processedOn,
      finishedAt: job.finishedOn,
      result: job.returnvalue,
      error: job.failedReason,
    } as TaskStatusResponse);

  } catch (error) {
    logger.error({ error }, '[Task API] 查询任务状态失败');
    return NextResponse.json(
      { error: 'Failed to get task status' },
      { status: 500 }
    );
  }
}

// ===== DELETE /api/task/:taskId (取消任务) =====

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    const queue = getReportQueue();
    const job = await queue.getJob(taskId);

    if (!job) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const state = await job.getState();

    // 只能取消 waiting 状态的任务
    if (state !== 'waiting') {
      return NextResponse.json(
        {
          error: `Cannot cancel task in state: ${state}`,
          currentState: state,
        },
        { status: 400 }
      );
    }

    await job.remove();

    logger.info({ taskId }, '[Task API] 任务已取消');

    return NextResponse.json({
      taskId,
      status: 'cancelled',
    });

  } catch (error) {
    logger.error({ error }, '[Task API] 取消任务失败');
    return NextResponse.json(
      { error: 'Failed to cancel task' },
      { status: 500 }
    );
  }
}
