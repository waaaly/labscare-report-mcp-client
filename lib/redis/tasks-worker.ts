/**
 * Tasks Worker - BullMQ Worker 处理任务
 *
 * 功能：
 * 1. 从 BullMQ 队列中获取任务
 * 2. 创建 Agent 实例
 * 3. 执行 Agent 并发布流式结果到 Redis Stream
 * 4. 错误处理和重试
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

// 全局单例（防止多实例启动）
declare global {
  var taskWorker: Worker | undefined;
}

// ==================== 工具函数 ====================

async function handleError(
  taskId: string,
  error: unknown,
  logger: Pino.Logger,
  stage: string
): Promise<void> {
  const err = error as Error;
  const msg = `${stage}: ${err.message}`;
  
  logger.error({ taskId, error: err.message, stack: err.stack }, `[Worker] ${msg}`);
  
  try {
    await markStreamFailed(taskId, err);
  } catch (cleanupErr) {
    logger.error({ taskId, error: cleanupErr }, `[Worker] 清理失败`);
  }
}

/**
 * 构建消息
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

/**
 * 执行 Agent 并发布流式结果
 */
async function executeAgentStreaming(
  taskId: string,
  agent: any,
  messages: any[],
  logger: Pino.Logger
): Promise<{ tokensUsed?: number }> {
  let firstTokenTime: number | null = null;
  let tokensUsed = 0;

  const eventStream = await agent.stream(
    { messages },
    { streamMode: ['updates', 'messages'] }
  );

  for await (const event of eventStream) {
    if (Array.isArray(event) && event.length === 2) {
      const [streamMode, chunk] = event;

      if (streamMode === "messages") {
        const [messageChunk, metadata] = chunk as [any, any];
        const currentNode = metadata.langgraph_node;

        const reasoning = messageChunk.additional_kwargs?.reasoning_content;
        if (reasoning) {
          await publishStreamChunk(taskId, {
            type: "thought",
            text: reasoning,
          });
        }

        if (messageChunk?.content && typeof messageChunk.content === "string") {
          if (firstTokenTime === null) {
            firstTokenTime = Date.now();
            await publishStreamChunk(taskId, {
              type: "metrics",
              ttft: firstTokenTime,
            });
          }

          const messageType = currentNode === "tools" ? "thought" : "content";
          await publishStreamChunk(taskId, {
            type: messageType,
            node: currentNode,
            text: messageChunk.content,
          });

          tokensUsed += Math.ceil(messageChunk.content.length / 4);
        }

        if (messageChunk?.tool_calls && messageChunk.tool_calls.length > 0) {
          for (const tc of messageChunk.tool_calls) {
            await publishStreamChunk(taskId, {
              type: "tool_call",
              tool: tc.name,
              message: `正在调用: ${tc.name}...`,
            });
          }
        }
      } else if (streamMode === "updates") {
        await publishStreamChunk(taskId, {
          type: "status",
          text: "工具执行完成，正在整合结果...",
        });
      }
    }
  }

  return { tokensUsed };
}

/**
 * 模拟 LLM 调用过程
 */
async function simulateLLMCall(taskId: string, prompt: string, logger: Pino.Logger): Promise<void> {
  const totalDuration = Math.floor(Math.random() * 120000) + 300000;
  const startTime = Date.now();

  await publishStreamChunk(taskId, {
    type: "thought",
    text: "正在分析报表脚本需求...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 60000 + 60000));

  await publishStreamChunk(taskId, {
    type: "tool_call",
    tool: "get_labscare_script_rules",
    message: "正在调用: get_labscare_script_rules...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 30000 + 30000));

  await publishStreamChunk(taskId, {
    type: "thought",
    text: "已获取 LabsCare 报表脚本规范，开始分析规范内容...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 60000 + 60000));

  await publishStreamChunk(taskId, {
    type: "thought",
    text: "正在分析报告模板和占位符...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 30000 + 30000));

  await publishStreamChunk(taskId, {
    type: "thought",
    text: "开始生成报表脚本...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 60000 + 60000));

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
  const chunkDelay = Math.floor((Math.random() * 30000 + 30000) / chunks.length);

  for (const chunk of chunks) {
    if (chunk.trim()) {
      await publishStreamChunk(taskId, {
        type: "content",
        text: chunk + '\n',
      });
      await new Promise(resolve => setTimeout(resolve, chunkDelay));
    }
  }

  await publishStreamChunk(taskId, {
    type: "thought",
    text: "正在检查生成的脚本...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 30000 + 30000));

  await publishStreamChunk(taskId, {
    type: "thought",
    text: "脚本生成完成，准备返回结果...",
  });
  await new Promise(resolve => setTimeout(resolve, 5000));

  const elapsed = Date.now() - startTime;
  if (elapsed < totalDuration) {
    await new Promise(resolve => setTimeout(resolve, totalDuration - elapsed));
  }
}

// ==================== 核心处理器 ====================

async function processor(job: Job<TaskProcessData>, logger: Pino.Logger): Promise<TaskProcessResult> {
  const { taskId, name, reportId, reportName, additionalInstructions, documentUrls, advancedParams } = job.data;
  const jobId = job.id;
  const startTime = Date.now();

  const taskLogger = logger.child({
    component: "TasksWorker",
    jobId,
    taskId,
    reportId,
    reportName
  });

  try {
    taskLogger.info(`🚀 开始处理任务`);

    const useMock = process.env.USE_MOCK_LLM === 'true';

    if (useMock) {
      taskLogger.info(`使用模拟 LLM 模式`);

      await simulateLLMCall(taskId, additionalInstructions || name, taskLogger);

      const duration = Date.now() - startTime;
      await markStreamComplete(taskId, {
        type: "metrics",
        total_duration: duration,
        tokensUsed: 123,
      });

      taskLogger.info(`✅ 模拟任务完成，耗时 ${(duration / 1000).toFixed(1)}s`);

      return {
        success: true,
        duration,
        tokensUsed: 123,
      };
    } else {
      const agent = await createAgentInstance();

      const prompt = additionalInstructions || `请根据报告 ${reportName} 生成分析结果`;
      const messages = await buildMessages(prompt, taskLogger, undefined, undefined, 
        documentUrls.map(url => ({ name: url, type: 'url', content: url }))
      );

      const result = await executeAgentStreaming(taskId, agent, messages, taskLogger);

      const duration = Date.now() - startTime;
      await markStreamComplete(taskId, {
        type: "metrics",
        total_duration: duration,
        ...result,
      });

      taskLogger.info(`✅ 任务完成，耗时 ${(duration / 1000).toFixed(1)}s`);

      return {
        success: true,
        duration,
        ...result,
      };
    }

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    taskLogger.error(`❌ 任务处理失败，耗时 ${duration}s | 错误: ${error.message}`);
    await handleError(taskId, error, taskLogger, '任务处理异常');
    throw error;
  }
}

// ==================== Worker 启动 ====================

let workerInstance: Worker | null = null;

export function startTasksProcessor(logger: Pino.Logger): void {
  if (global.taskWorker) {
    logger.info('Tasks processor already started');
    return;
  }

  const workerOptions: WorkerOptions = {
    connection: getRedisConfig(),
    concurrency: Number(process.env.WORKER_CONCURRENCY || 3),
    lockDuration: 600_000,
    stalledInterval: 30_000,
    maxStalledCount: 2,
  };

  workerInstance = new Worker<TaskProcessData, TaskProcessResult>(
    TASK_PROCESSOR_WORKER_NAME,
    (job) => processor(job, logger),
    workerOptions
  );

  const events = ['active', 'completed', 'failed', 'progress', 'error', 'stalled'] as const;
  events.forEach((event) => {
    workerInstance!.on(event, (job: Job, error?: Error) => {
      try {
        if (event === 'error') {
          logger.error(`Worker error: ${job}`);
        } else if (event === 'failed') {
          logger.error(`Job ${job?.id || 'unknown'} failed: ${error?.message}`);
        } else {
          logger.info(`Job ${job?.id} ${event}`);
        }
      } catch (e) {
        logger.error(`Event handler error (${event}): ${e}`);
      }
    });
  });

  global.taskWorker = workerInstance;
  logger.info(`PID: ${process.pid} Tasks processor started with BullMQ`);
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
