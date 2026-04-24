/**
 * Task Detail API - 单个任务管理接口
 *
 * 功能：
 * 1. GET - 获取任务详情
 * 2. DELETE - 取消任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getReportQueue } from '@/lib/redis/client';
import prisma from '@/lib/prisma';
import { TaskStatus } from '@prisma/client';

// 状态映射：Prisma TaskStatus -> API Response Status
const taskStatusToApiStatus = (status: TaskStatus): 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled' => {
  switch (status) {
    case TaskStatus.PENDING: return 'waiting';
    case TaskStatus.RUNNING: return 'active';
    case TaskStatus.COMPLETED: return 'completed';
    case TaskStatus.FAILED: return 'failed';
    case TaskStatus.CANCELLED: return 'cancelled';
    default: return 'waiting';
  }
};

// ===== 类型定义 =====

export interface TaskDetailResponse {
  id: string;
  name: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  materials: any[];
  createdAt: number;
  completedAt?: number;
  duration?: number;
  result?: any;
  error?: string;
}

// ===== GET /api/tasks/[id] =====

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 从 PostgreSQL 获取任务详情
    const dbTask = await prisma.task.findUnique({
      where: { id },
      include: {
        report: {
          include: {
            documents: true,
          },
        },
        logs: true,
      },
    });

    if (!dbTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // 转换为响应格式
    const response: TaskDetailResponse = {
      id: dbTask.id,
      name: dbTask.report?.name || '',
      status: taskStatusToApiStatus(dbTask.status),
      progress: dbTask.progress,
      materials: dbTask.report?.documents.map(document => ({
        id: document.id,
        name: document.name,
        type: document.type,
        size: document.size,
        url: document.url,
        storagePath: document.storagePath,
      })) || [],
      createdAt: dbTask.createdAt.getTime(),
      completedAt: dbTask.completedAt?.getTime(),
      duration: dbTask.duration ? Number(dbTask.duration) : undefined,
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error({ error }, '[Task Detail API] 获取任务详情失败');
    return NextResponse.json(
      { error: 'Failed to get task detail' },
      { status: 500 }
    );
  }
}

// ===== DELETE /api/tasks/[id] (取消任务) =====

export async function DELETE(
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

      // 2. 从 Redis 队列中移除任务
      const queue = getReportQueue();
      const job = await queue.getJob(id);
      if (job) {
        const state = await job.getState();
        if (state === 'waiting' || state === 'active') {
          await job.remove();
        }
      }

      // 3. 更新 PostgreSQL 中的任务状态
      await tx.task.update({
        where: { id },
        data: { status: TaskStatus.CANCELLED },
      });
    });

    logger.info({ taskId: id }, '[Task Detail API] 任务已取消');

    return NextResponse.json({
      id,
      status: 'cancelled' as const,
    });

  } catch (error) {
    logger.error({ error }, '[Task Detail API] 取消任务失败');
    if (error instanceof Error && error.message === 'Task not found') {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to cancel task' },
      { status: 500 }
    );
  }
}
