import { logger } from "@/lib/logger";
import { DOCUMENT_STATUS_PREFIX } from "@/lib/redis/client";
import Redis from "ioredis";
import type { NextRequest } from "next/server";
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ documentId: string }> }
) {
    const { documentId } = await context.params;

    // 1. 验证参数
    if (!documentId) {
        return new Response('Missing documentId', { status: 400 });
    }

    let redisSubClient: Redis | null = null;
    const encoder = new TextEncoder();

    // 2. 创建 ReadableStream
    const stream = new ReadableStream({
        async start(controller) {
            logger.info(`[SSE Router]: stream starting for document: ${documentId}`);

            try {
                // 初始化 Redis 客户端
                redisSubClient = new Redis({
                    host: process.env.REDIS_URL?.split('://')[1]?.split(':')[0] || 'localhost',
                    port: Number(process.env.REDIS_URL?.split(':')[2]?.split('/')[0]) || 6379,
                    password: process.env.REDIS_PASSWORD,
                    db: Number(process.env.REDIS_DB) || 0,
                    maxRetriesPerRequest: null,
                });

                // 等待 Redis 连接就绪
                await new Promise((resolve, reject) => {
                    redisSubClient?.once('ready', resolve);
                    redisSubClient?.once('error', reject);
                });

                logger.info('[SSE Router]: Redis connection ready');

                // 订阅频道
                const channel = `${DOCUMENT_STATUS_PREFIX}${documentId}`;
                await redisSubClient.subscribe(channel);
                logger.info(`[SSE Router]: Subscribed to: ${channel}`);

                // 发送初始连接成功消息
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ status: 'connected', message: 'Ready' })}\n\n`)
                );

                // 监听消息
                redisSubClient.on('message', (chan, message) => {
                    logger.info(`[SSE Router]: Msg from ${chan}: ${message}`);
                    controller.enqueue(encoder.encode(`data: ${message}\n\n`));

                    // 如果任务结束，主动关闭流
                    try {
                        const data = JSON.parse(message);
                        if (data.status === 'completed' || data.status === 'failed') {
                            logger.info('[SSE Router]: Task finished, closing stream');
                            cleanup();
                            controller.close();
                        }
                    } catch (e) {
                        console.error('Error parsing Redis message', e);
                    }
                });

            } catch (error) {
                console.error('SSE start error:', error);
                cleanup();
                controller.error(error);
            }

            // 定义内部清理函数
            async function cleanup() {
                if (redisSubClient) {
                    logger.info('Cleaning up Redis connection...');
                    const client = redisSubClient;
                    redisSubClient = null; // 防止重复执行
                    try {
                        await client.unsubscribe();
                        await client.quit();
                        logger.info('[SSE Router]: Redis connection closed');
                    } catch (err) {
                        console.error('Error during Redis cleanup:', err);
                    }
                }
            }

            // 监听客户端断开（如关闭浏览器标签页）
            req.signal.addEventListener('abort', () => {
                logger.info('[SSE Router]: Client aborted connection');
                cleanup();
            });
        },

        // 如果流被取消（可选）
        cancel() {
            logger.info('[SSE Router]: Stream cancelled by consumer');
        }
    });

    // 3. 返回响应头（SSE 必须项）
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // 禁用 Nginx 缓存，确保实时推送
        },
    });
}