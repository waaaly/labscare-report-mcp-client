/**
 * Token 统计类型定义
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  promptTokens?: number;  // 别名
  completionTokens?: number;  // 别名
}

export interface TokenStats {
  conversation: TokenUsage;  // 当前对话累计
  current: TokenUsage;        // 本次请求
  requestCount: number;       // 请求次数
  lastUpdated: number;        // 最后更新时间
}

// 初始化默认统计
export function createEmptyTokenStats(): TokenStats {
  return {
    conversation: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
    },
    current: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
    },
    requestCount: 0,
    lastUpdated: Date.now(),
  };
}

// 累加 token 使用量
export function accumulateTokenUsage(
  existing: TokenUsage,
  newUsage: Partial<TokenUsage>
): TokenUsage {
  return {
    inputTokens: existing.inputTokens + (newUsage.inputTokens || newUsage.promptTokens || 0),
    outputTokens: existing.outputTokens + (newUsage.outputTokens || newUsage.completionTokens || 0),
    totalTokens: existing.totalTokens + (newUsage.totalTokens || 0),
    promptTokens: (existing.promptTokens || 0) + (newUsage.promptTokens || 0),
    completionTokens: (existing.completionTokens || 0) + (newUsage.completionTokens || 0),
  };
}

// 格式化 token 数量（添加千分位）
export function formatTokenCount(num: number): string {
  return num.toLocaleString('zh-CN');
}

// 估算中文 token（简单估算：1 中文 ≈ 2 tokens）
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishChars = text.length - chineseChars;
  // 中文每个字符约 2 tokens，英文约 0.25 tokens
  return Math.ceil(chineseChars * 2 + englishChars * 0.25);
}
