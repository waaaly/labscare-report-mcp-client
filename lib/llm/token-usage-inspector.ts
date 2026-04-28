/**
 * Token 使用量回调处理器
 * 
 * 用于捕获 LangChain LLM 调用的 token 使用量信息
 * 通过回调传递给 SSE 流返回给前端
 */

import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { logger } from '@/lib/logger';

export interface TokenUsageResult {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export class TokenUsageInspector extends BaseCallbackHandler {
  name = "token_usage_inspector";
  
  private tokenUsage: TokenUsageResult = {};
  private onTokenUsageCallback?: (usage: TokenUsageResult) => void;

  constructor(onTokenUsageCallback?: (usage: TokenUsageResult) => void) {
    super();
    this.onTokenUsageCallback = onTokenUsageCallback;
  }

  // 当 LLM 请求完成时触发，可以获取 usage 信息
  handleLLMEnd(output: any, runId: string, parentRunId?: string) {
    try {
      // 从 output.llmOutput 中获取 usage 信息
      // LangChain 会在此字段中返回 usage
      const llmOutput = output?.llmOutput;
      // console.log(llmOutput,123);
       if (llmOutput?.tokenUsage) {
        this.tokenUsage = {
          promptTokens: llmOutput.tokenUsage.promptTokens || llmOutput.tokenUsage.input_tokens || 0,
          completionTokens: llmOutput.tokenUsage.completionTokens || llmOutput.tokenUsage.output_tokens || 0,
          totalTokens: llmOutput.tokenUsage.totalTokens || 0,
        };
        
        logger.info({ tokenUsage: this.tokenUsage }, '[TokenUsage] 获取到 token 使用量');
        
        // 如果有回调，立即通知
        if (this.onTokenUsageCallback) {
          this.onTokenUsageCallback(this.tokenUsage);
        }
      }
      if (llmOutput?.usage) {
        this.tokenUsage = {
          promptTokens: llmOutput.usage.prompt_tokens || llmOutput.usage.input_tokens || 0,
          completionTokens: llmOutput.usage.completion_tokens || llmOutput.usage.output_tokens || 0,
          totalTokens: llmOutput.usage.total_tokens || 0,
        };
        
        logger.info({ tokenUsage: this.tokenUsage }, '[TokenUsage] 获取到 token 使用量');
        
        // 如果有回调，立即通知
        if (this.onTokenUsageCallback) {
          this.onTokenUsageCallback(this.tokenUsage);
        }
      }
      
      // 有些模型返回在 additional_kwargs 中
      if (llmOutput?.additional_kwargs?.usage) {
        const usage = llmOutput.additional_kwargs.usage;
        this.tokenUsage = {
          promptTokens: usage.prompt_tokens || usage.input_tokens || this.tokenUsage.promptTokens || 0,
          completionTokens: usage.completion_tokens || usage.output_tokens || this.tokenUsage.completionTokens || 0,
          totalTokens: usage.total_tokens || this.tokenUsage.totalTokens || 0,
        };
        
        if (this.onTokenUsageCallback) {
          this.onTokenUsageCallback(this.tokenUsage);
        }
      }
      
    } catch (error) {
      logger.error({ error }, '[TokenUsage] 解析 token 使用量失败');
    }
  }

  // 获取累积的 token 使用量
  getTokenUsage(): TokenUsageResult {
    return { ...this.tokenUsage };
  }

  // 重置计数器
  reset(): void {
    this.tokenUsage = {};
  }
}

// 共享实例（用于跨请求传递）
let sharedTokenInspector: TokenUsageInspector | null = null;

export function getSharedTokenInspector(): TokenUsageInspector {
  if (!sharedTokenInspector) {
    sharedTokenInspector = new TokenUsageInspector();
  }
  return sharedTokenInspector;
}

export function resetSharedTokenInspector(): void {
  if (sharedTokenInspector) {
    sharedTokenInspector.reset();
  }
}
