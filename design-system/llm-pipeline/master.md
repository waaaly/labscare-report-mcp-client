# 高吞吐量的 LLM Pipeline架构升级

## 现有设计和不足

- 目前项目中已经在lib/llm/reactAgent.js 中实现了 reaction Agent
并通过导入skills/labscare-script/ 中的skill 实现了一个能够处理并生成报告脚本的agnet
- 用户通过app/conversation 中的对话界面向 app/api/lmm/route 提交物料，
route中通过agent.stream 调用agent 并返回streaming结果
- client端通过 conversation界面调用 components\conversation\下的相关组件实现
agent输出流的实时渲染。

以上是目前系统的设计架构，可以看出，当前系统存在以下不足：
- 当前系统只能处理单个并发任务，无法支持批量并发任务。
- 用户也只能在单个对话界面发起任务处理。
- 当用户想批量处理多个报告文档时，当前系统无法满足需求。用户需要分别提交每个报告文档，
    且每个报告文档的处理结果需要等待前一个报告文档处理完成后才能开始。

## 改造当前系统达到以下目标
✅ 保留你现有 Agent + Skill 能力
✅ 支持 批量并发任务
✅ 保留 streaming 实时体验
✅ 可扩展到 生产级高吞吐量

另外，为了支持批量并发任务，我们需要对当前系统进行以下改造：
- client端设计：
    - 新增一个批量任务提交界面，用户可以在该界面提交多个报告文档的物料信息（模板占位符图片，数据josn文件，占位符说明md文件）。
    - 每个报告文档的处理结果会实时显示在界面上，用户可以查看每个报告文档的处理进度。

- server端设计：
    - 新增一个批量任务处理路由，如/lmm/batch，用于处理用户提交的批量任务。
    - 该路由会将用户提交的多个报告文档分发给多个worker进程，每个worker进程负责处理一个报告文档。
    - 每个worker进程会通过agent.stream 调用agent 并返回streaming结果。
    - 该路由会将多个worker进程的streaming结果合并起来，返回给用户。

## 整体目标架构（最终形态）


                    ┌────────────────────────┐
                    │     Next.js App         │
                    │  - 提交任务 API         │
                    │  - SSE订阅 API         │
                    └──────────┬─────────────┘
                               │
                    ┌──────────▼──────────┐
                    │      Queue (Redis)   │
                    │      BullMQ          │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐
│   Worker 1      │   │   Worker 2      │   │   Worker N      │
│ (Agent + Skill) │   │ (Agent + Skill) │   │ (Agent + Skill) │
└───────┬────────┘   └────────┬────────┘   └────────┬────────┘
        │                     │                     │
        └──────────────┬──────┴──────────────┬──────┘
                       │                     │
              ┌────────▼────────┐
              │ Redis Pub/Sub   │  ← streaming核心
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  SSE / WebSocket │
              └────────┬────────┘
                       │
                    前端 UI

## 改造核心

### 🔥 1️⃣ Agent：从“全局单例” → “任务级实例”
❌ 当前
const agent = createAgent(...)
✅ 改造
function createAgentInstance() {
  return createAgent({
    llm,
    tools: [yourSkillTool],
  });
}

👉 每个 job 调用：

const agent = createAgentInstance();


### 🔥 3️⃣ Streaming：从“返回流” → “发布流”
❌ 当前
return agent.stream()
✅ 改造
for await (const chunk of stream) {
  pub.publish(jobId, chunk);
}
### 🔥 4️⃣ 引入 Queue + Worker（并发核心）
new Worker("report", async (job) => {
  const agent = createAgentInstance();

  return await runTask(job.data, agent);
}, {
  concurrency: 5
});

## 并发控制设计（重点）
✅ 1️⃣ 全局限流（最重要）

用 p-limit 控制 LLM 调用：

import pLimit from "p-limit";

const limit = pLimit(3); // 同时最多3个LLM请求

async function callLLM(input) {
  return limit(() => llm.invoke(input));
}
✅ 2️⃣ Worker 并发 + LLM 并发分离
new Worker("queue", handler, {
  concurrency: 5, // 可以大一点
});

但：

👉 真正控制在：

limit = pLimit(3)
✅ 3️⃣ Pipeline 内串行（关键）
async function runPipeline(task) {
  const step1 = await callLLM(...);
  const step2 = await callLLM(...);
  const step3 = await callLLM(...);
}

👉 不要：

// ❌ 爆炸
await Promise.all([
  callLLM(step1),
  callLLM(step2),
  callLLM(step3),
]);
两层限流（必须做）
✅ 1️⃣ Worker 层
concurrency: 5
✅ 2️⃣ LLM 层（更重要）
const limit = pLimit(3);

## 完整执行流程
三、完整执行流程（一步一步）
Step 1️⃣ 用户提交批量任务
POST /api/llm/batch
[
  {
    "image": "...",
    "json": {...},
    "md": "..."
  }
]
返回：
{
  "jobIds": ["job1", "job2"]
}
Step 2️⃣ 前端开始订阅 streaming
new EventSource(`/api/stream?jobId=job1`)
Step 3️⃣ Worker 执行任务
async function runTask(task, agent) {
  const stream = await agent.stream(task);

  for await (const chunk of stream) {
    await publish(jobId, chunk);
  }

  await publish(jobId, { type: "done" });
}
Step 4️⃣ Redis Pub/Sub 转发
pub.publish(`job:${jobId}`, JSON.stringify(chunk));
Step 5️⃣ SSE 推给前端
controller.enqueue(`data: ${message}\n\n`);

## 最终效果：
5个任务在跑
但最多只有3个LLM请求同时发生
