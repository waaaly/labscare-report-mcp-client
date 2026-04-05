/**
 * 批量任务 API
 *
 * 功能：
 * 1. 接收批量任务提交
 * 2. 任务验证和限流
 * 3. 批量入队到 BullMQ
 * 4. 返回批次 ID 和任务 ID 列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

// Redis 连接配置
// 解析 Redis URL
function getRedisConfig() {
  return {
     host: process.env.REDIS_URL?.split('://')[1].split(':')[0] || 'localhost',
      port: Number(process.env.REDIS_URL?.split(':')[2].split('/')[0]) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: Number(process.env.REDIS_DB) || 0
  };
}

// 创建队列（单例模式）
let reportQueue: Queue | null = null;

function getReportQueue(): Queue {
  if (!reportQueue) {
    const redisConfig = getRedisConfig();
    logger.info({redisConfig})
    reportQueue = new Queue('report', { 
      connection: redisConfig,
    });

    reportQueue.on('error', (err) => {
      logger.error({ err }, '[Batch API] Queue error');
    });
  }
  return reportQueue;
}

// ===== 类型定义 =====

export interface BatchRequestTask {
  prompt: string;
  contextJson?: string;
  messagesJson?: string;
  files?: Array<{
    name: string;
    type: 'image' | 'json' | 'md';
    content: string;
    dataUrl?: string;
  }>;
}

export interface BatchRequest {
  tasks: BatchRequestTask[];
}

export interface BatchResponse {
  success: boolean;
  batchId: string;
  jobIds: string[];
  totalTasks: number;
  queuedTasks: number;
}

// ===== 配置 =====

const MAX_BATCH_SIZE = Number(process.env.MAX_BATCH_SIZE || 10);
const MAX_PROMPT_LENGTH = Number(process.env.MAX_PROMPT_LENGTH || 10000);

// ===== API 路由 =====

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 解析请求体
    const body: BatchRequest = await request.json();

    // 验证请求体
    if (!body.tasks || !Array.isArray(body.tasks) || body.tasks.length === 0) {
      return NextResponse.json(
        { error: 'tasks must be a non-empty array' },
        { status: 400 }
      );
    }

    // 限制批量任务数量（防止滥用）
    if (body.tasks.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximum batch size is ${MAX_BATCH_SIZE}` },
        { status: 400 }
      );
    }

    // 验证每个任务
    for (let i = 0; i < body.tasks.length; i++) {
      const task = body.tasks[i];

      if (!task.prompt || typeof task.prompt !== 'string') {
        return NextResponse.json(
          { error: `Task ${i}: prompt is required and must be a string` },
          { status: 400 }
        );
      }

      if (task.prompt.length > MAX_PROMPT_LENGTH) {
        return NextResponse.json(
          { error: `Task ${i}: prompt exceeds maximum length of ${MAX_PROMPT_LENGTH}` },
          { status: 400 }
        );
      }

      // 验证文件（如果有的话）
      if (task.files && Array.isArray(task.files)) {
        if (task.files.length > 10) {
          return NextResponse.json(
            { error: `Task ${i}: maximum 10 files per task` },
            { status: 400 }
          );
        }

        for (let j = 0; j < task.files.length; j++) {
          const file = task.files[j];

          if (!file.name || typeof file.name !== 'string') {
            return NextResponse.json(
              { error: `Task ${i}, File ${j}: name is required` },
              { status: 400 }
            );
          }

          if (!file.type || !['image', 'json', 'md'].includes(file.type)) {
            return NextResponse.json(
              { error: `Task ${i}, File ${j}: type must be one of: image, json, md` },
              { status: 400 }
            );
          }

          if (!file.content || typeof file.content !== 'string') {
            return NextResponse.json(
              { error: `Task ${i}, File ${j}: content is required` },
              { status: 400 }
            );
          }

          // 限制文件内容大小（10MB）
          const MAX_FILE_SIZE = 10 * 1024 * 1024;
          if (file.content.length > MAX_FILE_SIZE) {
            return NextResponse.json(
              { error: `Task ${i}, File ${j}: content exceeds maximum size of 10MB` },
              { status: 400 }
            );
          }
        }
      }
    }

    // 生成批次 ID
    const batchId = randomUUID();

    // 获取队列实例
    const queue = getReportQueue();

    // 批量添加任务到队列
    const jobIds: string[] = [];
    const jobs = body.tasks.map((task, index) => {
      const jobId = `${batchId}-${index}`;
      return {
        name: 'generate-report',
        data: {
          jobId,
          batchId,
          prompt: task.prompt,
          contextJson: task.contextJson,
          messagesJson: task.messagesJson,
          files: task.files,
        },
        opts: {
          jobId,
          attempts: 3, // 重试 3 次
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 86400, // 24小时后删除
          },
          removeOnFail: {
            age: 604800, // 7天后删除
          },
        },
      };
    });

    // 添加到队列
    const addedJobs = await queue.addBulk(jobs);
    jobIds.push(...addedJobs.map(job => job.id!));

    const duration = Date.now() - startTime;
    logger.info({
      batchId,
      jobIds,
      taskCount: body.tasks.length,
      duration: `${duration}ms`,
    }, '[Batch API] 批量任务已提交');

    const response: BatchResponse = {
      success: true,
      batchId,
      jobIds,
      totalTasks: body.tasks.length,
      queuedTasks: body.tasks.length,
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error({ error }, '[Batch API] 请求失败');
    return NextResponse.json(
      { error: 'Failed to process batch request' },
      { status: 500 }
    );
  }
}
