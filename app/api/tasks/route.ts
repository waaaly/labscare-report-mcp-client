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

export interface Material {
  id: string;
  name: string;
  type: 'pdf' | 'json' | 'image' | 'markdown';
  size?: number;
  description?: string;
  thumbnail?: string;
  url?: string;
  content?: any;
  storagePath?: string;
}

export interface CreateTaskRequest {
  name: string;
  reportType?: string;
  additionalInstructions?: string;
  materials: Material[];
  advancedParams?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

export interface TaskResponse {
  id: string;
  name: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  materials: Material[];
  createdAt: number;
  completedAt?: number;
}

// ===== GET /api/tasks =====

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    // 从 PostgreSQL 获取任务列表
    const where = status && status !== 'all' ? { status } : {};
    
    const dbTasks = await prisma.task.findMany({
      where,
      include: {
        materials: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 转换为响应格式
    const tasks: TaskResponse[] = dbTasks.map(task => ({
      id: task.id,
      name: task.name,
      status: task.status as TaskResponse['status'],
      progress: task.progress,
      materials: task.materials.map(material => ({
        id: material.id,
        name: material.name,
        type: material.type as 'pdf' | 'json' | 'image' | 'markdown',
        size: material.size ? Number(material.size) : undefined,
        description: material.description || undefined,
        thumbnail: material.url || undefined, // 暂时使用 url 作为 thumbnail
        url: material.url || undefined,
        storagePath: material.storagePath || undefined,
        content: material.content,
      })),
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

    // 验证必填字段
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: 'Task name is required' },
        { status: 400 }
      );
    }

    if (!body.materials || body.materials.length === 0) {
      return NextResponse.json(
        { error: 'At least one material is required' },
        { status: 400 }
      );
    }

    // 生成任务 ID
    const taskId = crypto.randomUUID();

    // 准备物料数据
    const materialsData = body.materials.map(material => ({
      id: material.id || crypto.randomUUID(),
      name: material.name,
      type: material.type,
      size: material.size,
      description: material.description,
      url: material.url,
      storagePath: material.storagePath,
      content: material.content,
    }));

    // 准备任务数据
    const taskData = {
      id: taskId,
      userId: 'system', // 暂时使用 system 用户
      name: body.name,
      reportType: body.reportType || 'default',
      additionalInstructions: body.additionalInstructions,
      status: 'waiting',
      progress: 0,
      temperature: body.advancedParams?.temperature || 0.7,
      maxTokens: body.advancedParams?.maxTokens || 4000,
      model: body.advancedParams?.model || 'claude-sonnet-4.5',
      materials: {
        create: materialsData,
      },
    };

    // 开始事务
    await prisma.$transaction(async (tx) => {
      // 1. 写入 PostgreSQL
      await tx.task.create({
        data: taskData,
      });

      // 2. 准备队列数据
      const jobData = {
        taskId,
        name: body.name,
        reportType: body.reportType,
        additionalInstructions: body.additionalInstructions,
        materials: body.materials,
        advancedParams: body.advancedParams || {
          temperature: 0.7,
          maxTokens: 4000,
          model: 'claude-sonnet-4.5',
        },
        createdAt: Date.now(),
      };

      // 3. 添加到 Redis 队列
      const queue = getReportQueue();
      await queue.add('batch-process', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100, // 保留最近100个完成的任务
          age: 7 * 24 * 3600, // 7天
        },
        removeOnFail: {
          count: 50, // 保留最近50个失败的任务
          age: 30 * 24 * 3600, // 30天
        },
      });
    });

    logger.info({ taskId, taskName: body.name }, '[Tasks API] 批量任务已创建');

    return NextResponse.json({
      id: taskId,
      name: body.name,
      status: 'waiting',
      progress: 0,
      materials: body.materials,
      createdAt: Date.now(),
    } as TaskResponse, { status: 201 });

  } catch (error) {
    logger.error({ error }, '[Tasks API] 创建任务失败');
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
