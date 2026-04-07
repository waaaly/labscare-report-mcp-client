/**
 * Tasks API - 任务管理接口
 *
 * 功能：
 * 1. GET - 获取任务列表
 * 2. POST - 创建批量任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getReportQueue } from '@/lib/redis/client';
import prisma from '@/lib/prisma';

// ===== 类型定义 =====

export interface TaskItem {
  reportId: string;
  reportName: string;
  labId: string;
  taskName: string;
  additionalInstructions: string;
  documentUrls: string[];
  advancedParams: {
    temperature: number;
    maxTokens: number;
    model: string;
  };
}

export interface CreateTaskRequest {
  tasks: TaskItem[];
}

export interface TaskResponse {
  id: string;
  name: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  reportId: string;
  reportName?: string;
  labId: string;
  additionalInstructions?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  createdAt: number;
  completedAt?: number;
}

// ===== GET /api/tasks =====

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const labId = searchParams.get('labId');

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (labId) {
      where.labId = labId;
    }
    
    const dbTasks = await prisma.task.findMany({
      where,
      include: {
        report: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const tasks: TaskResponse[] = dbTasks.map(task => ({
      id: task.id,
      name: task.name,
      status: task.status as TaskResponse['status'],
      progress: task.progress,
      reportId: task.reportId,
      reportName: task.report?.name,
      labId: task.labId,
      additionalInstructions: task.additionalInstructions || undefined,
      temperature: task.temperature ? Number(task.temperature) : undefined,
      maxTokens: task.maxTokens || undefined,
      model: task.model || undefined,
      createdAt: task.createdAt.getTime(),
      completedAt: task.completedAt?.getTime(),
    }));

    return NextResponse.json(tasks);

  } catch (error) {
    logger.error({ error }, '[Tasks API] 获取任务列表失败');
    return NextResponse.json(
      { error: 'Failed to get tasks' },
      { status: 500 }
    );
  }
}

// ===== POST /api/tasks =====

export async function POST(request: NextRequest) {
  try {
    const body: CreateTaskRequest = await request.json();

    if (!body.tasks || body.tasks.length === 0) {
      return NextResponse.json(
        { error: 'At least one task is required' },
        { status: 400 }
      );
    }

    const createdTasks: TaskResponse[] = [];

    await prisma.$transaction(async (tx) => {
      for (const taskItem of body.tasks) {
        if (!taskItem.taskName || !taskItem.taskName.trim()) {
          throw new Error(`Task name is required for report: ${taskItem.reportName}`);
        }

        const taskId = crypto.randomUUID();

        const taskData = {
          id: taskId,
          labId: taskItem.labId,
          name: taskItem.taskName,
          reportId: taskItem.reportId,
          additionalInstructions: taskItem.additionalInstructions,
          status: 'waiting',
          progress: 0,
          temperature: taskItem.advancedParams.temperature,
          maxTokens: taskItem.advancedParams.maxTokens,
          model: taskItem.advancedParams.model,
        };

        await tx.task.create({
          data: taskData,
        });

        const jobData = {
          taskId,
          name: taskItem.taskName,
          reportId: taskItem.reportId,
          reportName: taskItem.reportName,
          additionalInstructions: taskItem.additionalInstructions,
          documentUrls: taskItem.documentUrls,
          advancedParams: taskItem.advancedParams,
          createdAt: Date.now(),
        };

        const queue = getReportQueue();
        await queue.add('task-process', jobData, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            count: 100,
            age: 7 * 24 * 3600,
          },
          removeOnFail: {
            count: 50,
            age: 30 * 24 * 3600,
          },
        });

        createdTasks.push({
          id: taskId,
          name: taskItem.taskName,
          status: 'waiting',
          progress: 0,
          reportId: taskItem.reportId,
          reportName: taskItem.reportName,
          labId: taskItem.labId,
          additionalInstructions: taskItem.additionalInstructions,
          temperature: taskItem.advancedParams.temperature,
          maxTokens: taskItem.advancedParams.maxTokens,
          model: taskItem.advancedParams.model,
          createdAt: Date.now(),
        });

        logger.info({ taskId, taskName: taskItem.taskName, reportId: taskItem.reportId }, '[Tasks API] 任务已创建');
      }
    });

    logger.info({ count: createdTasks.length }, '[Tasks API] 批量任务创建完成');

    return NextResponse.json(createdTasks, { status: 201 });

  } catch (error) {
    logger.error({ error }, '[Tasks API] 创建任务失败');
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
