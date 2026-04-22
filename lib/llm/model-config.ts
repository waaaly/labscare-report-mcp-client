export type ModelProvider = 'openai' | 'gemini' | 'anthropic';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  name: string;
  apiKey?: string;
  baseURL?: string;
}

// 预定义模型列表
export const availableModels: ModelConfig[] = [
  {
    provider: 'openai' as ModelProvider,
    model: 'gpt-5.3-codex',
    name: 'ChatGPT',
    baseURL: process.env.OPENAI_BASE_URL,
  },
   {
    provider: 'openai' as ModelProvider,
    model: "Pro/moonshotai/Kimi-K2.5",
    name: '硅基流动',
    baseURL:"https://openrouter.ai/api/v1"// process.env.FLOW_API_BASE_URL,
  },
  {
    provider: 'gemini' as ModelProvider,
    model: 'gemini-3-flash-preview',
    name: 'Google Gemini',
    baseURL: process.env.GOOGLE_BASE_URL,
  },
  {
    provider: 'anthropic' as ModelProvider,
    model: 'Claude Sonnet 4.6',
    name: 'Anthropic Claude',
    baseURL: process.env.ANTHROPIC_BASE_URL,
  }

];
