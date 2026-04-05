/**
 * Batch Cancel API - 批量取消任务接口
 *
 * 功能：
 * 1. POST - 批量取消任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getReportQueue } from '@/lib/redis/client';
import prisma from '@/lib/prisma';



// ===== 类型定义 =====

export interface BatchCancelRequest {
  taskIds: string[];
}

// ===== POST /api/tasks/batch-cancel =====

export async function POST(request: NextRequest) {
  try {
    const body: BatchCancelRequest = await request.json();

    if (!body.taskIds || !Array.isArray(body.taskIds) || body.taskIds.length === 0) {
      return NextResponse.json(
        { error: 'taskIds array is required' },
        { status: 400 }
      );
    }

    const queue = getReportQueue();
    const results = {
      cancelled: [] as string[],
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

          // 2. 从 Redis 队列中移除任务
          const job = await queue.getJob(taskId);
          if (job) {
            const state = await job.getState();
            if (state === 'waiting' || state === 'active') {
              await job.remove();
            } else {
              results.skipped.push(taskId);
              return;
            }
          } else {
            results.skipped.push(taskId);
            return;
          }

          // 3. 更新 PostgreSQL 中的任务状态
          await tx.task.update({
            where: { id: taskId },
            data: { status: 'cancelled' },
          });

          results.cancelled.push(taskId);
        });
      } catch (error) {
        results.failed.push(taskId);
        logger.error({ error, taskId }, '[Batch Cancel API] 取消单个任务失败');
      }
    }

    logger.info(
      { total: body.taskIds.length, ...results },
      '[Batch Cancel API] 批量取消完成'
    );

    return NextResponse.json({
      total: body.taskIds.length,
      ...results,
    });

  } catch (error) {
    logger.error({ error }, '[Batch Cancel API] 批量取消失败');
    return NextResponse.json(
      { error: 'Failed to batch cancel tasks' },
      { status: 500 }
    );
  }
}
