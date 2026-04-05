/**
 * Task Retry API - 重试任务接口
 *
 * 功能：
 * 1. POST - 重试失败的任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getReportQueue } from '@/lib/redis/client';
import prisma from '@/lib/prisma';



// ===== POST /api/tasks/[id]/retry =====

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 开始事务
    await prisma.$transaction(async (tx) => {
      // 1. 检查任务状态
      const task = await tx.task.findUnique({ where: { id } });
      if (!task) {
        throw new Error('Task not found');
      }

      if (task.status !== 'failed') {
        throw new Error(`Cannot retry task in state: ${task.status}`);
      }

      // 2. 从 Redis 队列中重试任务
      const queue = getReportQueue();
      const job = await queue.getJob(id);
      if (job) {
        await job.retry();
      }

      // 3. 更新 PostgreSQL 中的任务状态
      await tx.task.update({
        where: { id },
        data: { status: 'waiting', progress: 0, error: null },
      });
    });

    logger.info({ taskId: id }, '[Task Retry API] 任务已重试');

    return NextResponse.json({
      id,
      status: 'waiting',
      message: 'Task has been queued for retry',
    });

  } catch (error) {
    logger.error({ error }, '[Task Retry API] 重试任务失败');
    if (error instanceof Error) {
      if (error.message === 'Task not found') {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }
      if (error.message.startsWith('Cannot retry task in state:')) {
        return NextResponse.json(
          {
            error: error.message,
            currentState: error.message.split(': ')[1],
          },
          { status: 400 }
        );
      }
    }
    return NextResponse.json(
      { error: 'Failed to retry task' },
      { status: 500 }
    );
  }
}
