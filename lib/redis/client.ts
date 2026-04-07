import Redis from 'ioredis';
import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../logger';

// Redis 客户端单例
class RedisClientSingleton {
  private static instance: Redis; // 用于普通操作
  private static subInstance: Redis; // 专门用于订阅

  private constructor() { }

  // 获取用于普通操作的实例
  public static getInstance(): Redis {
    if (!RedisClientSingleton.instance) {
      RedisClientSingleton.instance = new Redis(getRedisConfig());

      // 错误处理
      RedisClientSingleton.instance.on('error', (err) => {
        console.error('Redis client error:', err);
      });
    }

    return RedisClientSingleton.instance;
  }

  // 获取专门用于订阅的实例
  public static getSubInstance(): Redis {
    if (!RedisClientSingleton.subInstance) {
      RedisClientSingleton.subInstance = new Redis(getRedisConfig());

      // 错误处理
      RedisClientSingleton.subInstance.on('error', (err) => {
        console.error('Redis sub client error:', err);
      });
    }

    return RedisClientSingleton.subInstance;
  }
}

// 创建Redis客户端
const redisClient = RedisClientSingleton.getInstance();
const redisSubClient = RedisClientSingleton.getSubInstance();

// 队列名称
export const DOCUMENT_STATUS_PREFIX = 'document:status:';

//worker名称
export const DOCUMENT_PROCESSOR_WORKER_NAME = 'document-processing';
export const TASK_PROCESSOR_WORKER_NAME = 'task-processing';
// ===== Redis 配置 =====

export function getRedisConfig() {
  return {
    host: process.env.REDIS_URL?.split('://')[1].split(':')[0] || 'localhost',
    port: Number(process.env.REDIS_URL?.split(':')[2].split('/')[0]) || 6379,
    db: Number(process.env.REDIS_DB) || 0
  };
}

// 创建 BullMQ 队列
const documentQueue = new Queue(DOCUMENT_PROCESSOR_WORKER_NAME, {
  connection: getRedisConfig(),
  
});

// 添加监听器确认队列状态
documentQueue.on('error', (err) => {
  console.error('BullMQ queue error:', err);
});

documentQueue.on('waiting', () => {
  console.log('Queue is waiting');
});

// 检查连接状态
// documentQueue.client.on('connect', () => {
//   console.log('BullMQ connected to Redis');
// });
// 将变量置于模块顶层，但不导出，确保外部只能通过函数访问
let reportQueue: Queue | null = null;
export function getReportQueue(): Queue {
  // 使用双重检查或简单的 null 判断
  if (!reportQueue) {
    const redisConfig = getRedisConfig();

    logger.info({ redisConfig }, 'Initializing Report Queue');

    reportQueue = new Queue(TASK_PROCESSOR_WORKER_NAME, {
      connection: redisConfig,
      // 可以在这里添加默认配置，如 defaultJobOptions
    });

    // 绑定全局错误监听
    reportQueue.on('error', (err) => {
      logger.error({ err }, '[Batch API] Queue error');
    });

    // 可选：监听连接成功
    reportQueue.on('waiting', () => {
      logger.debug('Report Queue is waiting for jobs');
    });
  }

  return reportQueue;
}
/**
 * 发送消息到队列
 * @param queueName 队列名称
 * @param message 消息内容
 */
export async function sendToQueue(queueName: string, message: any): Promise<void> {
  try {
    await redisClient.lpush(queueName, JSON.stringify(message));
  } catch (error) {
    console.error('Failed to send message to queue:', error);
    throw error;
  }
}

/**
 * 从队列获取消息
 * @param queueName 队列名称
 * @param timeout 超时时间（秒）
 * @returns 消息内容或null
 */
export async function getFromQueue(queueName: string, timeout: number = 0): Promise<any | null> {
  try {
    if (timeout > 0) {
      // 使用BLPOP命令，支持阻塞等待
      const result = await redisClient.blpop(queueName, timeout);
      if (result && result[1]) {
        return JSON.parse(result[1]);
      }
    } else {
      // 使用LPOP命令，非阻塞
      const message = await redisClient.lpop(queueName);
      if (message) {
        return JSON.parse(message);
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get message from queue:', error);
    throw error;
  }
}

/**
 * 设置文档状态
 * @param documentId 文档ID
 * @param status 状态
 */
export async function setDocumentStatus(documentId: string, status: string): Promise<void> {
  try {
    await redisClient.set(`${DOCUMENT_STATUS_PREFIX}${documentId}`, status);
    // 设置过期时间为24小时
    await redisClient.expire(`${DOCUMENT_STATUS_PREFIX}${documentId}`, 86400);
  } catch (error) {
    console.error('Failed to set document status:', error);
    throw error;
  }
}

/**
 * 获取文档状态
 * @param documentId 文档ID
 * @returns 状态或null
 */
export async function getDocumentStatus(documentId: string): Promise<string | null> {
  try {
    return await redisClient.get(`${DOCUMENT_STATUS_PREFIX}${documentId}`);
  } catch (error) {
    console.error('Failed to get document status:', error);
    throw error;
  }
}

/**
 * 发送文档处理消息（使用 BullMQ）
 * @param documentId 文档ID
 * @param projectId 项目ID
 * @param fileName 文件名
 * @param fileType 文件类型
 * @param tempFilePath 临时文件路径
 * @param reportId 报告ID
 * @returns 任务ID
 */
export async function appendDocumentProcessingTask(
  documentId: string,
  projectId: string,
  fileName: string,
  fileType: string,
  tempFilePath: string,
  reportId?: string,
  size?: number
): Promise<string> {
  try {
    if (!documentQueue) {
      throw new Error('Document queue is not initialized');
    }
    const job = await documentQueue.add('process-document', {
      documentId,
      projectId,
      fileName,
      fileType,
      tempFilePath,
      reportId,
      createdAt: new Date().toISOString(),
      size: size || 0
    
    }, {
      jobId: documentId, // 显式指定 ID
    });

    // await setDocumentStatus(documentId, 'PENDING');
    logger.info({ jobId: job.id, reportId }, 'append new document processing task to queue');
    return job.id || '';
  } catch (error) {
    console.error('Failed to send document processing task:', error);
    throw error;
  }
}

/**
 * 更新文档处理进度
 * @param documentId 文档ID
 * @param fileName 文件名
 * @param progress 进度（0-100）
 * @param msg 进度消息
 * @param status 任务状态
 */
export async function updateDocumentProgress(documentId: string,fileName: string, progress: number, message: string, status: string = 'processing'): Promise<void> {
  try {
    // logger.info({ documentId, progress, message, status }, 'Updating document progress');

    // 1. 先更新任务队列状态（持久化）
    await documentQueue.updateJobProgress(documentId, progress);

    // 2. 【新增测试延迟】等待 3 秒，确保 SSE 订阅端已经连接并就绪
    logger.info({ documentId }, 'Waiting 3s before publishing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. 发布消息
    const sendMsg = JSON.stringify({ progress,fileName, message, status });
    const channel = `${DOCUMENT_STATUS_PREFIX}${documentId}`;

    logger.info({ documentId, channel, sendMsg }, 'Publishing progress update to channel');

    // 建议加上 await 确保发布动作完成
    await redisSubClient.publish(channel, sendMsg);

  } catch (error) {
    logger.error({ documentId, error }, 'Failed to update document progress');
    throw error;
  }
}



// 导出 BullMQ 队列
export { redisClient, redisSubClient,  documentQueue };
