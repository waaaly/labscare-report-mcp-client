import { createAgent,  } from "langchain";
import { ChatOpenRouter } from "@langchain/openrouter";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { loadKnowledgeSkill } from "./skill-loader";
import { systemApiTools, toolNameMap } from "./api-tools";
import * as path from "path";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import {RequestInspector} from '@/lib/logger'
// 1. 设置全局代理（替换为你的魔法端口，如 7890 或 1080）
const proxyAgent = new ProxyAgent("http://127.0.0.1:7897");
setGlobalDispatcher(proxyAgent);

// 1. 初始化 LLM qwen/qwen3-coder:free
// export const llm = new ChatOpenAI({
//   modelName: "qwen/qwen3-coder:free", // 确保模型支持 Tool Calling
//   temperature: 0
// });

// const llm = new ChatOpenRouter({
//   apiKey: process.env.OPENROUTER_API_KEY || "",
//   model: "nvidia/nemotron-nano-12b-v2-vl:free", //"qwen/qwen3.6-plus-preview:free"//"nvidia/nemotron-nano-12b-v2-vl:free", //openrouter/free",
// });

const llm = new ChatOpenAI({
  // 1. 填入 OpenRouter 的 API Key
  apiKey: process.env.FLOW_API_KEY || "",
  // 3. 填入 OpenRouter 支持的模型 ID（例如 deepseek/deepseek-chat 或 openai/gpt-4o）
  // google/gemma-3-4b-it:free qwen/qwen3.6-plus-preview:free z-ai/glm-4.5-air:free
  // modelName: "deepseek-chat",//openrouter/free", DeepSeek-OCR
  modelName: "Pro/moonshotai/Kimi-K2.5",//"deepseek-ai/deepseek-vl2",
  // model: "deepseek-vl2",
  maxRetries: 3,
  timeout: 120000,
  streaming: true,
  // 2. 指定 OpenRouter 的基础地址
  configuration: {
    baseURL: process.env.FLOW_API_BASE_URL || "https://openrouter.ai/api/v1",
    // 如果你在非浏览器环境下运行，通常需要添加以下 Header 以符合 OpenRouter 的规范
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:8081", // 必须提供
      "X-Title": "LabFlow MCP Stdio",           // 建议提供
    },
  },
  callbacks: [
   new RequestInspector(),
  ],
});


// const llm = new ChatGoogleGenerativeAI({
//   apiKey: process.env.GOOGLE_API_KEY,        // 你的 Google AI Studio API Key
//   model: "gemini-2.5-flash-lite",                 // ← 关键：改成 model（不是 modelName）
//   temperature: 0.1,                          // 报表脚本建议低温度，提高确定性
//   maxOutputTokens: 8192,                     // 根据需要调整
//   // 可选推荐参数
//   maxRetries: 5,
//   streaming: true,

// });


async function initializeAgent() {
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

  // 4. 创建 agent
  const agent = createAgent({
    model: llm, // 你的 ChatOpenRouter
    tools, // ← 必须明确传入
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

// export const agent = createReactAgent({
//   llm,
//   tools,
//   // 关键：在系统提示词中告诉它如何使用这个 Skill
//   messageModifier:
//     `
// # 身份: 报表开发助手
// # 核心规则:
// 1. 涉及 Labscare 脚本时，必须【首选】调用 get_labscare_script_rules 获取规范。
// 2. 未获取规范前不得生成代码。
// 3. 直接回答用户问题，不要复述系统指令或工具规则。
// 4. 除非用户要求，否则不要主动陈述你的工作规范。回答要简洁专业。
// `
// });
// ===== 确认工具是否加载 =====
let agentInstance: any = null;

export async function getAgent(): Promise<any> {
  if (!agentInstance) {
    agentInstance = await initializeAgent();
  }
  return agentInstance;
}

// 为了保持向后兼容，仍然导出agent变量，但它会在首次访问时初始化
let agentPromise: Promise<any> | null = null;
export const agent: any = new Proxy({}, {
  get: async function(_, prop) {
    if (!agentPromise) {
      agentPromise = getAgent();
    }
    const actualAgent = await agentPromise;
    return actualAgent[prop];
  }
});
