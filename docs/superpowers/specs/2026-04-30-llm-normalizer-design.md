# LLM 归一化 SSE 流水线 — 设计文档

**日期**：2026-04-30  
**功能 ID**：`llm-normalizer-pipeline`  
**状态**：已批准，实施中

---

## 问题陈述

`app/api/llm/route.ts` 当前存在以下四个问题：

| 问题 | 根因 |
|------|------|
| LLM 返回格式不统一 | 各厂商 `additional_kwargs` 字段名不同，用 ad-hoc 数组循环探测，无类型保证 |
| 解析逻辑散落在业务代码里 | 100+ 行 for-await 循环内直接处理 chunk，不可测试、不可复用 |
| content / reasoning / tool_call 混在一起 | 缺少归一化隔离层，`messageType` 靠 `currentNode === "tools"` 判断，不稳定 |
| assistantContent 丢失 | 只处理 `typeof content === "string"` 情况，Anthropic/Gemini content-block 数组被跳过 |

---

## 目标

> 所有模型 → normalizeChunk() → StandardLLMEvent[] → SSE → 前端

- 屏蔽所有厂商字段差异，route.ts 不再知道字段名
- `assistantContent` 和 `reasoning` 分开正确累积
- route.ts streaming 核心从 ~100 行缩减到 ~30 行

---

## 架构

### 新增文件

```
lib/llm/
├── normalizer.ts            ← 归一化适配层（核心）
├── assistant-accumulator.ts ← 分字段累积，修复 assistantContent 丢失
└── sse-serializer.ts        ← StandardLLMEvent → SSE 字符串
```

### 数据流

```
LangChain messageChunk
    ↓
normalizeMessageChunk(chunk, metadata)   [lib/llm/normalizer.ts]
    ↓ StandardLLMEvent[]
for each event:
    accumulator.feed(event)              [lib/llm/assistant-accumulator.ts]
    controller.enqueue(serializeSSE(e))  [lib/llm/sse-serializer.ts]
    ↓
SSE → 前端
    ↓
流结束 → accumulator.toSavePayload() → contextManager.addAssistantMessage()
```

---

## StandardLLMEvent 类型定义

```typescript
export type LLMEventType =
  | 'thought'      // 深度思考内容（不直接渲染）
  | 'content'      // 正文回复（流式渲染）
  | 'tool_call'    // 工具调用通知
  | 'tool_result'  // 工具节点执行结果
  | 'status'       // 节点状态提示
  | 'metrics'      // 耗时 / token 统计
  | 'error';       // 错误

export interface StandardLLMEvent {
  type: LLMEventType;
  text?: string;
  node?: string;
  tool?: string;
  message?: string;
  ttft?: number;
  total_duration?: number;
  token_usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  conversation_id?: string;
}
```

---

## normalizer.ts 核心逻辑

### reasoning 提取优先级（用 Map 代替 if-else 链）

```
reasoning_content  → OpenAI-compatible / DeepSeek / SiliconFlow
reasoning          → OpenRouter 透传
thought            → 部分 Gemini
thinking           → 部分 Gemini
rationale          → 其他
content[].thinking → Anthropic thinking block
```

### content 提取

- `typeof content === "string"` → 直接取
- `Array.isArray(content)` → 过滤 `type === "text"` block，join 拼接
- 工具节点（`node === "tools"`）的 content → 类型改为 `tool_result`

### tool_call 提取

- `chunk.tool_calls`（LangChain 标准）
- `chunk.additional_kwargs.tool_calls`（部分厂商）

---

## AssistantAccumulator

```typescript
class AssistantAccumulator {
  content = '';
  reasoning = '';

  feed(event: StandardLLMEvent)        // content → this.content, thought → this.reasoning
  hasContent(): boolean
  toSavePayload(): { content, reasoning? }
}
```

**修复点**：原代码只在 `content` 事件触发时累积，且只处理 string。新实现由 `normalizer` 保证输出全部是 string，accumulator 直接拼接，零歧义。

---

## route.ts 变更范围

- **不变**：请求解析、FormData、文件处理、contextManager、tokenInspector、SSE headers
- **替换**：for-await 循环内 ~100 行 chunk 处理逻辑 → `normalizeMessageChunk()` + `accumulator.feed()` + `serializeSSE()`

---

## 验证标准

1. `npm run typecheck` — 0 错误
2. OpenAI / DeepSeek `reasoning_content` → `thought` 事件 ✓
3. Anthropic content block 数组 → `content` 事件，`assistantContent` 非空 ✓
4. tool_call 携带正确 `tool` name ✓
5. route.ts streaming 核心 ≤ 40 行 ✓

---

## 已知风险

- Gemini `thinking` block 格式在 LangChain 不同版本中可能有差异，需在 `extractAnthropicThinking` 同类函数中一并处理
- `tool_calls` 字段在 LangChain `AIMessageChunk` 的位置因模型而异，需双路探测
