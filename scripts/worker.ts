// scripts/worker.ts
import dotenv from 'dotenv';
// 1. 必须在所有业务逻辑之前加载环境变量
dotenv.config();
import { startDocumentProcessor } from '../lib/redis/doc-upload-worker';
import { startTasksProcessor } from '../lib/redis/tasks-worker';

console.log('🚀 独立 Worker 进程正在启动...');

// 依次启动所有 Worker
startDocumentProcessor();
startTasksProcessor();

// 处理优雅退出
process.on('SIGTERM', () => {
  console.log('正在关闭 Worker...');
  process.exit(0);
});