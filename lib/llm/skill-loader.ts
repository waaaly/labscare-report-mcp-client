import fs from 'fs';
import path from 'path';
import { DynamicTool } from "@langchain/core/tools";

export async function loadLocalSkill(skillPath: string) {
  const configPath = path.join(skillPath, 'SKILL.md');
  const skillContent = fs.readFileSync(configPath, 'utf-8');

  // 1. 解析 SKILL.md (这里简单演示抽取标题和描述)
  // 建议：实际开发中可以用 gray-matter 解析 Markdown 顶部的 YAML 元数据
  const name = "my_custom_skill"; // 或从 SKILL.md 提取
  const description = skillContent.substring(0, 200); // 提取前200字作为 LLM 的调用依据

  // 2. 封装为 LangChain Tool
  return new DynamicTool({
    name,
    description,
    func: async (input: string) => {
      // 这里的逻辑对应你文件夹里的 scripts 或引用的 assets
      console.log(`执行来自 ${skillPath} 的技能，输入参数: ${input}`);
      
      // 示例：如果 scripts 里有 main.py 或 node 脚本，可以用 exec 执行
      // const { stdout } = await execPromise(`node ${path.join(skillPath, 'scripts/main.js')} ${input}`);
      
      return "技能执行成功的结果";
    },
  });
}
export async function loadKnowledgeSkill(skillPath: string) {
  // 1. 读取核心说明书（你截图的内容）
  const mdPath = path.join(skillPath, 'SKILL.md');
  const skillDocs = fs.readFileSync(mdPath, 'utf-8');

  // 2. 自动读取 references 或 samplesJs 目录下的参考代码
  // 这对这类“编写脚本”的技能至关重要，因为 MD 里提到了“内置规则”
  const samplesPath = path.join(skillPath, 'references'); // 或者是你目录里的 scripts 文件夹
  let samplesJs = "";
  if (fs.existsSync(samplesPath)) {
    const files = fs.readdirSync(samplesPath);
    samplesJs = files.map(f => `文件 ${f} 内容:\n${fs.readFileSync(path.join(samplesPath, f), 'utf-8')}`).join("\n\n");
  }

  return new DynamicTool({
    name: "get_labscare_script_rules", 
    description: "当需要编写、修改或解释 Labscare LIMS 报表脚本时必用。调用此工具可获取引擎规范、占位符逻辑及参考示例。",
    func: async () => {
      // 这里的 func 不执行逻辑，而是返回“知识包”
      return `
        以下是 Labscare 报表脚本的官方执行规范和参考：
        ---
        ${skillDocs}
        ---
        参考代码片段/规范库：
        ${samplesJs}
      `;
    },
  });
}