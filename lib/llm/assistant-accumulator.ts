/**
 * lib/llm/assistant-accumulator.ts
 *
 * 分字段累积助手回复，修复 assistantContent 丢失问题。
 *
 * 原问题根因：
 *   route.ts 只在 typeof chunk.content === "string" 时才拼接 assistantContent，
 *   Anthropic / Gemini 返回 content-block 数组时被完全跳过，最终存入 DB 的是空字符串。
 *
 * 新方案：
 *   由 normalizer 保证所有文本内容都已提取为 StandardLLMEvent.text（string），
 *   accumulator 只做简单拼接，零歧义。
 */

import type { StandardLLMEvent } from './normalizer';

export interface AssistantSavePayload {
  content: string;
  reasoning?: string;
}

export class AssistantAccumulator {
  private _content = '';
  private _reasoning = '';

  /**
   * 消费一个标准事件，累积对应文本。
   * - type === 'content'  → 正文
   * - type === 'thought'  → 思考链（reasoning）
   * - 其他类型不累积文本
   */
  feed(event: StandardLLMEvent): void {
    if (!event.text) return;

    if (event.type === 'content') {
      this._content += event.text;
    } else if (event.type === 'thought') {
      this._reasoning += event.text;
    }
    // tool_call / tool_result / status / metrics / error 不累积到最终助手消息
  }

  /** 是否有实质内容（用于决定是否写 DB） */
  hasContent(): boolean {
    return this._content.trim().length > 0;
  }

  /** 返回存入 DB 的 payload，reasoning 为空时不包含该字段 */
  toSavePayload(): AssistantSavePayload {
    const payload: AssistantSavePayload = {
      content: this._content.trim(),
    };
    const trimmedReasoning = this._reasoning.trim();
    if (trimmedReasoning) {
      payload.reasoning = trimmedReasoning;
    }
    return payload;
  }

  /** 重置（供单元测试或重试场景使用） */
  reset(): void {
    this._content = '';
    this._reasoning = '';
  }
}
