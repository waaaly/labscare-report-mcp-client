// lib/mcp/client.ts
import {
  Client,
} from '@modelcontextprotocol/sdk/client';
import {
  type CallToolResult,
  type Resource,
  type ListToolsResult,
  type ListResourcesResult,

} from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { logger } from '../logger';           // 项目已有的 logger.ts

// ====================== 配置 ======================
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8000/mcp';

if (!MCP_SERVER_URL) {
  throw new Error('请在 .env 中配置 MCP_SERVER_URL');
}

// ====================== 单例缓存 ======================
let mcpClientInstance: Client | null = null;
let currentTransport: StreamableHTTPClientTransport | SSEClientTransport | null = null;

/**
 * 获取已连接的 MCP Client（全局单例，自动重连）
 */
export async function getMcpClient(): Promise<Client> {
  if (mcpClientInstance) {
    return mcpClientInstance;
  }

  logger.info('🔌 初始化 MCP Client...', { url: MCP_SERVER_URL });

  const client = new Client(
    {
      name: 'labscare-report-mcp-client',
      version: '1.0.0',
    },
    {
      // 可选：声明客户端能力（未来扩展采样、提示等）
      capabilities: {},
    }
  );

  // 优先尝试现代 Streamable HTTP（官方推荐）
  let transport: StreamableHTTPClientTransport | SSEClientTransport;
  try {
    transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL));
    await client.connect(transport);
    logger.info('✅ MCP Client 已通过 StreamableHTTP 连接成功');
  } catch (err) {
    logger.warn('StreamableHTTP 连接失败，降级使用 SSE', { error: (err as Error).message });
    transport = new SSEClientTransport(new URL(MCP_SERVER_URL));
    await client.connect(transport);
    logger.info('✅ MCP Client 已通过 SSE 连接成功');
  }

  mcpClientInstance = client;
  currentTransport = transport;

  // 可选：优雅关闭（开发时热重载友好）
  process.on('SIGTERM', async () => {
    await closeMcpClient();
  });

  return client;
}

/**
 * 关闭 MCP 连接（清理资源）
 */
export async function closeMcpClient(): Promise<void> {
  if (mcpClientInstance) {
    try {
      await mcpClientInstance.close();
      if (currentTransport && 'terminateSession' in currentTransport) {
        await (currentTransport as any).terminateSession?.();
      }
      logger.info('🛑 MCP Client 已优雅关闭');
    } catch (err) {
      logger.error('关闭 MCP Client 失败', { error: err });
    }
    mcpClientInstance = null;
    currentTransport = null;
  }
}

// ====================== 常用工具封装（推荐使用这些） ======================

/**
 * 调用 Tool（最常用）
 */
export async function callMcpTool<T = any>(
  name: string,
  argumentsObj: Record<string, any> = {},
  options?: {
    onProgress?: (progress: number, total?: number) => void;
    timeout?: number;
  }
): Promise<T> {
  const client = await getMcpClient();

  try {
    const result = await client.callTool(
      {
        name,
        arguments: argumentsObj,
      },
      undefined,
      {
        onprogress: options?.onProgress
          ? (progress) => options.onProgress!(progress.progress, progress.total)
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
 * 读取 Resource（知识库、配置等）
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

// ====================== 类型导出（方便其他文件 import） ======================
export type { CallToolResult, Resource };
export { Client } from '@modelcontextprotocol/sdk/client';