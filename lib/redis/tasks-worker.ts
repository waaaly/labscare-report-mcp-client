/**
 * Tasks Worker - BullMQ Worker 处理任务
 *
 * 功能：
 * 1. 从 BullMQ 队列中获取任务
 * 2. 根据 USE_MOCK_LLM 决定使用模拟还是真实 Agent
 * 3. 执行 Agent 并发布流式结果到 Redis Stream
 * 4. 完善错误处理，防止进程崩溃重启
 */

import { Worker, Job, WorkerOptions } from "bullmq";
import { createAgentInstance } from "../llm/agent-factory";
import {
  publishStreamChunk,
  markStreamComplete,
  markStreamFailed,
} from "../queue/stream-publisher";
import { getRedisConfig, TASK_PROCESSOR_WORKER_NAME } from "./client";
import Pino from 'pino';
import prisma from "../prisma";
import { Task, TaskStatus } from '@prisma/client';
// ==================== 类型定义 ====================

export interface TaskProcessData {
  taskId: string;
  labId: string;
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

// ==================== 全局错误防护 ====================
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

/** 安全发布流式消息，防止单个 chunk 失败导致整个任务崩溃 */
async function safePublish(taskId: string, data: any, logger: Pino.Logger): Promise<void> {
  try {
    logger.info(`[Task Worker]: 发布${taskId}流消息,${JSON.stringify(data)}`);
    await publishStreamChunk(taskId, data);
  } catch (err) {
    logger.warn({ error: err, dataType: data.type }, `发布流消息失败，已跳过该 chunk`);
  }
}

/** 发布进度更新 */
async function publishProgress(taskId: string, progress: number, logger: Pino.Logger): Promise<void> {
  await safePublish(taskId, { type: "progress", progress }, logger);
}

/** 延迟函数 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** 更新 Task 状态和进度 */
async function updateTaskProgress(taskId: string, progress: number, status: TaskStatus): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: { progress, status },
  });
}

/** 创建 TaskLog 记录 */
async function createTaskLog(taskId: string, level: string, content: string, metadata?: any): Promise<void> {
  await prisma.taskLog.create({
    data: { taskId, level, content },
  });
}


function getJsonUrl(documentUrls: string[]): string | null {
  return documentUrls.find(url => url.toLowerCase().endsWith('.json')) || null;
}

async function getJsonDataSourceId(jsonUrl: string | null): Promise<string | null> {
  if (!jsonUrl) return null;
  try {
    const document = await prisma.document.findFirst({
      where: { url: jsonUrl },
    });
    return document?.id || null;
  } catch (error) {
    return null;
  }
}

/**
 * 模拟 LLM 调用过程（加强错误保护）
 * 同步更新 Task、TaskLog、Script 表
 */
async function simulateLLMCall(
  { taskId,
    reportId,
    labId,
    reportName,
    prompt,
    documentUrls,
    logger }: {
      taskId: string,
      labId: string,
      reportId: string,
      reportName: string,
      prompt: string,
      documentUrls: string[],
      logger: Pino.Logger
    }
): Promise<void> {

  const taskLogger = logger.child({ taskId, function: 'simulateLLMCall' });
  const startTime = Date.now();

  try {
    taskLogger.info(`开始模拟 LLM 调用流程`);

    // 更新 Task 状态为 running
    await updateTaskProgress(taskId, 0, TaskStatus.RUNNING);
    await publishProgress(taskId, 0, taskLogger);

    // 步骤 1: 读取模板占位符
    await updateTaskProgress(taskId, 10, TaskStatus.RUNNING);
    await publishProgress(taskId, 10, taskLogger);
    await safePublish(taskId, { type: "thought", text: "正在读取模板占位符..." }, taskLogger);
    await createTaskLog(taskId, 'INFO', '正在读取模板占位符...', { step: 1, progress: 10 });
    await delay(Math.random() * 30000);

    // 步骤 2: 分析报表脚本需求
    await updateTaskProgress(taskId, 25, TaskStatus.RUNNING);
    await publishProgress(taskId, 25, taskLogger);
    await safePublish(taskId, { type: "thought", text: "正在分析报表脚本需求..." }, taskLogger);
    await createTaskLog(taskId, 'INFO', '正在分析报表脚本需求...', { step: 2, progress: 25 });
    await delay(Math.random() * 60000);

    // 步骤 3: 调用工具获取规范
    await updateTaskProgress(taskId, 40, TaskStatus.RUNNING);
    await publishProgress(taskId, 40, taskLogger);
    await safePublish(taskId, {
      type: "tool_call",
      tool: "get_labscare_script_rules",
      message: "正在调用: get_labscare_script_rules...",
    }, taskLogger);
    await createTaskLog(taskId, 'INFO', '调用工具: get_labscare_script_rules', { step: 3, progress: 40 });
    await delay(Math.random() * 30000);

    // 步骤 4: 分析规范内容
    await updateTaskProgress(taskId, 50, TaskStatus.RUNNING);
    await publishProgress(taskId, 50, taskLogger);
    await safePublish(taskId, { type: "thought", text: "已获取 LabsCare 报表脚本规范，开始分析规范内容..." }, taskLogger);
    await createTaskLog(taskId, 'INFO', '已获取 LabsCare 报表脚本规范，开始分析规范内容...', { step: 4, progress: 50 });
    await delay(Math.random() * 60000);

    // 步骤 5: 分析报告模板
    await updateTaskProgress(taskId, 60, TaskStatus.RUNNING);
    await publishProgress(taskId, 60, taskLogger);
    await safePublish(taskId, { type: "thought", text: "正在分析报告模板和占位符..." }, taskLogger);
    await createTaskLog(taskId, 'INFO', '正在分析报告模板和占位符...', { step: 5, progress: 60 });
    await delay(Math.random() * 30000);

    // 步骤 6: 生成报表脚本
    await updateTaskProgress(taskId, 70, TaskStatus.RUNNING);
    await publishProgress(taskId, 70, taskLogger);
    await safePublish(taskId, { type: "thought", text: "开始生成报表脚本..." }, taskLogger);
    await createTaskLog(taskId, 'INFO', '开始生成报表脚本...', { step: 6, progress: 70 });
    await delay(Math.random() * 60000);

    const mockScript = `
      //javascript
      load("/tools.js")
      set('exceptionMsgLengthLimit', '10000');

      var helper = get("labscareHelper");
      var samples = helper.getProjectSamples(projectId);
      samples = JSON.stringify(samples);
      samples = JSON.parse(samples.replace(/null:/g,'"null":'))
      var procedures = helper.getProjectData(projectId);
      var templateId = '';
      var processId = '';
      for(var i in procedures){
          if (i.indexOf('310') === 0) {
              processId = i
          }
      }
      var procedure = procedures.get(processId);
      if (procedure) {
          for(var i in procedure.processes){
              if (i.indexOf('314') === 0) {
                  templateld = i
              }
          }
      }
      var samplesJs = JSON.parse(JSON.stringify(samples))
      var form = procedure.get('processes').get(templateld).get('form');
      var formJs = JSON.parse(JSON.stringify(form));
      var outputData = {"sample":samplesJs,"form":formJs};
      outputData
      `;

    const chunks = mockScript.split('\n');
    const chunkDelay = Math.floor((Math.random() * 30000) / Math.max(chunks.length, 1));
    const progressStep = 20 / Math.max(chunks.length, 1);
    let currentProgress = 70;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.trim()) {
        currentProgress += progressStep;
        if (currentProgress <= 90) {
          await updateTaskProgress(taskId, Math.round(currentProgress), TaskStatus.RUNNING);
          await publishProgress(taskId, Math.round(currentProgress), taskLogger);
        }
        await safePublish(taskId, { type: "content", text: chunk + '\n' }, taskLogger);
        await delay(chunkDelay);
      }
    }

    // 步骤 7: 检查生成的脚本
    await updateTaskProgress(taskId, 90, TaskStatus.RUNNING);
    await publishProgress(taskId, 90, taskLogger);
    await safePublish(taskId, { type: "thought", text: "正在检查生成的脚本..." }, taskLogger);
    await createTaskLog(taskId, 'INFO', '正在检查生成的脚本...', { step: 7, progress: 90 });
    await delay(Math.random() * 30000);

    // 步骤 8: 完成
    await updateTaskProgress(taskId, 95, TaskStatus.RUNNING);
    await publishProgress(taskId, 95, taskLogger);
    await safePublish(taskId, { type: "thought", text: "脚本生成完成，准备返回结果..." }, taskLogger);
    await delay(5000);

    
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { report: { select: { projectId: true } } },
    });

    if (task?.report) {
      // 这里简化处理，实际应该根据 documentUrls 找到对应的 Document ID
      const dataSourceId = await getJsonDataSourceId(getJsonUrl(documentUrls));
      if (!dataSourceId) {
        taskLogger.warn('未找到 JSON 数据源 ID');
        throw new Error('未找到 JSON 数据源 ID');
      }
      // 创建 Script 记录
      await prisma.script.create({
        data: {
          labId, 
          projectId: task.report.projectId,
          reportId,
          taskId,
          name: `${reportName}-Script-${taskId}`,
          code: mockScript,
          dataSourceId,
        },
      });
      taskLogger.info('Script 记录已创建');
    }

    // 更新 Task 为完成状态
    const duration = Date.now() - startTime;
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        progress: 100,
        duration,
        completedAt: new Date(),
      },
    });

    await createTaskLog(taskId, 'info', '任务执行完成', { step: 8, progress: 100, duration });
    await publishProgress(taskId, 100, taskLogger);

    taskLogger.info(`模拟 LLM 调用完成，总耗时 ${duration / 1000} 秒`);
  } catch (error) {
    taskLogger.error({ error }, 'simulateLLMCall 执行异常');

    // 更新 Task 为失败状态
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.FAILED,
      },
    }).catch(() => { });

    await createTaskLog(taskId, 'error', `任务执行失败: ${(error as Error).message}`).catch(() => { });

    throw error;
  }
}

/**
 * 真实 Agent 执行流式处理
 */
async function executeRealAgent(
  taskId: string,
  additionalInstructions: string,
  reportName: string,
  documentUrls: string[],
  logger: Pino.Logger
): Promise<{ tokensUsed?: number }> {
  const taskLogger = logger.child({ taskId, function: 'executeRealAgent' });

  const agent = await createAgentInstance();

  const prompt = additionalInstructions || `请根据报告 ${reportName} 生成分析结果`;

  // 保留你原来的 buildMessages（如果你有这个函数）
  const messages = await buildMessages(
    prompt,
    taskLogger,
    undefined,
    undefined,
    documentUrls.map(url => ({ name: url, type: 'url', content: url }))
  );

  let tokensUsed = 0;
  let firstTokenTime: number | null = null;
  let progress = 0;
  let totalChunks = 0;
  let processedChunks = 0;

  // 初始化进度
  await publishProgress(taskId, 0, taskLogger);

  const eventStream = await agent.stream(
    { messages },
    { streamMode: ['updates', 'messages'] }
  );

  // 预估总步骤数
  const estimatedSteps = 5; // 初始化、思考、工具调用、内容生成、完成
  const progressStep = 100 / estimatedSteps;

  for await (const event of eventStream) {
    try {
      totalChunks++;

      if (Array.isArray(event) && event.length === 2) {
        const [streamMode, chunk] = event;

        if (streamMode === "messages") {
          const [messageChunk, metadata] = chunk as [any, any];
          const currentNode = metadata?.langgraph_node;

          // 根据节点类型更新进度
          if (currentNode === "tools") {
            progress = progressStep * 2; // 工具调用阶段
            await publishProgress(taskId, Math.round(progress), taskLogger);
          } else if (currentNode === "generator") {
            progress = progressStep * 3; // 生成阶段
            await publishProgress(taskId, Math.round(progress), taskLogger);
          }

          const reasoning = messageChunk?.additional_kwargs?.reasoning_content;
          if (reasoning) {
            await safePublish(taskId, { type: "thought", text: reasoning }, taskLogger);
          }

          if (messageChunk?.content && typeof messageChunk.content === "string") {
            if (firstTokenTime === null) {
              firstTokenTime = Date.now();
              await safePublish(taskId, { type: "metrics", ttft: firstTokenTime }, taskLogger);
            }

            const messageType = currentNode === "tools" ? "thought" : "content";
            await safePublish(taskId, {
              type: messageType,
              node: currentNode,
              text: messageChunk.content,
            }, taskLogger);

            tokensUsed += Math.ceil(messageChunk.content.length / 4);

            // 根据处理的内容长度更新进度
            processedChunks++;
            const contentProgress = progressStep * 1.5 * (processedChunks / Math.max(totalChunks, 1));
            if (progress + contentProgress < 90) {
              await publishProgress(taskId, Math.round(progress + contentProgress), taskLogger);
            }
          }

          if (messageChunk?.tool_calls && messageChunk.tool_calls.length > 0) {
            for (const tc of messageChunk.tool_calls) {
              await safePublish(taskId, {
                type: "tool_call",
                tool: tc.name,
                message: `正在调用: ${tc.name}...`,
              }, taskLogger);
            }
          }
        } else if (streamMode === "updates") {
          progress = progressStep * 4; // 整合结果阶段
          await publishProgress(taskId, Math.round(progress), taskLogger);
          await safePublish(taskId, {
            type: "status",
            text: "工具执行完成，正在整合结果...",
          }, taskLogger);
        }
      }
    } catch (chunkError: any) {
      taskLogger.warn({ error: chunkError }, `处理 stream chunk 时出错，继续下一个`);
      continue;   // 重要：不让单个 chunk 失败导致整个 stream 崩溃
    }
  }

  // 完成进度
  await publishProgress(taskId, 100, taskLogger);

  // 可选：清理 agent 资源
  if (agent && typeof (agent as any).cleanup === 'function') {
    await (agent as any).cleanup().catch(() => { });
  }

  return { tokensUsed };
}

/**
 * 构建消息（保留你原来的函数）
 */
async function buildMessages(
  prompt: string,
  logger: Pino.Logger,
  contextJson?: string,
  messagesJson?: string,
  files?: Array<any>,
): Promise<Array<any>> {
  const { HumanMessage, AIMessage } = await import("@langchain/core/messages");

  const messages: Array<any> = [];

  if (messagesJson) {
    try {
      const history = JSON.parse(messagesJson);
      const recentMessages = history.slice(-10);

      for (const m of recentMessages) {
        let cleanContent = (m.content ?? '')
          .replace(/(\[状态\]|正在调用工具:).*?\n?/g, '')
          .trim();

        if (!cleanContent) continue;

        if (m?.role === 'user') {
          messages.push(new HumanMessage(cleanContent));
        } else if (m?.role === 'assistant') {
          messages.push(new AIMessage(cleanContent));
        }
      }
    } catch (e) {
      logger.error({ error: e }, '[Worker] 解析消息历史失败');
    }
  }

  let userText = prompt || '';
  if (contextJson) {
    userText += `\n\n[Context]\n\`\`\`json\n${contextJson}\n\`\`\`\n`;
  }

  const messageContent: any[] = [{ type: 'text', text: userText.trim() }];

  if (files) {
    for (const file of files) {
      if (file.type === 'image' && file.dataUrl) {
        messageContent.push({
          type: 'image_url',
          image_url: { url: file.dataUrl }
        });
      }
    }
  }

  messages.push(new HumanMessage({ content: messageContent }));

  return messages;
}

// ==================== 核心处理器 ====================

async function processor(job: Job<TaskProcessData>, logger: Pino.Logger): Promise<TaskProcessResult> {
  const { taskId, labId, reportId, reportName, additionalInstructions, documentUrls } = job.data;
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

    const useMock = process.env.USE_MOCK_LLM === 'true';

    let tokensUsed = 0;

    if (useMock) {
      taskLogger.info(`使用模拟 LLM 模式`);
      await simulateLLMCall({labId, taskId, reportId, reportName, prompt: additionalInstructions, documentUrls, logger: taskLogger });
      tokensUsed = 123;
    } else {
      taskLogger.info(`使用真实 LLM Agent 模式`);
      const result = await executeRealAgent(
        taskId,
        additionalInstructions,
        reportName,
        documentUrls,
        taskLogger
      );
      tokensUsed = result.tokensUsed || 0;
    }

    const duration = Date.now() - startTime;

    // 标记流式完成
    await markStreamComplete(taskId, {
      type: "metrics",
      total_duration: duration,
      tokensUsed,
    }).catch(err => {
      taskLogger.warn({ error: err }, '标记完成状态失败');
    });

    taskLogger.info(`✅ 任务处理完成，耗时 ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      duration,
      tokensUsed,
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    taskLogger.error(`❌ 任务处理失败，耗时 ${duration}s | 错误: ${error.message}`);

    await handleError(taskId, error, taskLogger, '任务处理异常').catch(() => { });

    throw error; // 让 BullMQ 标记为 failed，支持自动重试
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
    concurrency: Number(process.env.WORKER_CONCURRENCY || 2), // 建议 mock 模式用 2~3，真实 LLM 先用 1~2
    lockDuration: 600_000,     // 10 分钟
    stalledInterval: 30_000,
    maxStalledCount: 2,
  };

  workerInstance = new Worker<TaskProcessData, TaskProcessResult>(
    TASK_PROCESSOR_WORKER_NAME,
    (job) => processor(job, logger),
    workerOptions
  );

  // 事件监听
  workerInstance.on('error', (err: Error) => {
    logger.error({ error: err }, '[Worker] 全局 Worker 错误');
  });

  workerInstance.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error: error?.message }, '[Worker] Job 执行失败');
  });

  workerInstance.on('stalled', (jobId) => {
    logger.warn({ jobId }, '[Worker] Job 已 stalled，可能发生阻塞');
  });

  workerInstance.on('completed', (job) => {
    logger.info({ jobId: job.id }, '[Worker] Job 已完成');
  });

  global.taskWorker = workerInstance;
  logger.info(`PID: ${process.pid} Tasks processor started with BullMQ (USE_MOCK_LLM=${process.env.USE_MOCK_LLM})`);
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