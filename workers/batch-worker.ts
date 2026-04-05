/**
 * Batch Worker - BullMQ Worker 处理批量任务
 *
 * 功能：
 * 1. 从 BullMQ 队列中获取任务
 * 2. 创建 Agent 实例
 * 3. 执行 Agent 并发布流式结果到 Redis Stream
 * 4. 错误处理和重试
 */

import { Worker, Job } from "bullmq";
import { logger } from "../lib/logger";
import { createAgentInstance } from "../lib/llm/agent-factory";
import {
  publishStreamChunk,
  markStreamComplete,
  markStreamFailed,
} from "../lib/queue/stream-publisher";

// ===== Redis 配置 =====

function getRedisConfig() {
  return {
    host: process.env.REDIS_URL?.split('://')[1].split(':')[0] || 'localhost',
    port: Number(process.env.REDIS_URL?.split(':')[2].split('/')[0]) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB) || 0
  };
}

const redisConfig = getRedisConfig();

// ===== Worker 配置 =====

const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 3);

// ===== 类型定义 =====

export interface ReportTaskData {
  jobId: string;
  batchId: string;
  prompt: string;
  contextJson?: string;
  messagesJson?: string;
  files?: Array<{
    name: string;
    type: 'image' | 'json' | 'md';
    content: string;
    dataUrl?: string;
  }>;
}

export interface ReportTaskResult {
  success: boolean;
  duration: number;
  tokensUsed?: number;
}

// ===== 创建 Worker =====

const worker = new Worker<ReportTaskData, ReportTaskResult>(
  "report",
  async (job: Job<ReportTaskData>) => {
    const { jobId, batchId, prompt, contextJson, messagesJson, files } = job.data;
    const startTime = Date.now();

    logger.info({ jobId, batchId, prompt: prompt.substring(0, 100), filesCount: files?.length || 0 }, `[Worker] 开始处理任务: ${jobId}`);

    try {
      // 检查是否启用模拟模式
      const useMock = process.env.USE_MOCK_LLM === 'true';

      if (useMock) {
        logger.info({ jobId }, `[Worker] 使用模拟 LLM 模式`);

        // 模拟 LLM 调用过程
        await simulateLLMCall(jobId, prompt);

        // 标记完成
        const duration = Date.now() - startTime;
        await markStreamComplete(jobId, {
          type: "metrics",
          total_duration: duration,
          tokensUsed: 123,
        });

        logger.info({ jobId, duration }, `[Worker] 模拟任务完成: ${jobId}`);

        return {
          success: true,
          duration,
        };
      } else {
        // 1. 创建 Agent 实例
        const agent = await createAgentInstance();

        // 2. 构建消息
        const messages = await buildMessages(prompt, contextJson, messagesJson, files);

        // 3. 执行 Agent 并发布流式结果
        const result = await executeAgentStreaming(jobId, agent, messages);

        // 4. 标记完成
        const duration = Date.now() - startTime;
        await markStreamComplete(jobId, {
          type: "metrics",
          total_duration: duration,
          ...result,
        });

        logger.info({ jobId, duration }, `[Worker] 任务完成: ${jobId}`);

        return {
          success: true,
          duration,
        };
      }

    } catch (error) {
      const err = error as Error;
      logger.error({ jobId, error: err.message, stack: err.stack }, `[Worker] 任务失败: ${jobId}`);

      await markStreamFailed(jobId, err);
      throw error; // 让 BullMQ 处理重试
    }
  },
  {
    concurrency: WORKER_CONCURRENCY,
    connection: redisConfig,
  }
);

// ===== Worker 事件处理 =====

worker.on('error', (err) => {
  logger.error({ err }, '[Worker] Worker error');
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, attempts: job.attemptsMade, processedOn: job.processedOn, finishedOn: job.finishedOn }, `[Worker] Job completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, attempts: job?.attemptsMade, error: err.message }, `[Worker] Job failed: ${job?.id}`);
});

worker.on('progress', (job, progress) => {
  logger.debug({ jobId: job.id, progress }, `[Worker] Job progress: ${job.id}`);
});

// ===== 辅助函数 =====

/**
 * 构建消息
 */
async function buildMessages(
  prompt: string,
  contextJson?: string,
  messagesJson?: string,
  files?: Array<any>
): Promise<Array<any>> {
  const { HumanMessage, AIMessage } = await import("@langchain/core/messages");

  const messages: Array<any> = [];

  // 处理历史消息
  if (messagesJson) {
    try {
      const history = JSON.parse(messagesJson);
      const recentMessages = history.slice(-10); // 只取最后10条

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

  // 构建当前消息
  let userText = prompt || '';
  if (contextJson) {
    userText += `\n\n[Context]\n\`\`\`json\n${contextJson}\n\`\`\`\n`;
  }

  // 处理文件
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
  jobId: string,
  agent: any,
  messages: any[]
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

        // 提取深度思考
        const reasoning = messageChunk.additional_kwargs?.reasoning_content;
        if (reasoning) {
          await publishStreamChunk(jobId, {
            type: "thought",
            text: reasoning,
          });
        }

        // 提取正式回答
        if (messageChunk?.content && typeof messageChunk.content === "string") {
          if (firstTokenTime === null) {
            firstTokenTime = Date.now();
            await publishStreamChunk(jobId, {
              type: "metrics",
              ttft: firstTokenTime,
            });
          }

          const messageType = currentNode === "tools" ? "thought" : "content";
          await publishStreamChunk(jobId, {
            type: messageType,
            node: currentNode,
            text: messageChunk.content,
          });

          // 估算 token 数量（粗略估算）
          tokensUsed += Math.ceil(messageChunk.content.length / 4);
        }

        // 提取工具调用
        if (messageChunk?.tool_calls && messageChunk.tool_calls.length > 0) {
          for (const tc of messageChunk.tool_calls) {
            await publishStreamChunk(jobId, {
              type: "tool_call",
              tool: tc.name,
              message: `正在调用: ${tc.name}...`,
            });
          }
        }
      } else if (streamMode === "updates") {
        await publishStreamChunk(jobId, {
          type: "status",
          text: "工具执行完成，正在整合结果...",
        });
      }
    }
  }

  return { tokensUsed };
}

// ===== 优雅关闭 =====

process.on('SIGTERM', async () => {
  logger.info('[Worker] 收到 SIGTERM，正在关闭...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[Worker] 收到 SIGINT，正在关闭...');
  await worker.close();
  process.exit(0);
});

/**
 * 模拟 LLM 调用过程
 * @param jobId 任务 ID
 * @param prompt 提示词
 */
async function simulateLLMCall(jobId: string, prompt: string): Promise<void> {
  // 总模拟时间：5-7分钟（300000-420000毫秒）
  const totalDuration = Math.floor(Math.random() * 120000) + 300000;
  const startTime = Date.now();

  // 模拟思考过程（1-2分钟）
  await publishStreamChunk(jobId, {
    type: "thought",
    text: "正在分析报表脚本需求...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 60000 + 60000));

  // 模拟工具调用（30-60秒）
  await publishStreamChunk(jobId, {
    type: "tool_call",
    tool: "get_labscare_script_rules",
    message: "正在调用: get_labscare_script_rules...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 30000 + 30000));

  // 模拟工具执行结果（1-2分钟）
  await publishStreamChunk(jobId, {
    type: "thought",
    text: "已获取 LabsCare 报表脚本规范，开始分析规范内容...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 60000 + 60000));

  // 模拟分析模板（30-60秒）
  await publishStreamChunk(jobId, {
    type: "thought",
    text: "正在分析报告模板和占位符...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 30000 + 30000));

  // 模拟生成过程（1-2分钟）
  await publishStreamChunk(jobId, {
    type: "thought",
    text: "开始生成报表脚本...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 60000 + 60000));

  // 模拟生成结果（1-2分钟）
  const mockScript = `
// 报表脚本 - 基于模拟生成
const reportScript = {
  name: "Sample Report Script",
  version: "1.0.0",
  description: "生成实验室报告",
  fields: [
    {
      name: "patientId",
      type: "string",
      source: "patient.id",
      required: true
    },
    {
      name: "patientName",
      type: "string",
      source: "patient.name",
      required: true
    },
    {
      name: "testResults",
      type: "array",
      source: "tests.results",
      required: true,
      process: function(results) {
        return results.map(test => ({
          name: test.name,
          value: test.value,
          unit: test.unit,
          referenceRange: test.referenceRange,
          status: this.calculateStatus(test.value, test.referenceRange)
        }));
      }
    },
    {
      name: "reportDate",
      type: "date",
      source: "metadata.reportDate",
      format: "YYYY-MM-DD"
    },
    {
      name: "labName",
      type: "string",
      source: "metadata.labName"
    }
  ],
  
  calculateStatus: function(value, referenceRange) {
    if (!referenceRange) return "normal";
    
    const [min, max] = referenceRange.split('-').map(Number);
    if (value < min || value > max) {
      return "abnormal";
    }
    return "normal";
  },
  
  generate: function(data) {
    return {
      patientId: data.patient.id,
      patientName: data.patient.name,
      reportDate: this.formatDate(data.metadata.reportDate),
      labName: data.metadata.labName,
      testResults: this.fields.find(f => f.name === "testResults").process(data.tests.results),
      summary: this.generateSummary(data.tests.results)
    };
  },
  
  formatDate: function(date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },
  
  generateSummary: function(results) {
    const abnormalCount = results.filter(test => {
      const referenceRange = test.referenceRange;
      if (!referenceRange) return false;
      const [min, max] = referenceRange.split('-').map(Number);
      return test.value < min || test.value > max;
    }).length;
    
    if (abnormalCount === 0) {
      return "所有检测结果正常";
    } else if (abnormalCount === 1) {
      return "有一项检测结果异常";
    } else {
      return "有 " + abnormalCount + " 项检测结果异常";
    }
  }
};

// 导出脚本
module.exports = reportScript;
`;

  // 分段发送生成结果（30-60秒）
  const chunks = mockScript.split('\n');
  const chunkDelay = Math.floor((Math.random() * 30000 + 30000) / chunks.length);

  for (const chunk of chunks) {
    if (chunk.trim()) {
      await publishStreamChunk(jobId, {
        type: "content",
        text: chunk + '\n',
      });
      await new Promise(resolve => setTimeout(resolve, chunkDelay));
    }
  }

  // 模拟最终检查（30-60秒）
  await publishStreamChunk(jobId, {
    type: "thought",
    text: "正在检查生成的脚本...",
  });
  await new Promise(resolve => setTimeout(resolve, Math.random() * 30000 + 30000));

  // 模拟完成
  await publishStreamChunk(jobId, {
    type: "thought",
    text: "脚本生成完成，准备返回结果...",
  });
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 确保总时间在5-7分钟之间
  const elapsed = Date.now() - startTime;
  if (elapsed < totalDuration) {
    await new Promise(resolve => setTimeout(resolve, totalDuration - elapsed));
  }
}

// 导出 worker（用于测试）
export { worker };
