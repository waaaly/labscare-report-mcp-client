// lib/llm/client.ts
import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { logger } from '../logger';

// ====================== 类型定义 ======================
type LlmType = 'openai' | 'anthropic';

type LlmClient = OpenAI | Anthropic;

interface CreateLlmClientOptions {
  type: LlmType;
  model: string;
}

interface ChatCompletionOptions {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  onProgress?: (chunk: string) => void;
}

// ====================== 单例缓存 ======================
let llmClientInstance: LlmClient | null = null;
let currentLlmType: LlmType | null = null;
let currentModel: string | null = null;
let isCreating = false;

// ====================== 客户端创建 ======================
/**
 * 创建 LLM Client（全局单例）
 */
export async function createLlmClient({
  type,
  model,
}: CreateLlmClientOptions): Promise<LlmClient> {
  // 检查是否已经创建了相同类型和模型的客户端
  if (llmClientInstance && currentLlmType === type && currentModel === model) {
    return llmClientInstance;
  }

  if (isCreating) {
    while (isCreating) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (llmClientInstance && currentLlmType === type && currentModel === model) {
        return llmClientInstance;
      }
    }
  }

  isCreating = true;

  try {
    let client: LlmClient;
    let apiKey: string;
    let baseURL: string | undefined;

    if (type === 'openai') {
      apiKey = process.env.OPENAI_API_KEY || '';
      baseURL = process.env.OPENAI_BASE_URL;
      
      if (!apiKey) {
        throw new Error('请在 .env 中配置 OPENAI_API_KEY');
      }
      
      client = new OpenAI({
        apiKey,
        baseURL: baseURL || 'https://api.openai.com/v1',
      });
      logger.info(`✅ OpenAI Client 创建成功 baseURL: ${baseURL} (模型: ${model})`);
    } else if (type === 'anthropic') {
      apiKey = process.env.ANTHROPIC_API_KEY || '';
      baseURL = process.env.ANTHROPIC_BASE_URL;
      
      if (!apiKey) {
        throw new Error('请在 .env 中配置 ANTHROPIC_API_KEY');
      }
      
      client = new Anthropic({
        apiKey,
        baseURL: baseURL || 'https://api.anthropic.com/v1',
      });
      logger.info(`✅ Anthropic Client 创建成功 (模型: ${model})`);
    } else {
      throw new Error(`不支持的 LLM 类型: ${type}`);
    }

    llmClientInstance = client;
    currentLlmType = type;
    currentModel = model;
    return client;
  } catch (err) {
    logger.error('❌ LLM Client 创建失败:', err);
    throw err;
  } finally {
    isCreating = false;
  }
}

// ====================== 关闭客户端 ======================
/**
 * 关闭 LLM 连接
 */
export async function closeLlmClient(): Promise<void> {
  const client = llmClientInstance;

  // 先清空单例
  llmClientInstance = null;
  currentLlmType = null;
  currentModel = null;

  if (!client) return;

  try {
    // 不同客户端的关闭方法可能不同
    // OpenAI 和 Anthropic SDK 目前没有明确的 close 方法
    // 这里主要是清理单例
    logger.info('🛑 LLM Client 已清理');
  } catch (err) {
    logger.error('关闭 LLM Client 失败', { error: err });
  }
}

// ====================== 常用方法封装 ======================

/**
 * 聊天完成
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<string> {
  if (!llmClientInstance || !currentLlmType || !currentModel) {
    throw new Error('请先调用 createLlmClient 创建 LLM 客户端');
  }

  try {
    if (currentLlmType === 'openai') {
      const openaiClient = llmClientInstance as OpenAI;
      
      // 明确指定返回类型
      const response = await openaiClient.chat.completions.create({
        model: currentModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: !!options.onProgress,
      });

      if (options.onProgress) {
        // 处理流式响应
        const stream = response as any;
        if (stream[Symbol.asyncIterator]) {
          let fullResponse = '';
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            fullResponse += content;
            options.onProgress(content);
          }
          return fullResponse;
        }
      }
      
      // 处理非流式响应
      const nonStreamResponse = response as any;
      return nonStreamResponse.choices[0]?.message?.content || '';
    } else if (currentLlmType === 'anthropic') {
      const anthropicClient = llmClientInstance as Anthropic;
      
      // 转换 messages 格式，Anthropic 不支持 system 角色
      const anthropicMessages = options.messages.map(msg => {
        if (msg.role === 'system') {
          return {
            role: 'user' as const,
            content: `System: ${msg.content}`
          };
        }
        return msg;
      });
      
      // 明确指定返回类型
      const response = await anthropicClient.messages.create({
        model: currentModel,
        messages: anthropicMessages as any,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 1024,
        stream: !!options.onProgress,
      });

      if (options.onProgress) {
        // 处理流式响应
        const stream = response as any;
        if (stream[Symbol.asyncIterator]) {
          let fullResponse = '';
          for await (const chunk of stream) {
            if ('delta' in chunk && chunk.delta?.text) {
              const content = chunk.delta.text;
              fullResponse += content;
              options.onProgress(content);
            }
          }
          return fullResponse;
        }
      }
      
      // 处理非流式响应
      const nonStreamResponse = response as any;
      const textContent = nonStreamResponse.content?.find((block: any) => block.type === 'text');
      return textContent?.text || '';
    } else {
      throw new Error(`不支持的 LLM 类型: ${currentLlmType}`);
    }
  } catch (err) {
    logger.error('聊天完成失败', { error: err, options });
    throw err;
  }
}

/**
 * 文本完成（仅 OpenAI 支持）
 */
export async function textCompletion(
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  if (!llmClientInstance || currentLlmType !== 'openai') {
    throw new Error('请先调用 createLlmClient 创建 OpenAI 客户端');
  }

  try {
    const openaiClient = llmClientInstance as OpenAI;
    const response = await openaiClient.completions.create({
      model: currentModel!,
      prompt,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    });

    return response.choices[0]?.text || '';
  } catch (err) {
    logger.error('文本完成失败', { error: err, prompt });
    throw err;
  }
}

// ====================== 类型导出 ======================
export type { LlmType, LlmClient, CreateLlmClientOptions, ChatCompletionOptions };
export { OpenAI, Anthropic };