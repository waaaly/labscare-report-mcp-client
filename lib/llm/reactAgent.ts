import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { loadKnowledgeSkill } from "./skill-loader";
import * as path from 'path';

// 1. 初始化 LLM qwen/qwen3-coder:free
// export const llm = new ChatOpenAI({ 
//   modelName: "qwen/qwen3-coder:free", // 确保模型支持 Tool Calling
//   temperature: 0 
// });

const llm = new ChatOpenAI({
  // 1. 填入 OpenRouter 的 API Key
  openAIApiKey: process.env.OPENAI_API_KEY || "", 
  // 3. 填入 OpenRouter 支持的模型 ID（例如 deepseek/deepseek-chat 或 openai/gpt-4o）
  modelName: "deepseek/deepseek-r1:free",//openrouter/free", 
  maxRetries: 3,
  timeout: 120000,
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
  messageModifier: "你是一个专业的报表开发助手。当用户涉及到 Labscare 报表脚本编写时，必须先调用 get_labscare_script_rules 工具获取规范，严禁凭空想象代码。"
});

