import { DOCUMENT_STATUS_PREFIX } from "@/lib/redis/client";
import Redis from "ioredis";
export async function GET(req: Request, context: { params: Promise<{ projectId: string, documentId: string }> }) {
    const { documentId } = await context.params
    // 1. 必须使用独立的临时连接，严禁使用全局单例
    const redisSubClient = new Redis({
        host: process.env.REDIS_URL?.split('://')[1].split(':')[0] || 'localhost',
        port: Number(process.env.REDIS_URL?.split(':')[2].split('/')[0]) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_DB) || 0,
        maxRetriesPerRequest: null,
        // 增加重连保护
        enableReadyCheck: true,
    });
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            // 2. 核心修正：等待连接就绪后再订阅
            await new Promise((resolve, reject) => {
                redisSubClient.on('ready', resolve);
                redisSubClient.on('error', reject);
            });
            // 订阅该任务的特定频道
            await redisSubClient.subscribe(`${DOCUMENT_STATUS_PREFIX}${documentId}`);

            redisSubClient.on('message', (channel, message) => {
                // SSE 格式必须以 "data: " 开头，以 "\n\n" 结尾
                controller.enqueue(encoder.encode(`data: ${message}\n\n`));

                // 如果任务完成，关闭连接
                const data = JSON.parse(message);
                if (data.status === 'completed' || data.status === 'failed') {
                    redisSubClient.unsubscribe();
                    redisSubClient.quit();
                    controller.close();
                }
            });

            // 异常处理：客户端断开连接时清理 Redis 订阅
            req.signal.addEventListener('abort', () => {
                redisSubClient.unsubscribe();
                redisSubClient.quit();
                controller.close();
            });
        }
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}