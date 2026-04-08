/**
 * Task Stream API - SSE 实时流接口
 *
 * 功能：
 * 1. GET - 通过 SSE 实时推送任务日志和进度
 */

import { NextRequest } from 'next/server';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@/lib/logger';
import { getRedisConfig } from '@/lib/redis/client';
import prisma from '@/lib/prisma';
import { STREAM_KEY_PREFIX } from '@/lib/queue/stream-publisher';

// ===== GET /api/tasks/[id]/stream =====

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const streamKey = `${STREAM_KEY_PREFIX}${id}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastId = '0';
      let redis: Redis | null = null;

      const sendEvent = (event: string, data: any) => {
        if (closed || !controller.desiredSize) return; // 增加防护
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (_) {
          // 客户端已断开
        }
      };

      const cleanup = async () => {
        if (closed) return;           // ← 关键防护：防止重复执行
        closed = true;

        if (redis) {
          try {
            await redis.quit();
          } catch (_) {}
          redis = null;
        }

        try {
          if (controller.desiredSize !== null) {   // 只有在未关闭时才 close
            controller.close();
          }
        } catch (_) {
          // 忽略已关闭错误
        }
      };

      // 发送连接消息
      sendEvent('connected', { taskId: id, timestamp: Date.now() });

      redis = new Redis(getRedisConfig());

      // 监听客户端主动断开
      request.signal.addEventListener('abort', cleanup, { once: true });

      try {
        while (!closed) {
          const result = await redis.xread(
            'COUNT', 10,
            'BLOCK', 5000,
            'STREAMS',
            streamKey,
            lastId
          );

          if (!result || result.length === 0) continue;

          for (const [_, messages] of result) {
            for (const [messageId, fields] of messages as [string, string[]][]) {
              try {
                const fieldMap = new Map<string, string>();
                for (let i = 0; i < fields.length; i += 2) {
                  fieldMap.set(fields[i], fields[i + 1]);
                }

                const type = fieldMap.get('type') || 'message';
                const dataStr = fieldMap.get('data') || '{}';
                const data = JSON.parse(dataStr);

                sendEvent(type, data);

                lastId = messageId;

                // 收到完成信号后优雅关闭
                if (type === 'completed' || type === 'failed' || data?.finished === true) {
                  await new Promise(r => setTimeout(r, 600)); // 短暂缓冲
                  await cleanup();
                  return;
                }
              } catch (parseErr) {
                logger.error({ error: parseErr, taskId: id }, '[Stream API] 解析消息失败');
              }
            }
          }
        }
      } catch (error: any) {
        // 忽略客户端断开导致的正常错误
        if (error.name !== 'AbortError' && !closed) {
          logger.error({ error, taskId: id }, '[Stream API] 读取 Stream 异常');
          sendEvent('error', { message: 'Stream read error' });
        }
      } finally {
        await cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}