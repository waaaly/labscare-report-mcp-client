/**
 * Stream Publisher - 基于 Redis Stream 的流式消息发布
 *
 * 设计原则：
 * 1. 消息持久化：支持断线重连后回溯
 * 2. 自动清理：设置过期时间，防止内存溢出
 * 3. 消息上限：MAXLEN 限制，防止无限增长
 * 4. 高性能：使用 Redis Stream 原生命令
 */

import Redis from 'ioredis';
import { logger } from '@/lib/logger';

// Redis 连接
let redisClient: Redis | null = null;

/**
 * 获取 Redis 客户端实例
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl);

    redisClient.on('connect', () => {
      logger.info('[StreamPublisher] Redis connected');
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, '[StreamPublisher] Redis error');
    });
  }
  return redisClient;
}

// Stream Key 前缀
export const STREAM_KEY_PREFIX = 'stream:';
export const STREAM_BATCH_PREFIX = 'batch-stream:';

// Stream 配置
const MAXLEN = 1000; // 保留最近 1000 条消息
const STREAM_TTL = 86400; // 24小时过期

/**
 * Stream 消息类型
 */
export interface StreamChunk {
  type: 'content' | 'thought' | 'tool_call' | 'status' | 'metrics' | 'error' | 'done' | 'task_start' | 'task_end' | 'batch_end';
  text?: string;
  tool?: string;
  node?: string;
  jobId?: string;
  taskIndex?: number;
  batchId?: string;
  completedTasks?: number;
  failedTasks?: number;
  timestamp?: number;
  [key: string]: any;
}

/**
 * 发布流式消息到 Redis Stream
 * @param jobId 任务 ID
 * @param chunk 消息块
 */
export async function publishStreamChunk(
  jobId: string,
  chunk: StreamChunk
): Promise<void> {
  try {
    const client = getRedisClient();
    const streamKey = `${STREAM_KEY_PREFIX}${jobId}`;

    // 使用 XADD 添加消息到 Stream
    // MAXLEN ~1000：保留最近 1000 条消息
    // * 表示自动生成 ID
    await client.xadd(
      streamKey,
      'MAXLEN',
      '~',
      String(MAXLEN),
      '*',
      'type',
      chunk.type,
      'data',
      JSON.stringify(chunk),
      'timestamp',
      Date.now().toString()
    );

    // 如果是第一条消息，设置过期时间
    await client.expire(streamKey, STREAM_TTL);

    logger.debug({ jobId, type: chunk.type }, '[StreamPublisher] 发布消息');

  } catch (error) {
    logger.error({ error }, '[StreamPublisher] 发布消息失败');
    throw error;
  }
}

/**
 * 发布批量任务流式消息
 * @param batchId 批量任务 ID
 * @param chunk 消息块
 */
export async function publishBatchStreamChunk(
  batchId: string,
  chunk: StreamChunk
): Promise<void> {
  try {
    const client = getRedisClient();
    const streamKey = `${STREAM_BATCH_PREFIX}${batchId}`;

    await client.xadd(
      streamKey,
      'MAXLEN',
      '~',
      String(MAXLEN),
      '*',
      'type',
      chunk.type,
      'data',
      JSON.stringify(chunk),
      'timestamp',
      Date.now().toString()
    );

    // 批量任务 Stream 也设置过期时间
    await client.expire(streamKey, STREAM_TTL);

    logger.debug({ batchId, type: chunk.type }, '[StreamPublisher] 发布批量消息');

  } catch (error) {
    logger.error({ error }, '[StreamPublisher] 发布批量消息失败');
    throw error;
  }
}

/**
 * 标记任务完成
 * @param jobId 任务 ID
 * @param result 完成时的额外数据
 */
export async function markStreamComplete(jobId: string, result?: Partial<StreamChunk>): Promise<void> {
  await publishStreamChunk(jobId, {
    type: "done",
    ...result
  });
}

/**
 * 标记批量任务完成
 * @param batchId 批量任务 ID
 * @param completedTasks 完成的任务数
 * @param failedTasks 失败的任务数
 */
export async function markBatchStreamComplete(
  batchId: string,
  completedTasks: number,
  failedTasks: number
): Promise<void> {
  await publishBatchStreamChunk(batchId, {
    type: "batch_end",
    batchId,
    completedTasks,
    failedTasks,
    timestamp: Date.now()
  });
}

/**
 * 标记任务失败
 * @param jobId 任务 ID
 * @param error 错误对象
 */
export async function markStreamFailed(jobId: string, error: Error): Promise<void> {
  await publishStreamChunk(jobId, {
    type: "error",
    message: error.message,
    stack: error.stack
  });
}

/**
 * 读取 Stream 中的消息（用于断线重连）
 * @param jobId 任务 ID
 * @param fromId 从哪个 ID 开始读取（不包含）
 * @param count 读取数量
 */
export async function readStreamMessages(
  jobId: string,
  fromId: string = '0-0',
  count: number = 100
): Promise<Array<{ id: string; data: StreamChunk }>> {
  try {
    const client = getRedisClient();
    const streamKey = `${STREAM_KEY_PREFIX}${jobId}`;

    // 使用 XRANGE 读取消息
    const results = await client.xrange(streamKey, `(${fromId}`, '+', 'COUNT', count);

    return results.map(([id, fields]) => {
      const dataIndex = fields.findIndex(f => f === 'data');
      const dataStr = dataIndex !== -1 ? fields[dataIndex + 1] : '{}';
      return {
        id,
        data: JSON.parse(dataStr) as StreamChunk
      };
    });

  } catch (error) {
    logger.error({ error }, '[StreamPublisher] 读取 Stream 消息失败');
    return [];
  }
}

/**
 * 读取批量任务 Stream 中的消息
 * @param batchId 批量任务 ID
 * @param fromId 从哪个 ID 开始读取
 * @param count 读取数量
 */
export async function readBatchStreamMessages(
  batchId: string,
  fromId: string = '0-0',
  count: number = 100
): Promise<Array<{ id: string; data: StreamChunk }>> {
  try {
    const client = getRedisClient();
    const streamKey = `${STREAM_BATCH_PREFIX}${batchId}`;

    const results = await client.xrange(streamKey, `(${fromId}`, '+', 'COUNT', count);

    return results.map(([id, fields]) => {
      const dataIndex = fields.findIndex(f => f === 'data');
      const dataStr = dataIndex !== -1 ? fields[dataIndex + 1] : '{}';
      return {
        id,
        data: JSON.parse(dataStr) as StreamChunk
      };
    });

  } catch (error) {
    logger.error({ error }, '[StreamPublisher] 读取批量 Stream 消息失败');
    return [];
  }
}

/**
 * 获取 Stream 长度
 * @param jobId 任务 ID
 */
export async function getStreamLength(jobId: string): Promise<number> {
  try {
    const client = getRedisClient();
    const streamKey = `${STREAM_KEY_PREFIX}${jobId}`;
    return await client.xlen(streamKey);
  } catch (error) {
    logger.error({ error }, '[StreamPublisher] 获取 Stream 长度失败');
    return 0;
  }
}

/**
 * 清理已过期的 Stream（定时任务）
 */
export async function cleanupExpiredStreams(): Promise<void> {
  try {
    const client = getRedisClient();
    const pattern = `${STREAM_KEY_PREFIX}*`;

    // 扫描所有 Stream Key
    const keys = await client.keys(pattern);

    for (const key of keys) {
      const ttl = await client.ttl(key);
      if (ttl === -1) {
        // 没有设置过期时间，手动设置
        await client.expire(key, STREAM_TTL);
      }
    }

    logger.debug({ keysCount: keys.length }, '[StreamPublisher] 清理完成');

  } catch (error) {
    logger.error({ error }, '[StreamPublisher] 清理过期 Stream 失败');
  }
}

/**
 * 优雅关闭 Redis 连接
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('[StreamPublisher] Redis 连接已关闭');
  }
}

// 进程退出时清理
if (typeof process !== 'undefined') {
  process.on('SIGTERM', closeRedisConnection);
  process.on('SIGINT', closeRedisConnection);
}
