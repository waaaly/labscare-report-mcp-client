/**
 * SSE 批量任务订阅 API
 *
 * 功能：
 * 1. 接收客户端 SSE 连接
 * 2. 从 Redis Stream 读取批量任务流式消息
 * 3. 聚合多个任务的消息
 * 4. 支持断线重连
 */

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { logger } from '@/lib/logger';
import { StreamChunk } from '@/lib/queue/stream-publisher';

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

function getRedisClient(): Redis {
  const config = getRedisConfig();
  return new Redis({
    ...config,
    maxRetriesPerRequest: null,
  });
}

// ===== 类型定义 =====

interface BatchStreamChunk extends StreamChunk {
  batchId?: string;
  totalTasks?: number;
  completedTasks?: number;
  failedTasks?: number;
  taskIndex?: number;
}

// ===== GET /api/stream/batch?batchId={id}&fromIndex={number} =====

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batchId');
  const fromIndex = searchParams.get('fromIndex');

  if (!batchId) {
    return NextResponse.json(
      { error: 'batchId is required' },
      { status: 400 }
    );
  }

  logger.info(`[SSE Batch] 新的 SSE 连接: batchId=${batchId}, fromIndex=${fromIndex}`);

  // 创建 SSE 响应流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const redis = getRedisClient();
      const streamKey = `batch-stream:${batchId}`;

      let isDone = false;
      let lastId = '0-0';
      let pollTimeout: NodeJS.Timeout | null = null;
      let taskStatus = new Map<number, { status: string; progress: number }>();

      // SSE 发送函数
      const sendSSE = (data: any) => {
        const sseData = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(sseData));
      };

      // 读取历史消息
      try {
        const historicalMessages = await redis.xrange(
          streamKey,
          '0-0',
          '+',
          'COUNT',
          '1000'
        );

        logger.debug(`[SSE Batch] 读取历史消息: ${historicalMessages.length} 条`);

        for (const [id, fields] of historicalMessages) {
          const dataIndex = fields.findIndex(f => f === 'data');
          const dataStr = dataIndex !== -1 ? fields[dataIndex + 1] : '{}';
          try {
            const data = JSON.parse(dataStr) as BatchStreamChunk;
            sendSSE(data);
            lastId = id;

            // 更新任务状态
            if (data.taskIndex !== undefined) {
              if (data.type === 'task_start') {
                taskStatus.set(data.taskIndex, { status: 'processing', progress: 0 });
              } else if (data.type === 'done') {
                taskStatus.set(data.taskIndex, { status: 'completed', progress: 100 });
              } else if (data.type === 'error') {
                taskStatus.set(data.taskIndex, { status: 'failed', progress: 0 });
              }
            }
          } catch (e) {
            logger.error({ error: e }, '[SSE Batch] 解析历史消息失败');
          }
        }
      } catch (error) {
        logger.error({ error }, '[SSE Batch] 读取历史消息失败');
      }

      // 发送初始状态
      const initialStatus = Array.from(taskStatus.entries()).map(([index, status]) => ({
        taskIndex: index,
        ...status,
      }));
      sendSSE({
        type: 'batch_status',
        batchId,
        tasks: initialStatus,
      });

      // 轮询新消息
      const pollMessages = async () => {
        try {
          const results = await redis.xread(
            'COUNT',
            '10',
            'BLOCK',
            '5000',
            'STREAMS',
            streamKey,
            lastId === '0-0' ? '0' : lastId
          );

          if (results && results.length > 0) {
            const [streamName, messages] = results[0];

            for (const [id, fields] of messages) {
              const dataIndex = fields.findIndex(f => f === 'data');
              const dataStr = dataIndex !== -1 ? fields[dataIndex + 1] : '{}';
              try {
                const data = JSON.parse(dataStr) as BatchStreamChunk;

                sendSSE(data);
                lastId = id;

                // 更新任务状态
                if (data.taskIndex !== undefined) {
                  if (data.type === 'task_start') {
                    taskStatus.set(data.taskIndex, { status: 'processing', progress: 0 });
                  } else if (data.type === 'done') {
                    taskStatus.set(data.taskIndex, { status: 'completed', progress: 100 });
                  } else if (data.type === 'error') {
                    taskStatus.set(data.taskIndex, { status: 'failed', progress: 0 });
                  }
                }

                // 检查是否完成
                if (data.type === 'batch_end') {
                  logger.info(
                    {
                      batchId,
                      completedTasks: data.completedTasks,
                      failedTasks: data.failedTasks,
                    },
                    '[SSE Batch] 批量任务结束'
                  );
                  isDone = true;
                  break;
                }
              } catch (e) {
                logger.error({ error: e }, '[SSE Batch] 解析消息失败');
              }
            }

            if (isDone) {
              controller.close();
              await redis.quit();
              return;
            }
          }
        } catch (error) {
          if (!isDone) {
            // 发送心跳
            sendSSE({ type: 'ping', timestamp: Date.now() });
          }
        }

        if (!isDone && !controller.desiredSize) {
          pollTimeout = setTimeout(pollMessages, 100);
        }
      };

      pollMessages();

      return () => {
        logger.info(`[SSE Batch] 连接关闭: batchId=${batchId}`);
        isDone = true;
        if (pollTimeout) {
          clearTimeout(pollTimeout);
        }
        redis.quit().catch(err => logger.error('[SSE Batch] Redis 关闭失败', err));
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
