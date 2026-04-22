/**
 * Agent Factory - 实现任务级 Agent 实例化
 *
 * 设计原则：
 * 1. LLM 实例单例：复用 HTTP 连接，降低开销
 * 2. Skill 工具单例：避免重复加载
 * 3. Agent 实例化：每个任务独立 Agent，隔离状态
 * 4. 并发控制：通过 LLM 实例的 maxConcurrency 控制
 */

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { loadKnowledgeSkill } from "./skill-loader";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import path from "path";
import { logger } from "@/lib/logger";

// ===== 代理配置 =====
const proxyAgent = new ProxyAgent("http://127.0.0.1:7897");
setGlobalDispatcher(proxyAgent);

// ===== 单例：LLM 实例（复用 HTTP 连接）=====
let sharedLlm: ChatOpenAI | null = null;

/**
 * 获取共享的 LLM 实例
 * 使用连接池复用 HTTP 连接，降低初始化开销
 */
export async function getSharedLlm(): Promise<ChatOpenAI> {
  if (!sharedLlm) {
    const maxConcurrency = Number(process.env.LLM_MAX_CONCURRENCY || 10);
    const timeout = Number(process.env.LLM_TIMEOUT || 120000);

    logger.info(`[AgentFactory] 初始化共享 LLM 实例，maxConcurrency=${maxConcurrency}, timeout=${timeout}ms`);

    sharedLlm = new ChatOpenAI({
      apiKey: process.env.FLOW_API_KEY || "",
      modelName: process.env.LLM_MODEL_NAME || "Pro/moonshotai/Kimi-K2.5",
      configuration: {
        baseURL: process.env.FLOW_API_BASE_URL || "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.APP_URL || "http://localhost:8081",
          "X-Title": "LabFlow MCP Studio",
        },
      },
      // 关键：设置最大并发数
      maxConcurrency,
      timeout,
      streaming: true,
      maxRetries: Number(process.env.LLM_MAX_RETRIES || 3),
    });

    logger.info(`[AgentFactory] LLM 实例初始化完成`);
  }
  return sharedLlm;
}

// ===== 单例：Skill 工具（只加载一次）=====
let labscareTool: any = null;

/**
 * 获取共享的 Skill 工具
 * 只加载一次，避免重复读取文件
 */
async function getSharedTool(): Promise<any> {
  if (!labscareTool) {
    logger.info(`[AgentFactory] 加载 Skill 工具`);
    const skillPath = path.join(process.cwd(), "skills", "labscare-script");
    labscareTool = await loadKnowledgeSkill(skillPath);

    logger.info(`[AgentFactory] Skill 工具加载完成: ${labscareTool?.name || 'unknown'}`);
  }
  return labscareTool;
}

// ===== 系统提示词 =====
const SYSTEM_PROMPT = `
你是 LabsCare 报表开发助手。

【铁律 - 必须严格遵守】
1. 任何涉及 LabsCare LIMS 报表脚本的编写、修改、调试、解释、占位符、模板、JSON 数据结构等任务时，
   **必须先调用工具 get_labscare_script_rules** 获取官方规范和参考示例。
2. **绝不允许**在未调用该工具前直接生成、修改或解释脚本。
3. 只有拿到工具返回的内容后，才能基于它进行后续回答。
4. 用户提到 "报表脚本"、"Labscare"、"LIMS"、"模板图片"、"占位符"、"预期结果图"、"data 结构" 等任何相关词时，都要优先调用工具。

当前可用工具：
- get_labscare_script_rules：获取 LabsCare 报表脚本的完整规范、决策优先级、占位符逻辑、模板联动规则及参考示例。

请严格按照以上规则执行。
`;

// ===== 工厂函数：创建任务级 Agent 实例 =====

/**
 * 创建 Agent 实例
 * 每次调用返回一个新的 Agent 实例，但共享底层的 LLM 和 Skill 工具
 * 这样可以：
 * 1. 每个任务有独立的 Agent 状态，互不干扰
 * 2. 复用 LLM 的 HTTP 连接，降低开销
 * 3. 复用 Skill 工具，避免重复加载
 */
export async function createAgentInstance(): Promise<any> {
  const llm = await getSharedLlm();
  const tool = await getSharedTool();

  const agent = createAgent({
    model: llm,
    tools: [tool],
    systemPrompt: SYSTEM_PROMPT,
  });

  logger.debug(`[AgentFactory] 创建新的 Agent 实例`);

  return agent;
}

// ===== 兼容现有代码：全局 Agent 单例 =====
// 注意：为了保持现有功能不变，仍然导出全局 Agent
// 但在批量任务场景下，应使用 createAgentInstance()

import { loadKnowledgeSkill as loadSkillFromPath } from "./skill-loader";

async function initializeLegacyAgent() {
  const skillPath = path.join(process.cwd(), "skills", "labscare-script");
  const labscareTool = await loadSkillFromPath(skillPath);

  const tools = [labscareTool];

  logger.info({ toolsCount: tools.length, toolsNames: tools.map((t) => t.name) }, "🔧 准备传入 createAgent 的工具：");

  if (tools.length === 0) {
    logger.warn("⚠️ tools 数组为空！");
  }

  // 兼容现有代码：使用共享 LLM 实例
  const llm = await getSharedLlm();

  const agent = createAgent({
    model: llm,
    tools,
    systemPrompt: SYSTEM_PROMPT,
  });

  logger.info("✅ Agent 创建完成，工具已绑定");

  return agent;
}

// 导出兼容现有代码的全局 Agent 获取函数
let legacyAgent: any = null;

export async function getLegacyAgent(): Promise<any> {
  if (!legacyAgent) {
    legacyAgent = await initializeLegacyAgent();
  }
  return legacyAgent;
}

// 为了保持向后兼容，仍然导出agent变量，但它会在首次访问时初始化
let agentPromise: Promise<any> | null = null;
export const agent: any = new Proxy({}, {
  get: async function(_, prop) {
    if (!agentPromise) {
      agentPromise = getLegacyAgent();
    }
    const actualAgent = await agentPromise;
    return actualAgent[prop];
  }
});

// ===== 工具函数：重置工厂 =====

/**
 * 重置 Agent 工厂（用于测试或优雅关闭）
 */
export function resetAgentFactory(): void {
  logger.warn("[AgentFactory] 重置 Agent 工厂");
  labscareTool = null;
  // 注意：不重置 LLM 实例，因为可能有正在进行的请求
}
