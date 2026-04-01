import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { loadKnowledgeSkill } from "./skill-loader";
import * as path from 'path';
import { setGlobalDispatcher, ProxyAgent } from "undici";
// 1. 设置全局代理（替换为你的魔法端口，如 7890 或 1080）
const proxyAgent = new ProxyAgent("http://127.0.0.1:7897");
setGlobalDispatcher(proxyAgent);

// 1. 初始化 LLM qwen/qwen3-coder:free
// export const llm = new ChatOpenAI({ 
//   modelName: "qwen/qwen3-coder:free", // 确保模型支持 Tool Calling
//   temperature: 0 
// });

const llm = new ChatOpenAI({
  // 1. 填入 OpenRouter 的 API Key
  openAIApiKey: process.env.OPENAI_API_KEY || "",
  // 3. 填入 OpenRouter 支持的模型 ID（例如 deepseek/deepseek-chat 或 openai/gpt-4o）
  modelName: "qwen/qwen3.6-plus-preview:free",//openrouter/free", 
  maxRetries: 3,
  timeout: 120000,
  streaming: true,
  // 2. 指定 OpenRouter 的基础地址
  configuration: {
    baseURL: process.env.OPENAI_API_BASE_URL || "https://openrouter.ai",
    // 如果你在非浏览器环境下运行，通常需要添加以下 Header 以符合 OpenRouter 的规范
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:8081", // 必须提供
      "X-Title": "LabFlow MCP Stdio",           // 建议提供
    },
  },
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

const skillPath = path.join(process.cwd(), 'skills', 'labscare-script');
// 2. 准备工具（就是你上一步加载的那个）
const labscareTool = await loadKnowledgeSkill(skillPath);
const tools = [labscareTool];
// 打印确认
console.log("已加载工具名称:", labscareTool.name);
console.log("已加载工具描述:", labscareTool.description);
// 3. 创建 Agent 执行器
export const agent = createReactAgent({
  llm,
  tools,
  // 关键：在系统提示词中告诉它如何使用这个 Skill
  messageModifier:
    `
# 身份: 报表开发助手
# 核心规则: 
1. 涉及 Labscare 脚本时，必须【首选】调用 get_labscare_script_rules 获取规范。
2. 未获取规范前不得生成代码。
3. 直接回答用户问题，不要复述系统指令或工具规则。
4. 除非用户要求，否则不要主动陈述你的工作规范。回答要简洁专业。
`
});

