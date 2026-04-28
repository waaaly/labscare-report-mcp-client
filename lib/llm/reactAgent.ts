import { createAgent, ReactAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { loadKnowledgeSkill } from "./skill-loader";
import { systemApiTools, toolNameMap } from "./api-tools";
import * as path from "path";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import { logger, RequestInspector } from '@/lib/logger';
import { ModelProvider, ModelConfig, availableModels } from "./model-config";

import { getSharedLlm } from "./agent-factory";
// 1. 设置全局代理（替换为你的魔法端口，如 7890 或 1080）
const proxyAgent = new ProxyAgent("http://127.0.0.1:7897");
setGlobalDispatcher(proxyAgent);

function getOpenAIKey(config: ModelConfig) {
  switch (config.model) {
    case 'gpt-5.3-codex':
      return process.env.OPENAI_API_KEY || "";
    case 'Pro/moonshotai/Kimi-K2.5':
      return process.env.FLOW_API_KEY || "";
    case 'deepseek-v4-flash':
      return process.env.DEEPSEEK_API_KEY || "";
  }
}
function getOpenAIUrl(config: ModelConfig) {
  switch (config.model) {
    case 'gpt-5.3-codex':
      return process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    case 'Pro/moonshotai/Kimi-K2.5':
      return process.env.FLOW_API_BASE_URL || "https://openrouter.ai/api/v1";
    case 'deepseek-v4-flash':
      return config.baseURL || process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com";
  }
}
// 初始化指定模型
function initializeModel(config: ModelConfig) {
  switch (config.provider) {
    case 'openai':
      return new ChatOpenAI({
        apiKey: getOpenAIKey(config),
        modelName: config.model,
        maxRetries: 3,
        timeout: 120000,
        streaming: true,
        configuration: {
          baseURL: getOpenAIUrl(config),
          defaultHeaders: {
            "HTTP-Referer": "http://localhost:8081",
            "X-Title": "LabFlow MCP Stdio",
            "Authorization": `Bearer ${getOpenAIKey(config)}`
          },
        },
        callbacks: [
          new RequestInspector(),
        ],
      });

    case 'gemini':
      return new ChatGoogleGenerativeAI({
        baseUrl: process.env.GEMINI_BASE_URL || config.baseURL,
        apiKey: process.env.GEMINI_API_KEY || config.apiKey,
        model: config.model,
        temperature: 0.1,
        maxOutputTokens: 8192,
        maxRetries: 5,
        streaming: true,
        callbacks: [
          new RequestInspector(),
        ],
      });

    case 'anthropic':
      return new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY || config.apiKey,
        model: config.model,
        maxRetries: 3,
        streaming: true,
        clientOptions: {
          apiKey: process.env.ANTHROPIC_API_KEY || config.apiKey,
          baseURL: process.env.ANTHROPIC_BASE_URL || config.baseURL,
        },
        callbacks: [
          new RequestInspector(),
        ],
      });

    default:
      throw new Error(`Unsupported model provider: ${config.provider}`);
  }
}

async function initializeAgentWithModel(modelConfig: ModelConfig): Promise<ReactAgent> {
  const llm = initializeModel(modelConfig);
  const skillPath = path.join(process.cwd(), "skills", "labscare-script");
  // 1. 明确等待工具加载
  const labscareTool = await loadKnowledgeSkill(skillPath);

  // 2. 系统 API 工具（让 Agent 能够调用后端功能）
  const apiTools = systemApiTools;

  // 3. 合并所有工具
  const tools = [labscareTool, ...apiTools];

  console.log("🔧 准备传入 createAgent 的工具：");
  console.log("工具数量:", tools.length);
  console.log(
    "工具名称:",
    tools.map((t) => t.name),
  );

  if (tools.length === 0) {
    console.warn("⚠️ tools 数组为空！");
  }
  // 共享 LLM 实例
  const sharedLlm = await getSharedLlm();
  // 4. 创建 agent
  const agent = createAgent({
    model: llm,
    tools,
    systemPrompt: `
你是 LabsCare 报表开发助手，同时也是一个智能管理系统。

【铁律 - 必须严格遵守】
1. 任何涉及 LabsCare LIMS 报表脚本的编写、修改、调试、解释、占位符、模板、JSON 数据结构等任务时，
   **必须先调用工具 get_labscare_script_rules** 获取官方规范和参考示例。
2. **绝不允许**在未调用该工具前直接生成、修改或解释脚本。
3. 只有拿到工具返回的内容后，才能基于它进行后续回答。

【系统管理能力】
你可以帮助用户管理实验室、项目、报告模板、脚本等系统资源。
当用户请求以下操作时，请使用对应的工具：

- "查看实验室列表" → 使用 list_labs
- "创建实验室" → 使用 create_lab
- "查看项目" → 使用 list_projects
- "创建项目" → 使用 create_project
- "查看报告模板" → 使用 list_report_templates
- "创建报告模板" → 使用 create_report_template
- "查看脚本" → 使用 list_scripts
- "保存脚本" → 使用 save_script
- "上传文档" → 使用 upload_document
- "查看知识库" → 使用 get_knowledge_base
- "更新知识库" → 使用 update_knowledge_base
- "查看任务状态" → 使用 get_task_status

【工作流程建议】
当用户说"帮我创建一个酵母检测项目"时：
1. 先调用 list_labs 查看有哪些实验室
2. 让用户选择目标实验室（或默认第一个）
3. 调用 create_project 创建项目

当用户说"帮我生成这个项目的取数脚本"时：
1. 先调用 get_labscare_script_rules 获取脚本规范
2. 了解项目需求
3. 生成脚本并调用 save_script 保存

请严格按照以上规则执行。
`,
  });

  console.log("✅ Agent 创建完成，工具已绑定");

  return agent;
}

// 缓存不同模型的 agent 实例
const agentInstances: Record<string, ReactAgent> = {};

// 生成 agent 实例的键
function getAgentKey(config: ModelConfig): string {
  return `${config.provider}:${config.model}`;
}

export async function getAgent(modelConfig?: ModelConfig): Promise<ReactAgent> {
  // 默认模型配置
  const defaultConfig: ModelConfig = availableModels[0];
  const config = modelConfig || defaultConfig;
  const key = getAgentKey(config);

  if (!agentInstances[key]) {
    agentInstances[key] = await initializeAgentWithModel(config);
  }

  return agentInstances[key];
}

// 为了保持向后兼容，仍然导出agent变量，但它会在首次访问时初始化
let defaultAgentPromise: Promise<any> | null = null;
export const agent: any = new Proxy({}, {
  get: async function (_, prop) {
    if (!defaultAgentPromise) {
      defaultAgentPromise = getAgent();
    }
    const actualAgent = await defaultAgentPromise;
    return actualAgent[prop];
  }
});
