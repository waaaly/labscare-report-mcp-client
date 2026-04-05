# 高吞吐量 LLM Pipeline 架构升级方案

## 文档信息

| 项目 | 内容 |
|------|------|
| 版本 | v2.0 |
| 状态 | 设计阶段 |
| 最后更新 | 2026-04-03 |
| 适用范围 | LabsCare 报表生成系统 |

---

## 目录

1. [现状分析](#现状分析)
2. [改造目标](#改造目标)
3. [技术架构设计](#技术架构设计)
4. [核心改造点](#核心改造点)
5. [并发控制设计](#并发控制设计)
6. [任务状态机设计](#任务状态机设计)
7. [错误处理与重试](#错误处理与重试)
8. [可观测性设计](#可观测性设计)
9. [API 设计](#api-设计)
10. [前端设计方案](#前端设计方案)
11. [安全性设计](#安全性设计)
12. [部署架构](#部署架构)
13. [分阶段实施方案](#分阶段实施方案)
14. [配置管理](#配置管理)
15. [成本评估](#成本评估)

---

## 现状分析

### 当前系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  app/api/llm/route.ts                              │    │
│  │  - 单任务处理                                       │    │
│  │  - 返回 SSE 流                                      │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  lib/llm/reactAgent.ts                             │    │
│  │  - 全局 Agent 单例                                  │    │
│  │  - createAgent({llm, tools})                       │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  lib/llm/skill-loader.ts                           │    │
│  │  - 加载 LabsCare 脚本规范                           │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                        LLM Provider
                    (OpenRouter/OpenAI)
```

### 当前实现细节

**Agent 定义** (lib/llm/reactAgent.ts:123)
```typescript
export const agent = await initializeAgent();

async function initializeAgent() {
  const labscareTool = await loadKnowledgeSkill(skillPath);
  return createAgent({
    model: llm,
    tools: [labscareTool],
    systemPrompt: "..."
  });
}
```

**API 路由** (app/api/llm/route.ts)
```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const messages = await buildMessages(formData);

  // 直接调用全局 agent
  const eventStream = await agent.stream(
    { messages },
    { streamMode: ['updates', 'messages'] }
  );

  // 返回 SSE 流
  return new Response(runtimeStream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

**前端流式接收** (app/conversation/page.tsx:244-320)
```typescript
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // 解析 SSE 消息
  if (line.startsWith('data: ')) {
    const json = JSON.parse(line.slice(6));
    // 处理 content/thought/tool_call/status
  }
}
```

### 存在的问题

| 问题类别 | 具体问题 | 影响 |
|---------|---------|------|
| **并发能力** | 只能处理单个并发任务 | 批量处理效率低 |
| **任务隔离** | 全局 Agent 单例 | 多任务状态冲突风险 |
| **扩展性** | 无法水平扩展 | 吞吐量受限 |
| **可靠性** | 无任务持久化 | 重启丢失任务 |
| **监控** | 缺少指标收集 | 无法观察系统状态 |

---

## 改造目标

### 核心目标

✅ **保留现有 Agent + Skill 能力**
✅ **支持批量并发任务**
✅ **保留 Streaming 实时体验**
✅ **可扩展到生产级高吞吐量**

### 量化指标

| 指标 | 当前 | 目标 |
|-----|------|------|
| 并发任务数 | 1 | 50+ |
| 任务吞吐量 | ~1/min | 50+/min |
| LLM 并发限制 | 1 | 10 (可配置) |
| 任务持久化 | ❌ | ✅ |
| 监控覆盖 | 0% | 100% |

---

## 技术架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │
│  │  对话界面        │  │  批量任务界面    │  │  任务管理界面        │   │
│  │  (单任务)       │  │  (批量提交)     │  │  (状态监控)          │   │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘   │
│           │                    │                       │             │
│           └────────────────────┼───────────────────────┘             │
│                                │                                      │
└────────────────────────────────┼──────────────────────────────────────┘
                                 │ SSE / WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Next.js API Layer                              │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │  POST /api/llm       │  │  POST /api/llm/batch │                 │
│  │  (兼容现有接口)      │  │  (批量任务提交)     │                 │
│  └──────────┬───────────┘  └──────────┬───────────┘                 │
│             │                         │                              │
│  ┌──────────▼───────────┐  ┌──────────▼───────────┐                 │
│  │  GET /api/stream     │  │  GET /api/batch/status│                │
│  │  (SSE 订阅流)        │  │  (批量任务状态)     │                 │
│  └──────────┬───────────┘  └──────────┬───────────┘                 │
│             │                         │                              │
└─────────────┼─────────────────────────┼──────────────────────────────┘
              │                         │
              │                         │
┌─────────────┼─────────────────────────┼──────────────────────────────┐
│             │        Queue Layer       │                              │
│  ┌──────────▼─────────────────────────▼───────────┐                  │
│  │            Redis + BullMQ                      │                  │
│  │  ┌─────────────┐  ┌──────────────┐            │                  │
│  │  │ Job Queue   │  │ Job State    │            │                  │
│  │  │ (report)    │  │ (RedisHash)  │            │                  │
│  │  └─────────────┘  └──────────────┘            │                  │
│  │  ┌──────────────────────────────────────┐     │                  │
│  │  │ Redis Pub/Sub / Redis Stream         │     │                  │
│  │  │ (用于实时推送 streaming 数据)           │     │                  │
│  │  └──────────────────────────────────────┘     │                  │
│  └────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
              │                         │
              │                         │
┌─────────────┼─────────────────────────┼──────────────────────────────┐
│             │       Worker Layer       │                              │
│  ┌──────────▼─────────────────────────▼───────────┐                  │
│  │            Worker Process (PM2)                 │                  │
│  │  ┌──────────────┐  ┌──────────────┐           │                  │
│  │  │ Worker 1     │  │ Worker 2     │   ...     │                  │
│  │  │ concurrency  │  │ concurrency  │           │                  │
│  │  │ = LLM并发数  │  │ = LLM并发数  │           │                  │
│  │  └──────┬───────┘  └──────┬───────┘           │                  │
│  │         │                  │                   │                  │
│  │         └────────┬─────────┘                   │                  │
│  │                  │                             │                  │
│  │  ┌───────────────▼───────────────────┐       │                  │
│  │  │  Shared LLM Instance (连接池)     │       │                  │
│  │  │  - maxConcurrent: 10              │       │                  │
│  │  │  - 复用 HTTP 连接                 │       │                  │
│  │  └───────────────────────────────────┘       │                  │
│  │  ┌───────────────┐  ┌───────────────┐       │                  │
│  │  │ Skill Loader  │  │ Tool Executor │       │                  │
│  │  │ (单例)        │  │              │       │                  │
│  │  └───────────────┘  └───────────────┘       │                  │
│  └────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       External Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐           │
│  │ LLM Provider │  │  Redis       │  │  Monitoring      │           │
│  │ (OpenRouter) │  │  (已部署)    │  │  (Prometheus)    │           │
│  └──────────────┘  └──────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

### 技术选型

| 组件 | 技术选型 | 理由 |
|-----|---------|------|
| 队列 | BullMQ 5.71 | 成熟、支持Redis、TypeScript友好 |
| Streaming推送 | Redis Stream | 支持消费组、消息持久化、可回溯 |
| 并发控制 | Worker concurrency | BullMQ原生支持，精确可控 |
| Agent管理 | 实例工厂模式 | 每个任务独立Agent，共享LLM |
| 监控 | OpenTelemetry + Prometheus | 行业标准，生态完善 |
| 日志 | Pino | 高性能，结构化输出 |

---

## 核心改造点

### 1️⃣ Agent：从"全局单例" → "任务级实例"

#### 当前问题

```typescript
// ❌ 当前：全局单例
export const agent = await initializeAgent();
```

**问题**：
- 多任务共享状态可能冲突
- 无法控制并发任务数

#### 改造方案

```typescript
// ✅ 改造：实例工厂 + 共享 LLM

// lib/llm/agent-factory.ts
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { loadKnowledgeSkill } from "./skill-loader";

// 单例：LLM 实例（复用 HTTP 连接）
let sharedLlm: ChatOpenAI | null = null;

async function getSharedLlm(): Promise<ChatOpenAI> {
  if (!sharedLlm) {
    sharedLlm = new ChatOpenAI({
      apiKey: process.env.FLOW_API_KEY,
      modelName: "Pro/moonshotai/Kimi-K2.5",
      configuration: {
        baseURL: process.env.FLOW_API_BASE_URL,
        defaultHeaders: {
          "HTTP-Referer": process.env.APP_URL || "http://localhost:8081",
          "X-Title": "LabFlow MCP Studio",
        },
      },
      // 关键：设置最大并发数
      maxConcurrency: Number(process.env.LLM_MAX_CONCURRENCY || 10),
      timeout: 120000,
      streaming: true,
      maxRetries: 3,
    });
  }
  return sharedLlm;
}

// 单例：Skill 工具（只加载一次）
let labscareTool: any = null;

async function getSharedTool(): Promise<any> {
  if (!labscareTool) {
    const skillPath = path.join(process.cwd(), "skills", "labscare-script");
    labscareTool = await loadKnowledgeSkill(skillPath);
  }
  return labscareTool;
}

// 工厂函数：创建任务级 Agent 实例
export async function createAgentInstance(): Promise<any> {
  const llm = await getSharedLlm();
  const tool = await getSharedTool();

  return createAgent({
    model: llm,
    tools: [tool],
    systemPrompt: `
你是 LabsCare 报表开发助手。

【铁律 - 必须严格遵守】
1. 任何涉及 LabsCare LIMS 报表脚本的编写、修改、调试、解释、占位符、模板、JSON 数据结构等任务时，
   **必须先调用工具 get_labscare_script_rules** 获取官方规范和参考示例。
2. **绝不允许**在未调用该工具前直接生成、修改或解释脚本。
3. 只有拿到工具返回的内容后，才能基于它进行后续回答。

当前可用工具：
- get_labscare_script_rules：获取 LabsCare 报表脚本的完整规范、决策优先级、占位符逻辑、模板联动规则及参考示例。
    `,
  });
}

// 清理函数（用于测试或优雅关闭）
export function resetAgentFactory(): void {
  // 重置单例
  labscareTool = null;
}
```

**设计要点**：
- ✅ LLM 实例单例：复用 HTTP 连接，降低开销
- ✅ Skill 工具单例：避免重复加载
- ✅ Agent 实例化：每个任务独立 Agent，隔离状态
- ✅ 并发控制：通过 LLM 实例的 maxConcurrency 控制

---

### 2️⃣ Streaming：从"直接返回流" → "发布到 Redis Stream"

#### 当前实现

```typescript
// ❌ 当前：直接返回 SSE 流
const eventStream = await agent.stream({ messages });
return new Response(runtimeStream, {
  headers: { 'Content-Type': 'text/event-stream' }
});
```

#### 改造方案

```typescript
// ✅ 改造：Agent 输出发布到 Redis Stream

// lib/queue/stream-publisher.ts
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const STREAM_KEY_PREFIX = "stream:";

/**
 * 发布流式消息到 Redis Stream
 * @param jobId 任务 ID
 * @param chunk 消息块
 */
export async function publishStreamChunk(
  jobId: string,
  chunk: {
    type: 'content' | 'thought' | 'tool_call' | 'status' | 'metrics' | 'error' | 'done';
    text?: string;
    tool?: string;
    node?: string;
    [key: string]: any;
  }
): Promise<void> {
  const streamKey = `${STREAM_KEY_PREFIX}${jobId}`;

  // 使用 XADD 添加消息到 Stream
  // MAXLEN ~1000：保留最近 1000 条消息
  await redis.xadd(
    streamKey,
    "MAXLEN",
    "~",
    "1000",
    "*",
    "type",
    chunk.type,
    "data",
    JSON.stringify(chunk),
    "timestamp",
    Date.now().toString()
  );
}

/**
 * 标记任务完成
 */
export async function markStreamComplete(jobId: string, result?: any): Promise<void> {
  await publishStreamChunk(jobId, {
    type: "done",
    ...result
  });

  // 可选：设置过期时间（24小时后删除）
  await redis.expire(`${STREAM_KEY_PREFIX}${jobId}`, 86400);
}

/**
 * 标记任务失败
 */
export async function markStreamFailed(jobId: string, error: Error): Promise<void> {
  await publishStreamChunk(jobId, {
    type: "error",
    message: error.message,
    stack: error.stack
  });
}
```

**设计要点**：
- ✅ 消息持久化：支持断线重连后回溯
- ✅ 自动清理：设置过期时间
- ✅ 消息上限：防止内存溢出

---

### 3️⃣ Worker：引入 BullMQ Worker 处理并发任务

```typescript
// workers/batch-worker.ts
import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { createAgentInstance } from "../lib/llm/agent-factory";
import { publishStreamChunk, markStreamComplete, markStreamFailed } from "../lib/queue/stream-publisher";
import { logger } from "../lib/logger";

// Redis 连接
const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null, // BullMQ 要求
  enableReadyCheck: true,
});

// Worker 配置
const workerConfig = {
  concurrency: Number(process.env.WORKER_CONCURRENCY || 3), // 等于 LLM 并发数
  connection,
};

// 任务数据类型
interface ReportTaskData {
  jobId: string;
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

// 创建 Worker
const worker = new Worker<ReportTaskData>(
  "report",
  async (job: Job<ReportTaskData>) => {
    const { jobId, prompt, contextJson, messagesJson, files } = job.data;
    const startTime = Date.now();

    logger.info(`[Worker] 开始处理任务: ${jobId}`, {
      jobId,
      prompt: prompt.substring(0, 100),
      filesCount: files?.length || 0
    });

    try {
      // 1. 创建 Agent 实例
      const agent = await createAgentInstance();

      // 2. 构建消息
      const messages = await buildMessages(prompt, contextJson, messagesJson, files);

      // 3. 执行 Agent 并发布流式结果
      await executeAgentStreaming(jobId, agent, messages);

      // 4. 标记完成
      const duration = Date.now() - startTime;
      await markStreamComplete(jobId, {
        type: "metrics",
        total_duration: duration
      });

      logger.info(`[Worker] 任务完成: ${jobId}`, { duration });
      return { success: true, duration };

    } catch (error) {
      const err = error as Error;
      logger.error(`[Worker] 任务失败: ${jobId}`, { error: err.message, stack: err.stack });

      await markStreamFailed(jobId, err);
      throw error; // 让 BullMQ 处理重试
    }
  },
  workerConfig
);

// 错误处理
worker.on('error', (err) => {
  logger.error('[Worker] Worker error:', err);
});

worker.on('completed', (job) => {
  logger.info(`[Worker] Job completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  logger.error(`[Worker] Job failed: ${job?.id}`, err);
});

// 构建消息
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
      logger.error('解析消息历史失败', e);
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

// 执行 Agent 并发布流式结果
async function executeAgentStreaming(
  jobId: string,
  agent: any,
  messages: any[]
): Promise<void> {
  let firstTokenTime: number | null = null;

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
            text: reasoning
          });
        }

        // 提取正式回答
        if (messageChunk?.content && typeof messageChunk.content === "string") {
          if (firstTokenTime === null) {
            firstTokenTime = Date.now();
            await publishStreamChunk(jobId, {
              type: "metrics",
              ttft: firstTokenTime
            });
          }

          const messageType = currentNode === "tools" ? "thought" : "content";
          await publishStreamChunk(jobId, {
            type: messageType,
            node: currentNode,
            text: messageChunk.content
          });
        }

        // 提取工具调用
        if (messageChunk?.tool_calls && messageChunk.tool_calls.length > 0) {
          for (const tc of messageChunk.tool_calls) {
            await publishStreamChunk(jobId, {
              type: "tool_call",
              tool: tc.name,
              message: `正在调用: ${tc.name}...`
            });
          }
        }
      } else if (streamMode === "updates") {
        await publishStreamChunk(jobId, {
          type: "status",
          text: "工具执行完成，正在整合结果..."
        });
      }
    }
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('[Worker] 收到 SIGTERM，正在关闭...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[Worker] 收到 SIGINT，正在关闭...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

export { worker };
```

---

### 4️⃣ API：批量任务提交接口

```typescript
// app/api/llm/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

// Redis 连接
const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// 创建队列
const reportQueue = new Queue('report', { connection });

// 请求体类型
interface BatchRequest {
  tasks: Array<{
    prompt: string;
    contextJson?: string;
    messagesJson?: string;
    files?: Array<{
      name: string;
      type: 'image' | 'json' | 'md';
      content: string;
      dataUrl?: string;
    }>;
  }>;
}

// 响应体类型
interface BatchResponse {
  success: boolean;
  batchId: string;
  jobIds: string[];
  totalTasks: number;
  queuedTasks: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 解析请求体
    const body: BatchRequest = await request.json();

    if (!body.tasks || !Array.isArray(body.tasks) || body.tasks.length === 0) {
      return NextResponse.json(
        { error: 'tasks must be a non-empty array' },
        { status: 400 }
      );
    }

    // 限制批量任务数量（防止滥用）
    const maxBatchSize = Number(process.env.MAX_BATCH_SIZE || 10);
    if (body.tasks.length > maxBatchSize) {
      return NextResponse.json(
        { error: `Maximum batch size is ${maxBatchSize}` },
        { status: 400 }
      );
    }

    // 生成批次 ID
    const batchId = randomUUID();

    // 批量添加任务到队列
    const jobIds: string[] = [];
    const jobs = body.tasks.map((task, index) => {
      const jobId = `${batchId}-${index}`;
      return {
        name: 'generate-report',
        data: {
          jobId,
          ...task
        },
        opts: {
          jobId,
          attempts: 3, // 重试 3 次
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      };
    });

    // 添加到队列
    const addedJobs = await reportQueue.addBulk(jobs);
    jobIds.push(...addedJobs.map(job => job.id!));

    const duration = Date.now() - startTime;
    logger.info(`[Batch API] 批量任务已提交`, {
      batchId,
      jobIds,
      taskCount: body.tasks.length,
      duration
    });

    const response: BatchResponse = {
      success: true,
      batchId,
      jobIds,
      totalTasks: body.tasks.length,
      queuedTasks: body.tasks.length
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('[Batch API] 请求失败', error);
    return NextResponse.json(
      { error: 'Failed to process batch request' },
      { status: 500 }
    );
  }
}
```

---

## 并发控制设计

### 并发控制层次

```
┌─────────────────────────────────────────────────────────┐
│  并发控制层次                                             │
├─────────────────────────────────────────────────────────┤
│  层级1：Worker 并发控制                                   │
│    - WORKER_CONCURRENCY = 3                              │
│    - 控制同时处理的任务数                                 │
├─────────────────────────────────────────────────────────┤
│  层级2：LLM 实例并发控制                                  │
│    - LLM_MAX_CONCURRENCY = 10                            │
│    - ChatOpenAI 内置的并发限制                           │
│    - 通过 maxConcurrency 设置                            │
├─────────────────────────────────────────────────────────┤
│  层级3：BullMQ 队列限流                                   │
│    - 限制队列任务入队速率                                 │
│    - 防止队列积压过大                                     │
└─────────────────────────────────────────────────────────┘
```

### 配置说明

| 配置项 | 默认值 | 说明 | 建议范围 |
|-------|--------|------|---------|
| `WORKER_CONCURRENCY` | 3 | Worker同时处理任务数 | 3-10 |
| `LLM_MAX_CONCURRENCY` | 10 | LLM最大并发调用数 | 5-20 |
| `MAX_BATCH_SIZE` | 10 | 单次批量最大任务数 | 5-50 |

### 关键原则

✅ **Worker concurrency = 实际LLM并发数**

```typescript
// ✅ 正确配置
concurrency: 3  // Worker 同时处理 3 个任务
                 // 每个 Agent 串行执行，所以实际 LLM 并发 = 3

// ❌ 错误配置
concurrency: 10  // Worker 同时处理 10 个任务
                 // 如果 LLM maxConcurrency=10，可能导致 LLM 限流
```

✅ **Agent 内部串行执行**

```typescript
// Agent 本身就是串行的，不需要额外控制
for await (const chunk of agent.stream(...)) {
  // 自动串行执行
}
```

---

## 任务状态机设计

### 状态流转图

```
                    ┌─────────┐
                    │  queued │
                    └────┬────┘
                         │
                    任务被Worker拉取
                         │
                         ▼
                    ┌──────────────┐
                    │  processing  │◄──┐
                    └──────┬───────┘   │
                           │           │
                    Agent 执行中       │ 重试 (max 3次)
                           │           │
           ┌───────────────┼───────────┘
           │               │
     成功/完成           失败
           │               │
           ▼               ▼
    ┌─────────────┐  ┌───────────┐
    │  completed  │  │  failed   │
    └─────────────┘  └───────────┘
         │               │
         │    ┌──────────┘
         │    │
         └────┴─────►  expired
                     (过期清理)
```

### 状态定义

| 状态 | 说明 | 持久化位置 |
|-----|------|-----------|
| `queued` | 任务已加入队列，等待处理 | BullMQ Queue |
| `processing` | Worker正在处理 | BullMQ Job |
| `completed` | 任务成功完成 | BullMQ Job + Redis Hash |
| `failed` | 任务失败 | BullMQ Job + Redis Hash |
| `cancelled` | 任务被取消 | BullMQ Job + Redis Hash |
| `expired` | 任务已过期清理 | Redis TTL |

### Redis 数据结构

```typescript
// 任务状态存储 (Redis Hash)
Key: task:{jobId}
Fields:
  - status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired'
  - batchId: string
  - createdAt: timestamp
  - startedAt?: timestamp
  - completedAt?: timestamp
  - failedAt?: timestamp
  - duration?: number
  - error?: string
  - retryCount: number
TTL: 7天

// 批量任务元数据
Key: batch:{batchId}
Fields:
  - status: 'pending' | 'running' | 'completed' | 'failed'
  - totalTasks: number
  - completedTasks: number
  - failedTasks: number
  - createdAt: timestamp
TTL: 7天

// Streaming 数据
Key: stream:{jobId}
Type: Stream
MAXLEN: 1000
TTL: 24小时
```

---

## 错误处理与重试

### 错误分类

| 错误类型 | 处理策略 | 重试次数 |
|---------|---------|---------|
| 网络超时 | 指数退避重试 | 3 |
| LLM限流 | 延迟重试 | 3 |
| LLM服务不可用 | 快速失败，告警 | 1 |
| 任务验证失败 | 不重试 | 0 |
| Agent工具调用失败 | 重试 | 2 |
| 未知错误 | 记录日志，告警 | 0 |

### 重试配置

```typescript
// BullMQ Job 配置
{
  attempts: 3,  // 最大重试次数
  backoff: {
    type: 'exponential',  // 指数退避
    delay: 2000,  // 初始延迟 2秒
  },
  removeOnComplete: {
    age: 86400,  // 24小时后删除
  },
  removeOnFail: {
    age: 604800,  // 7天后删除
  }
}
```

### 死信队列

```typescript
// 失败3次后，进入死信队列
const deadLetterQueue = new Queue('report:dead-letter', { connection });

worker.on('failed', async (job, err) => {
  if (job?.attemptsMade >= job?.opts.attempts) {
    // 移动到死信队列
    await deadLetterQueue.add(job!.data, {
      jobId: job!.id,
      error: err.message,
      originalJobId: job!.id,
    });
    logger.error('[Worker] 任务移至死信队列', { jobId: job.id });
  }
});
```

---

## 可观测性设计

### 指标采集

```typescript
// lib/monitoring/metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

// 任务指标
export const taskCounter = new Counter({
  name: 'tasks_total',
  help: 'Total number of tasks processed',
  labelNames: ['status', 'batch_id'],
});

export const taskDuration = new Histogram({
  name: 'task_duration_seconds',
  help: 'Task processing duration',
  labelNames: ['status'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
});

export const activeTasks = new Gauge({
  name: 'tasks_active',
  help: 'Number of currently active tasks',
});

// LLM 指标
export const llmCallCounter = new Counter({
  name: 'llm_calls_total',
  help: 'Total number of LLM calls',
  labelNames: ['model', 'status'],
});

export const llmLatency = new Histogram({
  name: 'llm_latency_seconds',
  help: 'LLM call latency',
  labelNames: ['model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
});

// 队列指标
export const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Current queue size',
  labelNames: ['queue_name'],
});
```

### 集成到 Worker

```typescript
// 在 Worker 中记录指标
worker.on('completed', async (job) => {
  const duration = (job.finishedOn! - job.processedOn!) / 1000;

  taskCounter.inc({ status: 'completed', batch_id: job.data.batchId });
  taskDuration.observe({ status: 'completed' }, duration);
  activeTasks.dec();

  logger.info('[Metrics] Task completed', { jobId: job.id, duration });
});
```

### 日志标准化

```typescript
// lib/monitoring/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // 生产环境使用 JSON
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

---

## API 设计

### 完整 API 列表

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/llm` | 单任务处理（兼容现有） |
| POST | `/api/llm/batch` | 批量任务提交 |
| GET | `/api/stream?jobId={id}` | SSE 订阅单个任务流 |
| GET | `/api/stream/batch?batchId={id}` | SSE 订阅批量任务流 |
| GET | `/api/batch/{batchId}` | 查询批量任务状态 |
| GET | `/api/task/{jobId}` | 查询单个任务状态 |
| DELETE | `/api/task/{jobId}` | 取消任务 |
| GET | `/api/metrics` | Prometheus 指标端点 |

### API 详细规范

#### POST /api/llm/batch

**请求体**：
```json
{
  "tasks": [
    {
      "prompt": "生成报表脚本...",
      "contextJson": "{\"conversationId\": \"conv-1\"}",
      "messagesJson": "[{\"role\": \"user\", \"content\": \"...\"}]",
      "files": [
        {
          "name": "template.png",
          "type": "image",
          "content": "data:image/png;base64,...",
          "dataUrl": "data:image/png;base64,..."
        }
      ]
    }
  ]
}
```

**响应体**：
```json
{
  "success": true,
  "batchId": "batch-uuid",
  "jobIds": ["batch-uuid-0", "batch-uuid-1"],
  "totalTasks": 2,
  "queuedTasks": 2
}
```

**错误响应**：
```json
{
  "error": "Maximum batch size is 10"
}
```

#### GET /api/stream/batch

**参数**：
- `batchId` (string, required): 批量任务ID
- `fromIndex` (number, optional): 从第几个任务开始订阅（用于断线重连）

**SSE 消息格式**：
```
data: {"type":"batch_start","batchId":"batch-uuid","totalTasks":2}

data: {"type":"task_start","jobId":"batch-uuid-0","taskIndex":0}
data: {"type":"content","text":"生成中..."}
data: {"type":"done","jobId":"batch-uuid-0"}

data: {"type":"task_start","jobId":"batch-uuid-1","taskIndex":1}
...
data: {"type":"batch_end","batchId":"batch-uuid","completedTasks":2,"failedTasks":0}
```

---

## 前端设计方案

### 批量任务界面

```typescript
// app/batch/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Task {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  output?: string;
  error?: string;
}

export default function BatchTaskPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const submitBatchTasks = async (files: File[]) => {
    // 构建请求
    const response = await fetch('/api/llm/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: /* ... */ })
    });

    const { batchId, jobIds } = await response.json();
    setBatchId(batchId);
    setTasks(jobIds.map(jobId => ({
      jobId,
      status: 'queued',
      progress: 0
    })));

    // 开始订阅流
    subscribeToBatchStream(batchId);
  };

  const subscribeToBatchStream = (batchId: string) => {
    setIsStreaming(true);
    const eventSource = new EventSource(`/api/stream/batch?batchId=${batchId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'task_start':
          setTasks(prev => prev.map(task =>
            task.jobId === data.jobId
              ? { ...task, status: 'processing' }
              : task
          ));
          break;

        case 'content':
          setTasks(prev => prev.map(task =>
            task.jobId === data.jobId
              ? { ...task, output: (task.output || '') + data.text }
              : task
          ));
          break;

        case 'done':
          setTasks(prev => prev.map(task =>
            task.jobId === data.jobId
              ? { ...task, status: 'completed', progress: 100 }
              : task
          ));
          break;

        case 'error':
          setTasks(prev => prev.map(task =>
            task.jobId === data.jobId
              ? { ...task, status: 'failed', error: data.message }
              : task
          ));
          break;

        case 'batch_end':
          setIsStreaming(false);
          eventSource.close();
          break;
      }
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>批量任务处理</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 文件上传 */}
          {/* 任务列表 */}
          {tasks.map(task => (
            <TaskCard key={task.jobId} task={task} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium">{task.jobId}</span>
          <span className={`text-sm ${getStatusColor(task.status)}`}>
            {task.status}
          </span>
        </div>
        <Progress value={task.progress} className="mb-2" />
        {task.output && (
          <div className="bg-gray-100 p-2 rounded text-sm">
            {task.output}
          </div>
        )}
        {task.error && (
          <div className="bg-red-100 text-red-800 p-2 rounded text-sm">
            {task.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'text-green-600';
    case 'failed': return 'text-red-600';
    case 'processing': return 'text-blue-600';
    default: return 'text-gray-600';
  }
}
```

---

## 安全性设计

### API 认证

```typescript
// lib/middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server';

export async function authMiddleware(request: NextRequest) {
  // 验证 API Key
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 验证 CSRF Token（对于浏览器请求）
  if (request.headers.get('sec-fetch-mode') === 'navigate') {
    const csrfToken = request.cookies.get('csrf_token');
    if (!csrfToken) {
      return NextResponse.json(
        { error: 'CSRF token missing' },
        { status: 403 }
      );
    }
  }

  return null; // 通过验证
}
```

### 输入验证

```typescript
// lib/validation/task-validator.ts
import { z } from 'zod';

export const fileSchema = z.object({
  name: z.string().max(255),
  type: z.enum(['image', 'json', 'md']),
  content: z.string().max(10 * 1024 * 1024), // 最大 10MB
  dataUrl: z.string().optional(),
});

export const taskSchema = z.object({
  prompt: z.string().min(1).max(10000),
  contextJson: z.string().optional(),
  messagesJson: z.string().optional(),
  files: z.array(fileSchema).max(10).optional(),
});

export const batchRequestSchema = z.object({
  tasks: z.array(taskSchema).min(1).max(10),
});

export function validateBatchRequest(data: unknown) {
  return batchRequestSchema.parse(data);
}
```

### 敏感信息脱敏

```typescript
// lib/logging/serializer.ts
export function sanitizeForLogging(obj: any): any {
  const sensitiveKeys = ['apiKey', 'password', 'token', 'secret'];

  const sanitized = { ...obj };

  for (const key in sanitized) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
}
```

---

## 部署架构

### 开发环境

```
┌────────────────────────────────────┐
│  Next.js Dev Server                │
│  - 开发模式                         │
│  - 热重载                           │
│  - Worker 在同一进程                │
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Docker Compose                     │
│  - Redis                            │
│  - (可选) Prometheus                │
└────────────────────────────────────┘
```

### 生产环境

```
┌──────────────────────────────────────────────────────────┐
│  Nginx (负载均衡 + SSL)                                   │
└────────────┬─────────────────────────────────────────────┘
             │
        ┌────┴────┐
        ▼         ▼
┌──────────────┐ ┌──────────────┐
│  Next.js     │ │  Next.js     │
│  Server 1    │ │  Server 2    │
│  (API层)     │ │  (API层)     │
└──────┬───────┘ └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
       ┌────────┴────────┐
       │  Redis Cluster │
       │  (高可用)       │
       └─────────────────┘
                │
       ┌────────┴────────┐
       │  BullMQ Queue   │
       └─────────────────┘
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Worker 1 │ │ Worker 2 │ │ Worker N │
│ (PM2)    │ │ (PM2)    │ │ (PM2)    │
└──────────┘ └──────────┘ └──────────┘
        │       │       │
        └───────┼───────┘
                ▼
         LLM Provider
```

### Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  nextjs:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  worker:
    build: .
    command: npm run worker
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - WORKER_CONCURRENCY=3
    depends_on:
      - redis
    deploy:
      replicas: 2

  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

volumes:
  redis-data:
```

---

## 分阶段实施方案

### 第一阶段：核心功能开发 (2-3周)

**目标**：实现基础的批量任务处理能力

- [ ] Redis 环境搭建
- [ ] BullMQ 队列集成
- [ ] Worker 进程开发
- [ ] 批量任务 API 开发
- [ ] 单任务 SSE 订阅（基于 Redis Stream）
- [ ] 基础错误处理

**验收标准**：
- ✅ 能成功提交批量任务
- ✅ Worker 能正确处理任务
- ✅ 前端能接收流式输出

### 第二阶段：完整流式体验 (1-2周)

**目标**：实现完整的批量任务流式体验

- [ ] 批量任务 SSE 订阅
- [ ] 断线重连机制
- [ ] 任务状态持久化
- [ ] 批量任务界面开发

**验收标准**：
- ✅ 前端能实时显示多个任务进度
- ✅ 断线重连后能继续接收消息
- ✅ 任务状态准确反映

### 第三阶段：生产级特性 (2-3周)

**目标**：完善监控、日志、错误处理等生产级特性

- [ ] 指标采集（Prometheus）
- [ ] 结构化日志（Pino）
- [ ] 错误重试和死信队列
- [ ] 告警规则配置
- [ ] 性能优化

**验收标准**：
- ✅ Prometheus 能采集所有指标
- ✅ 日志结构化输出
- ✅ 错误能正确重试

### 第四阶段：安全与部署 (1-2周)

**目标**：完善安全机制和部署方案

- [ ] API 认证
- [ ] 输入验证
- [ ] Docker 化
- [ ] 生产环境部署
- [ ] 灰度发布策略

**验收标准**：
- ✅ API 需要认证才能访问
- ✅ 所有输入都经过验证
- ✅ 能成功部署到生产环境

---

## 配置管理

### 环境变量

```bash
# .env.example

# 应用配置
NODE_ENV=production
PORT=3000
APP_URL=http://localhost:8081

# Redis 配置
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# LLM 配置
FLOW_API_KEY=your-api-key
FLOW_API_BASE_URL=https://openrouter.ai/api/v1
LLM_MAX_CONCURRENCY=10
LLM_TIMEOUT=120000

# Worker 配置
WORKER_CONCURRENCY=3
MAX_BATCH_SIZE=10

# 批量处理
MAX_BATCH_SIZE=10

# 日志
LOG_LEVEL=info

# 监控
METRICS_ENABLED=true
METRICS_PORT=9090

# 安全
API_KEY=your-api-key
ENABLE_CSRF=true

# BullMQ
BULLMQ_REDIS_URL=redis://localhost:6379
```

### 配置验证

```typescript
// lib/config/index.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  FLOW_API_KEY: z.string().min(1),
  LLM_MAX_CONCURRENCY: z.string().transform(Number).default('10'),
  WORKER_CONCURRENCY: z.string().transform(Number).default('3'),
  MAX_BATCH_SIZE: z.string().transform(Number).default('10'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = envSchema.parse(process.env);
```

---

## 成本评估

### 基础设施成本

| 资源 | 配置 | 月成本估算 |
|-----|------|-----------|
| Redis | 4GB | ~$20 |
| Next.js Server | 2vCPU, 4GB | ~$30 |
| Worker (2个) | 2vCPU, 4GB × 2 | ~$60 |
| LLM API | Kimi-K2.5 | 按用量计费 |

### LLM 成本估算

假设：
- 平均每个任务生成 500 tokens
- Kimi-K2.5 价格: $0.005/1K tokens
- 每月处理 10,000 个任务

```
单任务成本 = 500 / 1000 × $0.005 = $0.0025
月度成本 = 10,000 × $0.0025 = $25
```

### 总成本

```
基础设施: $110/月
LLM API: $25/月
总计: ~$135/月
```

---

## 附录

### A. 故障排查

#### 问题1：任务卡在 queued 状态

**可能原因**：
- Worker 未启动
- Redis 连接失败

**排查步骤**：
```bash
# 检查 Worker 进程
pm2 list

# 检查 Redis 连接
redis-cli ping

# 检查队列状态
redis-cli LLEN bull:report
```

#### 问题2：流式消息接收中断

**可能原因**：
- Redis Stream 达到 MAXLEN
- 网络连接问题

**排查步骤**：
```bash
# 检查 Stream 长度
redis-cli XLEN stream:job-xxx

# 检查 Stream 内容
redis-cli XRANGE stream:job-xxx - + COUNT 10
```

### B. 性能优化建议

1. **调整并发参数**
   - 根据 LLM API 限流调整 `WORKER_CONCURRENCY`
   - 监控队列积压，动态调整

2. **减少 Agent 创建开销**
   - 使用共享 LLM 实例
   - 复用 Skill 工具

3. **优化 Redis 使用**
   - 使用连接池
   - 设置合理的 MAXLEN 和 TTL

### C. 参考资料

- [BullMQ 官方文档](https://docs.bullmq.io/)
- [Redis Stream 文档](https://redis.io/docs/data-types/streams/)
- [LangChain 文档](https://js.langchain.com/)
- [OpenTelemetry 规范](https://opentelemetry.io/)
