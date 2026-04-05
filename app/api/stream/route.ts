/**
 * SSE 订阅 API - 单个任务
 *
 * 功能：
 * 1. 接收客户端 SSE 连接
 * 2. 从 Redis Stream 读取流式消息
 * 3. 支持断线重连（通过 fromId 参数）
 * 4. 将消息转换为 SSE 格式推送给客户端
 */

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { logger } from '@/lib/logger';
import { StreamChunk } from '@/lib/queue/stream-publisher';

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

// Redis 客户端（用于读取 Stream）
function getRedisClient(): Redis {
  const config = getRedisConfig();
  return new Redis({
    ...config,
    maxRetriesPerRequest: null, // SSE 不需要重试
  });
}

// ===== GET /api/stream?jobId={id}&fromId={id} =====

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const fromId = searchParams.get('fromId') || '0-0';

  // 验证 jobId
  if (!jobId) {
    return NextResponse.json(
      { error: 'jobId is required' },
      { status: 400 }
    );
  }

  logger.info(`[SSE] 新的 SSE 连接: jobId=${jobId}, fromId=${fromId}`);

  // 创建 SSE 响应流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const redis = getRedisClient();
      const streamKey = `stream:${jobId}`;

      let isDone = false;
      let lastId = fromId;
      let pollTimeout: NodeJS.Timeout | null = null;

      // SSE 发送函数
      const sendSSE = (data: any) => {
        const sseData = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(sseData));
      };

      // 读取历史消息（断线重连）
      try {
        if (lastId !== '0-0') {
          logger.debug(`[SSE] 读取历史消息: fromId=${lastId}`);
          const historicalMessages = await redis.xrange(
            streamKey,
            `(${lastId}`,
            '+',
            'COUNT',
            '100'
          );

          for (const [id, fields] of historicalMessages) {
            const dataIndex = fields.findIndex(f => f === 'data');
            const dataStr = dataIndex !== -1 ? fields[dataIndex + 1] : '{}';
            try {
              const data = JSON.parse(dataStr) as StreamChunk;
              sendSSE(data);
              lastId = id;
            } catch (e) {
              logger.error({ error: e }, '[SSE] 解析历史消息失败');
            }
          }

          logger.debug(`[SSE] 已发送 ${historicalMessages.length} 条历史消息`);
        }
      } catch (error) {
        logger.error({ error }, '[SSE] 读取历史消息失败');
      }

      // 轮询新消息
      const pollMessages = async () => {
        try {
          // 使用 XREAD 读取新消息
          const results = await redis.xread(
            'COUNT',
            '10',
            'BLOCK',
            '5000', // 阻塞 5 秒
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
                const data = JSON.parse(dataStr) as StreamChunk;

                // 发送 SSE 消息
                sendSSE(data);
                lastId = id;

                // 检查是否完成
                if (data.type === 'done' || data.type === 'error') {
                  logger.info({ jobId, type: data.type }, '[SSE] 任务结束');
                  isDone = true;
                  break;
                }
              } catch (e) {
                logger.error({ error: e }, '[SSE] 解析消息失败');
              }
            }

            if (isDone) {
              controller.close();
              await redis.quit();
              return;
            }
          }
        } catch (error) {
          // 如果 Stream 不存在，可能任务还没开始
          if (!isDone) {
            // 发送心跳，保持连接
            sendSSE({ type: 'ping', timestamp: Date.now() });
          }
        }

        // 继续轮询
        if (!isDone && !controller.desiredSize) {
          pollTimeout = setTimeout(pollMessages, 100);
        }
      };

      // 开始轮询
      pollMessages();

      // 清理函数
      return () => {
        logger.info(`[SSE] 连接关闭: jobId=${jobId}`);
        isDone = true;
        if (pollTimeout) {
          clearTimeout(pollTimeout);
        }
        redis.quit().catch(err => logger.error('[SSE] Redis 关闭失败', err));
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
    },
  });
}
