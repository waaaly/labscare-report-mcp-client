/**
 * lib/llm/normalizer.ts
 *
 * 归一化适配层：将 LangChain messageChunk 归一化为 StandardLLMEvent[]
 * 职责：屏蔽所有厂商字段差异，route.ts 不再需要知道字段名。
 *
 * 支持厂商：
 *   - OpenAI / DeepSeek / SiliconFlow  → additional_kwargs.reasoning_content
 *   - OpenRouter                        → additional_kwargs.reasoning
 *   - Gemini (LangChain)               → additional_kwargs.thought / thinking
 *   - Anthropic                        → content[].type === "thinking"
 *   - 通用兜底                          → additional_kwargs.rationale
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export type LLMEventType =
  | 'thought'       // 深度思考内容（不直接渲染给用户）
  | 'content'       // 正文回复（流式渲染）
  | 'tool_call'     // 工具调用通知
  | 'tool_result'   // 工具节点执行结果（来自 tools 节点的 content）
  | 'status'        // 节点状态提示（进度条 / loading）
  | 'metrics'       // 耗时 / token 统计
  | 'error';        // 错误

export interface StandardLLMEvent {
  type: LLMEventType;
  text?: string;
  node?: string;
  tool?: string;
  message?: string;
  // metrics 专用字段
  ttft?: number;
  total_duration?: number;
  pure_generate_duration?: number;
  token_usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  conversation_id?: string;
}

// ---------------------------------------------------------------------------
// 私有工具：reasoning 提取
// ---------------------------------------------------------------------------

/**
 * reasoning 字段名优先级表（js-set-map-lookups 规则：用 Map 代替 if-else 链）
 * 按各厂商返回字段名排列，找到第一个非空值即返回。
 */
const REASONING_FIELD_PRIORITY: ReadonlyArray<string> = [
  'reasoning_content', // OpenAI-compatible / DeepSeek / SiliconFlow
  'reasoning',         // OpenRouter 透传
  'thought',           // 部分 Gemini
  'thinking',          // 部分 Gemini
  'rationale',         // 其他兜底
];

function extractReasoningFromAdditionalKwargs(ak: Record<string, unknown>): string | null {
  for (const field of REASONING_FIELD_PRIORITY) {
    const val = ak[field];
    if (typeof val === 'string' && val) return val;
  }
  return null;
}

/**
 * Anthropic / Gemini 把 thinking 放在 content 数组的 block 里：
 *   [{ type: "thinking", thinking: "..." }, { type: "text", text: "..." }]
 */
function extractThinkingFromContentBlocks(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === 'object') {
      const b = block as Record<string, unknown>;
      if (b.type === 'thinking' && typeof b.thinking === 'string' && b.thinking) {
        parts.push(b.thinking);
      }
    }
  }
  return parts.length > 0 ? parts.join('') : null;
}

function extractReasoning(chunk: Record<string, unknown>): string | null {
  const ak = (chunk.additional_kwargs ?? {}) as Record<string, unknown>;
  return (
    extractReasoningFromAdditionalKwargs(ak) ??
    extractThinkingFromContentBlocks(chunk.content) ??
    null
  );
}

// ---------------------------------------------------------------------------
// 私有工具：content 提取
// ---------------------------------------------------------------------------

function extractTextContent(chunk: Record<string, unknown>): string | null {
  const content = chunk.content;

  // 1. 字符串形式（最常见）
  if (typeof content === 'string') {
    return content || null;
  }

  // 2. content-block 数组（Anthropic / Gemini）
  if (Array.isArray(content)) {
    const text = content
      .filter(
        (b): b is Record<string, unknown> =>
          b !== null && typeof b === 'object' && (b as Record<string, unknown>).type === 'text'
      )
      .map((b) => (typeof b.text === 'string' ? b.text : ''))
      .join('');
    return text || null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// 私有工具：tool_call 提取
// ---------------------------------------------------------------------------

interface RawToolCall {
  name?: string;
  id?: string;
  args?: unknown;
}

function extractToolCalls(chunk: Record<string, unknown>): RawToolCall[] {
  // LangChain 标准位置
  if (Array.isArray(chunk.tool_calls) && chunk.tool_calls.length > 0) {
    return chunk.tool_calls as RawToolCall[];
  }
  // 部分厂商走 additional_kwargs
  const ak = (chunk.additional_kwargs ?? {}) as Record<string, unknown>;
  if (Array.isArray(ak.tool_calls) && ak.tool_calls.length > 0) {
    return ak.tool_calls as RawToolCall[];
  }
  return [];
}

// ---------------------------------------------------------------------------
// 主函数
// ---------------------------------------------------------------------------

export interface NormalizeMetadata {
  langgraph_node?: string;
}

/**
 * 将单个 LangChain messageChunk 归一化为 0 到 N 个 StandardLLMEvent。
 * 调用方只需遍历返回的数组，依次 feed 给 accumulator / SSE serializer。
 */
export function normalizeMessageChunk(
  chunk: unknown,
  metadata: NormalizeMetadata
): StandardLLMEvent[] {
  // js-early-exit：非对象直接返回空
  if (!chunk || typeof chunk !== 'object') return [];

  const c = chunk as Record<string, unknown>;
  const node = metadata.langgraph_node;
  const events: StandardLLMEvent[] = [];

  // 1. reasoning / thought
  const reasoning = extractReasoning(c);
  if (reasoning) {
    events.push({ type: 'thought', text: reasoning, node });
  }

  // 2. content
  const text = extractTextContent(c);
  if (text) {
    // 工具节点的 content → tool_result（避免大段中间文本直接渲染）
    const type: LLMEventType = node === 'tools' ? 'tool_result' : 'content';
    events.push({ type, text, node });
  }

  // 3. tool_call
  const toolCalls = extractToolCalls(c);
  for (const tc of toolCalls) {
    if (tc?.name) {
      events.push({
        type: 'tool_call',
        tool: tc.name,
        message: `正在准备调用: ${tc.name}...`,
        node,
      });
    }
  }

  return events;
}
