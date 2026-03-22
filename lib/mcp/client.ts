// lib/mcp/client.ts
import {
  Client,
} from '@modelcontextprotocol/sdk/client/index.js';
import {
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  CallToolResult,
  Resource,
  ListToolsResult,
  ListResourcesResult,
} from '@modelcontextprotocol/sdk/types.js';
import {
  LoggingMessageNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../logger';

// ====================== 配置 ======================
// StreamableHTTP 端点是 /mcp，不是旧 SSE 模式的 /mcp/sse
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8000/mcp';

if (!MCP_SERVER_URL) {
  throw new Error('请在 .env 中配置 MCP_SERVER_URL');
}

// ====================== 单例缓存 ======================
let mcpClientInstance: Client | null = null;
let currentTransport: StreamableHTTPClientTransport | null = null;
let isConnecting = false;

/**
 * 获取已连接的 MCP Client（全局单例，断线自动清理）
 */
export async function getMcpClient(
  onLog?: (level: string, message: string) => void  // 新增可选回调
): Promise<Client> {
  if (mcpClientInstance) return mcpClientInstance;

  if (isConnecting) {
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (mcpClientInstance) return mcpClientInstance;
    }
  }

  isConnecting = true;

  try {
    const client = new Client(
      { name: 'labscare-report-mcp-client', version: '1.0.0' },
      { capabilities: {} }
    );

    const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL));

    client.onclose = () => {
      logger.warn('⚠️ MCP 连接已断开，下次调用将自动重连');
      mcpClientInstance = null;
      currentTransport = null;
    };

    client.onerror = (error: Error) => {
      logger.error('❌ MCP 传输层错误:', error);
    };

    await client.connect(transport);

    // 注册服务端日志通知监听
    client.setNotificationHandler(
      LoggingMessageNotificationSchema,  // SDK 内置 schema
      (notification) => {
        const level = notification.params.level;
        const data = notification.params.data;
        const message = typeof data === 'string' ? data : JSON.stringify(data);
   
        logger.info(`[MCP Server Log][${level}] ${message}`);
        onLog?.(level, message);
      }
    );

    logger.info('✅ MCP Client 连接成功 (Streamable HTTP)');

    mcpClientInstance = client;
    currentTransport = transport;
    return client;
  } catch (err) {
    logger.error('❌ MCP 连接失败:', err);
    throw err;
  } finally {
    isConnecting = false;
  }
}

/**
 * 关闭 MCP 连接
 * 规范要求：先 terminateSession() 通知 server，再 client.close()
 */
export async function closeMcpClient(): Promise<void> {
  const transport = currentTransport;
  const client = mcpClientInstance;

  // 先清空单例，防止关闭期间并发调用
  mcpClientInstance = null;
  currentTransport = null;

  if (!client) return;

  try {
    // 1. 通知 server 终止 session（v1.x StreamableHTTPClientTransport 支持）
    if (transport && typeof (transport as any).terminateSession === 'function') {
      await (transport as any).terminateSession();
    }
    // 2. 关闭本地连接
    await client.close();
    logger.info('🛑 MCP Client 已优雅关闭');
  } catch (err) {
    logger.error('关闭 MCP Client 失败', { error: err });
  }
}

// ====================== 常用工具封装 ======================

/**
 * 调用 Tool
 *
 * v1.x callTool 签名：
 *   callTool(params, resultSchema?, options?)
 *   - 第二个参数是 ResultSchema（不需要时传 undefined）
 *   - 第三个参数才是 RequestOptions（含 onprogress / timeout）
 *
 * 原代码把 options 错误地放在第二个位置，导致实际上没有生效。
 */
export async function callMcpTool<T = any>(
  name: string,
  argumentsObj: Record<string, any> = {},
  options?: {
    onProgress?: (progress: number, total?: number) => void;
    onLog?: (level: string, message: string) => void;  // 新增
    timeout?: number;
  }
): Promise<T> {
  const client = await getMcpClient();

  // 每次调用前更新日志回调
  if (options?.onLog) {
    client.setNotificationHandler(
      LoggingMessageNotificationSchema,
      (notification) => {
        const level = notification.params.level;
        const data = notification.params.data;
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        options.onLog!(level, message);
      }
    );
  }

  try {
    const result = await client.callTool(
      { name, arguments: argumentsObj },
      undefined,
      {
        onprogress: options?.onProgress
          ? ({ progress, total }: { progress: number; total?: number }) =>
              options.onProgress!(progress, total)
          : undefined,
        timeout: options?.timeout ?? 120_000,
      }
    );

    if (result.isError) {
      logger.error(`Tool 执行失败: ${name}`, { content: result.content });
      throw new Error(`MCP Tool Error: ${JSON.stringify(result.content)}`);
    }

    return result.content as T;
  } catch (err) {
    logger.error(`调用 Tool 失败: ${name}`, { error: err, arguments: argumentsObj });
    throw err;
  }
}

/**
 * 读取 Resource
 */
export async function readMcpResource(uri: string): Promise<{ [x: string]: any & Resource }[]> {
  const client = await getMcpClient();
  const { contents } = await client.readResource({ uri });
  return contents;
}

/**
 * 列出所有 Tools（调试用）
 */
export async function listMcpTools(): Promise<ListToolsResult> {
  const client = await getMcpClient();
  return await client.listTools({});
}

/**
 * 列出所有 Resources（调试用）
 */
export async function listMcpResources(): Promise<ListResourcesResult> {
  const client = await getMcpClient();
  return await client.listResources({});
}

// ====================== 类型导出 ======================
export type { CallToolResult, Resource };
export { Client } from '@modelcontextprotocol/sdk/client/index.js';