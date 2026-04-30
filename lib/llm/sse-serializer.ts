/**
 * lib/llm/sse-serializer.ts
 *
 * 将 StandardLLMEvent 序列化为符合 SSE 规范的字符串。
 * 单一职责：不做任何业务判断，只做格式转换。
 */

import type { StandardLLMEvent } from './normalizer';

/**
 * 将一个 StandardLLMEvent 序列化为 SSE data 行。
 * 格式：`data: <json>\n\n`
 */
export function serializeSSE(event: StandardLLMEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * 将 SSE 字符串编码为 Uint8Array（供 ReadableStream controller.enqueue 使用）。
 * 将 encoder 创建移到模块级别，避免在每次调用时重复实例化（server-hoist-static-io 规则）。
 */
const _encoder = new TextEncoder();

export function encodeSSE(event: StandardLLMEvent): Uint8Array {
  return _encoder.encode(serializeSSE(event));
}
