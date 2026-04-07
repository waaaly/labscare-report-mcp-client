/**
 * 配置验证和环境变量管理
 *
 * 功能：
 * 1. 使用 Zod 验证环境变量
 * 2. 提供类型安全的配置访问
 * 3. 在启动时验证所有必需的配置
 */

import { z } from 'zod';

// ===== 环境变量 Schema =====

const envSchema = z.object({
  // 应用配置
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  APP_URL: z.string().url().default('http://localhost:8081'),

  // Redis 配置
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),

  // LLM 配置
  FLOW_API_KEY: z.string().min(1, 'FLOW_API_KEY is required'),
  FLOW_API_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  LLM_MODEL_NAME: z.string().default('Pro/moonshotai/Kimi-K2.5'),
  LLM_MAX_CONCURRENCY: z.string().transform(Number).default('10'),
  LLM_TIMEOUT: z.string().transform(Number).default('120000'),
  LLM_MAX_RETRIES: z.string().transform(Number).default('3'),

  // Worker 配置
  WORKER_CONCURRENCY: z.string().transform(Number).default('3'),

  // 批量处理
  MAX_BATCH_SIZE: z.string().transform(Number).default('10'),
  MAX_PROMPT_LENGTH: z.string().transform(Number).default('10000'),

  // 日志
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // 监控
  METRICS_ENABLED: z.string().transform(val => val === 'true').default('false'),
  METRICS_PORT: z.string().transform(Number).default('9090'),

  // 安全
  API_KEY: z.string().optional(),
  ENABLE_CSRF: z.string().transform(val => val === 'true').default('false'),
});

// ===== 类型定义 =====

export type Env = z.infer<typeof envSchema>;

// ===== 环境变量验证 =====

let validatedEnv: Env | null = null;

/**
 * 获取验证后的环境变量
 * 首次调用时会进行验证，后续调用返回缓存的结果
 */
export function getEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ 环境变量验证失败:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\n请检查 .env 文件或设置正确的环境变量。');
    }
    throw error;
  }
}

// ===== 导出环境变量（向后兼容） =====

export const env = getEnv();

// ===== 配置助手函数 =====

/**
 * 判断是否为生产环境
 */
export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * 判断是否为开发环境
 */
export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

/**
 * 判断是否为测试环境
 */
export function isTest(): boolean {
  return env.NODE_ENV === 'test';
}

/**
 * 获取 Redis 连接配置
 */
export function getRedisConfig() {
  const url = new URL(env.REDIS_URL);

  return {
    host: url.hostname,
    port:  Number(env.REDIS_URL?.split(':')[2].split('/')[0]) || 6379,
    password: env.REDIS_PASSWORD || url.password || undefined,
    db: env.REDIS_DB,
  };
}

/**
 * 验证 LLM 配置
 */
export function validateLLMConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!env.FLOW_API_KEY) {
    errors.push('FLOW_API_KEY is required');
  }

  if (env.LLM_MAX_CONCURRENCY < 1 || env.LLM_MAX_CONCURRENCY > 100) {
    errors.push('LLM_MAX_CONCURRENCY must be between 1 and 100');
  }

  if (env.LLM_TIMEOUT < 1000 || env.LLM_TIMEOUT > 600000) {
    errors.push('LLM_TIMEOUT must be between 1000 and 600000');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证 Worker 配置
 */
export function validateWorkerConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (env.WORKER_CONCURRENCY < 1 || env.WORKER_CONCURRENCY > 20) {
    errors.push('WORKER_CONCURRENCY must be between 1 and 20');
  }

  if (env.WORKER_CONCURRENCY > env.LLM_MAX_CONCURRENCY) {
    errors.push(`WORKER_CONCURRENCY (${env.WORKER_CONCURRENCY}) should not exceed LLM_MAX_CONCURRENCY (${env.LLM_MAX_CONCURRENCY})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证批量处理配置
 */
export function validateBatchConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (env.MAX_BATCH_SIZE < 1 || env.MAX_BATCH_SIZE > 100) {
    errors.push('MAX_BATCH_SIZE must be between 1 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ===== 启动时验证 =====

/**
 * 验证所有配置
 */
export function validateAllConfigs(): { valid: boolean; errors: string[] } {
  const allErrors: string[] = [];

  const llmResult = validateLLMConfig();
  if (!llmResult.valid) {
    allErrors.push(...llmResult.errors);
  }

  const workerResult = validateWorkerConfig();
  if (!workerResult.valid) {
    allErrors.push(...workerResult.errors);
  }

  const batchResult = validateBatchConfig();
  if (!batchResult.valid) {
    allErrors.push(...batchResult.errors);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

// 默认导出
export default getEnv;
