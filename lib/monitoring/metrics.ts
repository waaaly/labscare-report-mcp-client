/**
 * 监控指标模块 - Prometheus 指标采集
 *
 * 功能：
 * 1. 定义 Prometheus 指标
 * 2. 提供指标记录和查询接口
 * 3. 集成到 Worker 和 API 层
 */

import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';
import { logger } from '@/lib/logger';

// ===== 注册表 =====

export const register = new Registry();

// 收集默认指标（CPU、内存等）
collectDefaultMetrics({ register });

// ===== 任务指标 =====

/**
 * 任务总数计数器
 * labels: status (queued, processing, completed, failed), batch_id
 */
export const taskCounter = new Counter({
  name: 'tasks_total',
  help: 'Total number of tasks processed',
  labelNames: ['status', 'batch_id'] as const,
  registers: [register],
});

/**
 * 任务处理时长直方图
 * labels: status
 */
export const taskDuration = new Histogram({
  name: 'task_duration_seconds',
  help: 'Task processing duration in seconds',
  labelNames: ['status'] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300, 600], // 1s, 5s, 10s, 30s, 1m, 2m, 5m, 10m
  registers: [register],
});

/**
 * 当前活跃任务数
 */
export const activeTasks = new Gauge({
  name: 'tasks_active',
  help: 'Number of currently active tasks',
  registers: [register],
});

/**
 * 队列积压任务数
 * labels: queue_name
 */
export const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Current queue size',
  labelNames: ['queue_name'] as const,
  registers: [register],
});

// ===== LLM 指标 =====

/**
 * LLM 调用总数
 * labels: model, status (success, error, timeout)
 */
export const llmCallCounter = new Counter({
  name: 'llm_calls_total',
  help: 'Total number of LLM calls',
  labelNames: ['model', 'status'] as const,
  registers: [register],
});

/**
 * LLM 调用延迟
 * labels: model
 */
export const llmLatency = new Histogram({
  name: 'llm_latency_seconds',
  help: 'LLM call latency in seconds',
  labelNames: ['model'] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120], // 0.5s, 1s, 2s, 5s, 10s, 30s, 1m, 2m
  registers: [register],
});

/**
 * LLM 首字响应时间 (TTFT)
 * labels: model
 */
export const llmTTFT = new Histogram({
  name: 'llm_ttft_seconds',
  help: 'LLM time to first token in seconds',
  labelNames: ['model'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10], // 100ms, 500ms, 1s, 2s, 5s, 10s
  registers: [register],
});

/**
 * LLM Token 使用量
 * labels: model, type (input, output)
 */
export const llmTokens = new Counter({
  name: 'llm_tokens_total',
  help: 'Total number of LLM tokens used',
  labelNames: ['model', 'type'] as const,
  registers: [register],
});

// ===== API 指标 =====

/**
 * API 请求总数
 * labels: endpoint, method, status
 */
export const apiRequestCounter = new Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['endpoint', 'method', 'status'] as const,
  registers: [register],
});

/**
 * API 请求延迟
 * labels: endpoint, method
 */
export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['endpoint', 'method'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// ===== SSE 指标 =====

/**
 * SSE 连接数
 */
export const sseConnections = new Gauge({
  name: 'sse_connections',
  help: 'Number of active SSE connections',
  registers: [register],
});

/**
 * SSE 消息发送数
 * labels: type
 */
export const sseMessagesSent = new Counter({
  name: 'sse_messages_sent_total',
  help: 'Total number of SSE messages sent',
  labelNames: ['type'] as const,
  registers: [register],
});

/**
 * SSE 消息发送延迟
 */
export const sseMessageLatency = new Histogram({
  name: 'sse_message_latency_seconds',
  help: 'SSE message latency in seconds',
  buckets: [0.001, 0.01, 0.1, 0.5, 1],
  registers: [register],
});

// ===== 错误指标 =====

/**
 * 错误总数
 * labels: type, severity
 */
export const errorCounter = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity'] as const,
  registers: [register],
});

// ===== 辅助函数 =====

/**
 * 记录任务开始
 */
export function recordTaskStart(batchId?: string): void {
  activeTasks.inc();
  taskCounter.inc({ status: 'processing', batch_id: batchId || 'none' });
}

/**
 * 记录任务完成
 */
export function recordTaskComplete(
  durationSeconds: number,
  batchId?: string,
  status: 'completed' | 'failed' = 'completed'
): void {
  activeTasks.dec();
  taskCounter.inc({ status, batch_id: batchId || 'none' });
  taskDuration.observe({ status }, durationSeconds);
}

/**
 * 记录 LLM 调用
 */
export function recordLLMCall(
  model: string,
  durationSeconds: number,
  status: 'success' | 'error' | 'timeout' = 'success'
): void {
  llmCallCounter.inc({ model, status });
  llmLatency.observe({ model }, durationSeconds);
}

/**
 * 记录 TTFT
 */
export function recordTTFT(model: string, ttftSeconds: number): void {
  llmTTFT.observe({ model }, ttftSeconds);
}

/**
 * 记录 Token 使用量
 */
export function recordTokenUsage(model: string, inputTokens: number, outputTokens: number): void {
  llmTokens.inc({ model, type: 'input' }, inputTokens);
  llmTokens.inc({ model, type: 'output' }, outputTokens);
}

/**
 * 记录 API 请求
 */
export function recordAPIRequest(
  endpoint: string,
  method: string,
  statusCode: number,
  durationSeconds: number
): void {
  const status = statusCode >= 500 ? 'server_error' : statusCode >= 400 ? 'client_error' : 'success';
  apiRequestCounter.inc({ endpoint, method, status });
  apiRequestDuration.observe({ endpoint, method }, durationSeconds);
}

/**
 * 记录错误
 */
export function recordError(type: string, severity: 'low' | 'medium' | 'high' = 'low'): void {
  errorCounter.inc({ type, severity });
}

/**
 * 记录队列大小
 */
export function recordQueueSize(queueName: string, size: number): void {
  queueSize.set({ queue_name: queueName }, size);
}

/**
 * 获取所有指标的 Prometheus 格式输出
 */
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

/**
 * 重置所有指标（用于测试）
 */
export function resetMetrics(): void {
  register.resetMetrics();
}

// ===== 初始化 =====

if (typeof process !== 'undefined') {
  // 在 Worker 进程中监听指标
  process.on('uncaughtException', (err) => {
    logger.error({ err }, '[Metrics] Uncaught exception');
    recordError('uncaught_exception', 'high');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, '[Metrics] Unhandled rejection');
    recordError('unhandled_rejection', 'medium');
  });
}

// 导出类型
export type MetricsRegistry = typeof register;
