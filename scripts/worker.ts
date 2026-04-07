// scripts/worker.ts
import dotenv from 'dotenv';
// 1. 必须在所有业务逻辑之前加载环境变量
dotenv.config();
process.env.IS_WORKER = 'true'; // 必须在 import logger 之前设置
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  transport:
  {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  }
});

// 你可以给单独的进程加一个子日志器
const workerLogger = logger.child({ component: 'Worker', });
import { startDocumentProcessor , shutdownDocumentProcessor } from '../lib/redis/doc-upload-worker';
import { startTasksProcessor } from '../lib/redis/tasks-worker';

console.log('🚀 独立 Worker 进程正在启动...');

// 依次启动所有 Worker
startDocumentProcessor(workerLogger);
startTasksProcessor(workerLogger);

// 处理优雅退出
process.on('SIGTERM', () => {
  shutdownDocumentProcessor(workerLogger);
  process.exit(0);
});