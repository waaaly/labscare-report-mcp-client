export type ModelProvider = 'openai' | 'gemini' | 'anthropic';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  name: string;
  apiKey?: string;
  baseURL?: string;
  maxInputTokens: number;
  maxOutputTokens: number;
}

// 预定义模型列表
export const availableModels: ModelConfig[] = [
  {
    provider: 'openai' as ModelProvider,
    model: "Pro/moonshotai/Kimi-K2.5",
    name: '硅基流动',
    baseURL: "https://openrouter.ai/api/v1",// process.env.FLOW_API_BASE_URL,
    maxInputTokens: 128000,
    maxOutputTokens: 8192,
  },
  {
    provider: 'openai' as ModelProvider,
    model: "deepseek-v4-flash",
    name: '深度求索',
    baseURL: "https://api.deepseek.com",// process.env.FLOW_API_BASE_URL,
    maxInputTokens: 128000,
    maxOutputTokens: 8192,
  },
  {
    provider: 'openai' as ModelProvider,
    model: 'gpt-5.3-codex',
    name: 'ChatGPT',
    baseURL: process.env.OPENAI_BASE_URL,
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
  },

  {
    provider: 'gemini' as ModelProvider,
    model: 'gemini-3-flash-preview',
    name: 'Google Gemini',
    baseURL: process.env.GOOGLE_BASE_URL,
    maxInputTokens: 1048576,
    maxOutputTokens: 8192,
  },
  {
    provider: 'anthropic' as ModelProvider,
    model: 'Claude Sonnet 4.6',
    name: 'Anthropic Claude',
    baseURL: process.env.ANTHROPIC_BASE_URL,
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
  }

];
