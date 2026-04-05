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

// ===== GET /api/tasks/[id]/stream =====

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 创建 SSE 响应
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const redis = new Redis(getRedisConfig());
      const channel = `task:${id}:logs`;

      let closed = false;

      const sendEvent = (event: string, data: any) => {
        if (closed) return;
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // 发送连接成功消息
      sendEvent('connected', { taskId: id, timestamp: Date.now() });

      // 订阅 Redis 频道
      const subscriber = new Redis(getRedisConfig());
      subscriber.subscribe(channel, (err) => {
        if (err) {
          logger.error({ error: err, taskId: id }, '[Task Stream API] 订阅失败');
          sendEvent('error', { message: 'Failed to subscribe to logs' });
        }
      });

      // 监听日志消息
      subscriber.on('message', async (channelName, message) => {
        if (channelName === channel) {
          try {
            const logData = JSON.parse(message);
            sendEvent('log', { message: logData });

            // 持久化日志到 PostgreSQL
            try {
              await prisma.taskLog.create({
                data: {
                  taskId: id,
                  type: logData.type || 'info',
                  content: logData.content || JSON.stringify(logData),
                  metadata: logData,
                },
              });
            } catch (dbError) {
              logger.error({ error: dbError, taskId: id }, '[Task Stream API] 持久化日志失败');
            }
          } catch (e) {
            logger.error({ error: e, message }, '[Task Stream API] 解析日志失败');
          }
        }
      });

      // 定期检查任务状态
      const queue = new Queue('report', { connection: getRedisConfig() });
      const statusInterval = setInterval(async () => {
        if (closed) return;

        try {
          const job = await queue.getJob(id);
          if (!job) {
            sendEvent('status', { status: 'not_found' });
            cleanup();
            return;
          }

          const state = await job.getState();
          const progress = job.progress;

          // 更新 PostgreSQL 中的任务状态和进度
          try {
            await prisma.task.update({
              where: { id },
              data: {
                status: state,
                progress: typeof progress === 'number' ? progress : 0,
              },
            });
          } catch (dbError) {
            logger.error({ error: dbError, taskId: id }, '[Task Stream API] 更新任务状态失败');
          }

          sendEvent('status', {
            status: state,
            progress: typeof progress === 'number' ? progress : 0,
          });

          // 如果任务完成或失败，发送最终状态并关闭
          if (state === 'completed' || state === 'failed') {
            // 更新任务完成时间和结果
            try {
              await prisma.task.update({
                where: { id },
                data: {
                  status: state,
                  completedAt: new Date(),
                  duration: job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : undefined,
                  result: job.returnvalue,
                  error: job.failedReason,
                },
              });
            } catch (dbError) {
              logger.error({ error: dbError, taskId: id }, '[Task Stream API] 更新任务完成状态失败');
            }

            sendEvent('status', { status: state, finished: true });
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待最后一条消息
            cleanup();
          }
        } catch (e) {
          logger.error({ error: e, taskId: id }, '[Task Stream API] 检查任务状态失败');
        }
      }, 1000);

      // 清理函数
      const cleanup = async () => {
        if (closed) return;
        closed = true;

        clearInterval(statusInterval);
        await subscriber.quit();
        await redis.quit();

        try {
          await queue.close();
        } catch (e) {
          // 忽略关闭错误
        }

        controller.close();
      };

      // 监听客户端断开连接
      request.signal.addEventListener('abort', cleanup);
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
