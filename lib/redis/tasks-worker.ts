/**
 * Tasks Worker - BullMQ Worker 处理任务
 *
 * 功能：
 * 1. 从 BullMQ 队列中获取任务
 * 2. 执行模拟或真实 Agent
 * 3. 发布流式结果到 Redis Stream
 * 4. 完善错误处理，防止进程崩溃
 */

import { Worker, Job, WorkerOptions } from "bullmq";
import {
  publishStreamChunk,
  markStreamComplete,
  markStreamFailed,
} from "../queue/stream-publisher";
import { getRedisConfig, TASK_PROCESSOR_WORKER_NAME } from "./client";
import Pino from 'pino';

// ==================== 类型定义 ====================

export interface TaskProcessData {
  taskId: string;
  name: string;
  reportId: string;
  reportName: string;
  additionalInstructions: string;
  documentUrls: string[];
  advancedParams: {
    temperature: number;
    maxTokens: number;
    model: string;
  };
  createdAt: number;
}

export interface TaskProcessResult {
  success: boolean;
  duration: number;
  tokensUsed?: number;
}

// 全局单例
declare global {
  var taskWorker: Worker | undefined;
}

// ==================== 全局防护（防止未知错误导致进程重启） ====================
function setupGlobalErrorHandlers(logger: Pino.Logger) {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason }, '【严重】Unhandled Rejection - 可能导致进程崩溃');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, '【致命】Uncaught Exception - 进程即将崩溃');
    setTimeout(() => process.exit(1), 1500);
  });
}

// ==================== 工具函数 ====================

async function handleError(
  taskId: string,
  error: unknown,
  logger: Pino.Logger,
  stage: string
): Promise<void> {
  const err = error as Error;
  logger.error({ taskId, error: err.message, stack: err.stack }, `[Worker] ${stage}`);

  try {
    await markStreamFailed(taskId, err);
  } catch (cleanupErr) {
    logger.error({ taskId, error: cleanupErr }, `[Worker] 标记失败状态时出错`);
  }
}

/**
 * 模拟 LLM 调用过程（已加强错误保护）
 */
async function simulateLLMCall(
  taskId: string,
  prompt: string,
  documentUrls: string[],
  logger: Pino.Logger
): Promise<void> {
  const taskLogger = logger.child({ taskId, function: 'simulateLLMCall' });
  const startTime = Date.now();

  try {
    taskLogger.info(`开始模拟 LLM 调用流程`);

    await safePublish(taskId, { type: "thought", text: "正在读取模板占位符..." }, taskLogger);
    await delay(Math.random() * 30000 + 30000);

    await safePublish(taskId, { type: "thought", text: "正在分析报表脚本需求..." }, taskLogger);
    await delay(Math.random() * 60000 + 60000);

    await safePublish(taskId, {
      type: "tool_call",
      tool: "get_labscare_script_rules",
      message: "正在调用: get_labscare_script_rules...",
    }, taskLogger);
    await delay(Math.random() * 30000 + 30000);

    await safePublish(taskId, { type: "thought", text: "已获取 LabsCare 报表脚本规范，开始分析规范内容..." }, taskLogger);
    await delay(Math.random() * 60000 + 60000);

    await safePublish(taskId, { type: "thought", text: "正在分析报告模板和占位符..." }, taskLogger);
    await delay(Math.random() * 30000 + 30000);

    await safePublish(taskId, { type: "thought", text: "开始生成报表脚本..." }, taskLogger);
    await delay(Math.random() * 60000 + 60000);

    // 生成模拟脚本并分块发送
    const mockScript = `
// 报表脚本 - 基于模拟生成
const reportScript = {
  name: "Sample Report Script",
  version: "1.0.0",
  description: "生成实验室报告",
  fields: [
    { name: "patientId", type: "string", source: "patient.id", required: true },
    { name: "patientName", type: "string", source: "patient.name", required: true },
    { name: "reportDate", type: "date", source: "metadata.reportDate", format: "YYYY-MM-DD" },
    { name: "labName", type: "string", source: "metadata.labName" }
  ],
  generate: function(data) {
    return {
      patientId: data.patient.id,
      patientName: data.patient.name,
      reportDate: data.metadata.reportDate,
      labName: data.metadata.labName
    };
  }
};
module.exports = reportScript;
`;

    const chunks = mockScript.split('\n');
    const chunkDelay = Math.floor((Math.random() * 30000 + 30000) / Math.max(chunks.length, 1));

    for (const chunk of chunks) {
      if (chunk.trim()) {
        await safePublish(taskId, { type: "content", text: chunk + '\n' }, taskLogger);
        await delay(chunkDelay);
      }
    }

    await safePublish(taskId, { type: "thought", text: "正在检查生成的脚本..." }, taskLogger);
    await delay(Math.random() * 30000 + 30000);

    await safePublish(taskId, { type: "thought", text: "脚本生成完成，准备返回结果..." }, taskLogger);
    await delay(5000);

    taskLogger.info(`模拟 LLM 调用完成，总耗时 ${(Date.now() - startTime) / 1000} 秒`);
  } catch (error) {
    taskLogger.error({ error }, 'simulateLLMCall 执行异常');
    throw error;
  }
}

/** 安全发布流式消息，防止单个 publish 失败导致整个任务崩溃 */
async function safePublish(taskId: string, data: any, logger: Pino.Logger): Promise<void> {
  try {
    await publishStreamChunk(taskId, data);
  } catch (err) {
    logger.warn({ error: err, dataType: data.type }, `发布流消息失败，已跳过该 chunk`);
    // 不抛出异常，继续执行后续流程
  }
}

/** 延迟函数 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== 核心处理器 ====================

async function processor(job: Job<TaskProcessData>, logger: Pino.Logger): Promise<TaskProcessResult> {
  const { taskId, name, reportId, reportName, additionalInstructions, documentUrls } = job.data;
  const jobId = job.id!;
  const startTime = Date.now();

  const taskLogger = logger.child({
    component: "TasksWorker",
    jobId,
    taskId,
    reportId,
    reportName,
  });

  try {
    taskLogger.info(`🚀 开始处理任务`);

    // 当前使用模拟模式
    await simulateLLMCall(taskId, additionalInstructions || name, documentUrls, taskLogger);

    const duration = Date.now() - startTime;

    // 标记完成
    await markStreamComplete(taskId, {
      type: "metrics",
      total_duration: duration,
      tokensUsed: 123,
    }).catch(err => {
      taskLogger.warn({ error: err }, '标记流完成时失败');
    });

    taskLogger.info(`✅ 模拟任务处理完成，耗时 ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      duration,
      tokensUsed: 123,
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    taskLogger.error(`❌ 任务处理失败，耗时 ${duration}s | 错误: ${error.message}`);

    await handleError(taskId, error, taskLogger, '任务处理异常').catch(() => {});

    throw error; // 让 BullMQ 标记为 failed，支持重试
  }
}

// ==================== Worker 启动 ====================

let workerInstance: Worker | null = null;

export function startTasksProcessor(logger: Pino.Logger): void {
  if (global.taskWorker) {
    logger.info('Tasks processor already started');
    return;
  }

  // 全局错误防护
  setupGlobalErrorHandlers(logger);

  const workerOptions: WorkerOptions = {
    connection: getRedisConfig(),
    concurrency: Number(process.env.WORKER_CONCURRENCY || 2), // mock 模式下建议先用 2，稳定后再调高
    lockDuration: 300_000,   // 5 分钟（模拟模式不需要太长）
    stalledInterval: 30_000,
    maxStalledCount: 2,
  };

  workerInstance = new Worker<TaskProcessData, TaskProcessResult>(
    TASK_PROCESSOR_WORKER_NAME,
    (job) => processor(job, logger),
    workerOptions
  );

  // 事件监听优化
  workerInstance.on('error', (err: Error) => {
    logger.error({ error: err }, '[Worker] 全局 Worker 错误');
  });

  workerInstance.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error: error?.message }, '[Worker] Job 执行失败');
  });

  workerInstance.on('stalled', (jobId) => {
    logger.warn({ jobId }, '[Worker] Job 已 stalled，可能发生长时间阻塞');
  });

  workerInstance.on('completed', (job) => {
    logger.info({ jobId: job.id }, '[Worker] Job 已完成');
  });

  global.taskWorker = workerInstance;
  logger.info(`PID: ${process.pid} Tasks processor started with BullMQ (Mock Mode)`);
}

// ==================== Graceful Shutdown ====================

export async function shutdownTasksProcessor(logger: Pino.Logger): Promise<void> {
  if (global.taskWorker) {
    logger.info('Shutting down tasks worker...');
    await global.taskWorker.close();
    global.taskWorker = undefined;
    logger.info('Tasks worker closed');
  }
}

// 导出
export { workerInstance as worker };