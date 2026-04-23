/**
 * Batch Retry API - 批量重试任务接口
 *
 * 功能：
 * 1. POST - 批量重试失败的任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getReportQueue } from '@/lib/redis/client';
import prisma from '@/lib/prisma';
import { TaskStatus } from '@prisma/client';

// ===== 类型定义 =====

export interface BatchRetryRequest {
  taskIds: string[];
}

// ===== POST /api/tasks/batch-retry =====

export async function POST(request: NextRequest) {
  try {
    const body: BatchRetryRequest = await request.json();

    if (!body.taskIds || !Array.isArray(body.taskIds) || body.taskIds.length === 0) {
      return NextResponse.json(
        { error: 'taskIds array is required' },
        { status: 400 }
      );
    }

    const queue = getReportQueue();
    const results = {
      retried: [] as string[],
      failed: [] as string[],
      skipped: [] as string[],
    };

    for (const taskId of body.taskIds) {
      try {
        // 开始事务
        await prisma.$transaction(async (tx) => {
          // 1. 检查任务状态
          const task = await tx.task.findUnique({ where: { id: taskId } });
          if (!task) {
            results.skipped.push(taskId);
            return;
          }

          if (task.status !== TaskStatus.FAILED) {
            results.skipped.push(taskId);
            return;
          }

          // 2. 从 Redis 队列中重试任务
          const job = await queue.getJob(taskId);
          if (job) {
            await job.retry();
          } else {
            results.skipped.push(taskId);
            return;
          }

          // 3. 更新 PostgreSQL 中的任务状态
          await tx.task.update({
            where: { id: taskId },
            data: { status: TaskStatus.PENDING, progress: 0, error: null },
          });

          results.retried.push(taskId);
        });
      } catch (error) {
        results.failed.push(taskId);
        logger.error({ error, taskId }, '[Batch Retry API] 重试单个任务失败');
      }
    }

    logger.info(
      { total: body.taskIds.length, ...results },
      '[Batch Retry API] 批量重试完成'
    );

    return NextResponse.json({
      total: body.taskIds.length,
      ...results,
    });

  } catch (error) {
    logger.error({ error }, '[Batch Retry API] 批量重试失败');
    return NextResponse.json(
      { error: 'Failed to batch retry tasks' },
      { status: 500 }
    );
  }
}
