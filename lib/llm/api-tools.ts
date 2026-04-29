/**
 * 系统 API 工具模块
 *
 * 将 Next.js 后端 API 封装为 LangChain Tool，
 * 使 Agent 能够通过对话形式调用系统功能
 */

import { DynamicTool } from "@langchain/core/tools";
import { logger } from "@/lib/logger";

// ============================================
// 1. 实验室管理工具
// ============================================
// 从环境变量或全局配置中获取 API 基础地址
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
/**
 * 获取实验室列表
 * 用于查看当前系统中所有实验室
 */
export const listLabsTool = new DynamicTool({
  name: "list_labs",
  description: `获取系统中所有实验室的列表。
用于查看有哪些实验室可用，返回实验室 ID、名称、域名等信息。
当你需要查看系统中有哪些实验室，或需要获取特定实验室的 ID 时使用。`,
  func: async (input: string) => {
    try {
      const response = await fetch(baseUrl + "/api/labs");
      const labs = await response.json();
      return JSON.stringify(labs, null, 2);
    } catch (error) {
      logger.error("list_labs error:");
      logger.error(error);
      return `获取实验室列表失败: ${error}`;
    }
  },
});

/**
 * 创建新实验室
 * 用于在系统中添加新的实验室
 */
export const createLabTool = new DynamicTool({
  name: "create_lab",
  description: `在系统中创建一个新的实验室。
需要提供实验室名称和配置信息。
当用户要求"创建实验室"、"添加实验室"、"新建实验室"时使用。
参数格式：JSON字符串，包含 name（实验室名称）、domain（可选，域名）、token（可选，LIMS API Token）等字段。`,
  func: async (input: string) => {
    try {
      const params = JSON.parse(input);
      const response = await fetch(baseUrl + "/api/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const lab = await response.json();
      return `实验室创建成功！\nID: ${lab.id}\n名称: ${lab.name}\n域名: ${lab.domain || '未设置'}`;
    } catch (error) {
      logger.error("create_lab error:");
      logger.error(error);
      return `创建实验室失败: ${error}`;
    }
  },
});

// ============================================
// 2. 项目管理工具
// ============================================

/**
 * 获取实验室下的项目列表
 */
export const listProjectsTool = new DynamicTool({
  name: "list_projects",
  description: `获取指定实验室下的所有项目列表。
需要提供 labId 参数。
当用户要求"查看项目"、"列出项目"、"查看项目列表"时使用。
参数格式：JSON字符串，包含 labId 字段。`,
  func: async (input: string) => {
    try {
      const { labId } = JSON.parse(input);
      const response = await fetch(baseUrl + `/api/labs/${labId}/projects`);
      const projects = await response.json();
      return JSON.stringify(projects, null, 2);
    } catch (error) {
      logger.error("list_projects error:");
      logger.error(error);
      return `获取项目列表失败: ${error}`;
    }
  },
});

/**
 * 创建新项目
 */
export const createProjectTool = new DynamicTool({
  name: "create_project",
  description: `在指定实验室下创建一个新的报表项目。
需要提供实验室 ID、项目名称、LIMS 项目 ID 等信息。
当用户要求"创建项目"、"新建项目"、"添加项目"时使用。
参数格式：JSON字符串，包含 labId、name、limsPid 等字段。`,
  func: async (input: string) => {
    try {
      const params = JSON.parse(input);
      const response = await fetch(baseUrl + `/api/labs/${params.labId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const project = await response.json();
      return `项目创建成功！\nID: ${project.id}\n名称: ${project.name}\nLIMS PID: ${project.limsPid}`;
    } catch (error) {
      logger.error("create_project error:");
      logger.error(error);
      return `创建项目失败: ${error}`;
    }
  },
});

/**
 * 获取项目详情
 */
export const getProjectTool = new DynamicTool({
  name: "get_project",
  description: `获取指定项目的详细信息，包括配置、脚本列表等。
需要提供 labId 和 projectId。
当用户要求"查看项目详情"、"获取项目信息"时使用。
参数格式：JSON字符串，包含 labId 和 projectId 字段。`,
  func: async (input: string) => {
    try {
      const { labId, projectId } = JSON.parse(input);
      const response = await fetch(baseUrl + `/api/labs/${labId}/projects/${projectId}`);
      const project = await response.json();
      return JSON.stringify(project, null, 2);
    } catch (error) {
      logger.error("get_project error:");
      logger.error(error);
      return `获取项目详情失败: ${error}`;
    }
  },
});

// ============================================
// 3. 报告模板管理工具
// ============================================

/**
 * 获取报告模板列表
 */
export const listReportTemplatesTool = new DynamicTool({
  name: "list_report_templates",
  description: `获取指定实验室下的报告模板列表。
需要提供 labId 参数。
当用户要求"查看报告模板"、"列出模板"时使用。
参数格式：JSON字符串，包含 labId 字段。`,
  func: async (input: string) => {
    try {
      const { labId } = JSON.parse(input);
      const response = await fetch(baseUrl + `/api/labs/${labId}/reports`);
      const templates = await response.json();
      return JSON.stringify(templates, null, 2);
    } catch (error) {
      logger.error("list_report_templates error:");
      logger.error(error);
      return `获取报告模板列表失败: ${error}`;
    }
  },
});

/**
 * 创建报告模板
 */
export const createReportTemplateTool = new DynamicTool({
  name: "create_report_template",
  description: `在指定实验室下创建一个新的报告模板。
需要提供模板名称、模板 ID（来自 LIMS 系统）等信息。
当用户要求"创建报告模板"、"新建模板"时使用。
参数格式：JSON字符串，包含 labId、name、templateId 等字段。`,
  func: async (input: string) => {
    try {
      const params = JSON.parse(input);
      const response = await fetch(baseUrl + `/api/labs/${params.labId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const template = await response.json();
      return `报告模板创建成功！\nID: ${template.id}\n名称: ${template.name}`;
    } catch (error) {
      logger.error("create_report_template error:");
      logger.error(error);
      return `创建报告模板失败: ${error}`;
    }
  },
});

// ============================================
// 4. 脚本管理工具
// ============================================

/**
 * 获取脚本列表
 */
export const listScriptsTool = new DynamicTool({
  name: "list_scripts",
  description: `获取指定项目下的取数脚本列表。
需要提供 labId 和 projectId。
当用户要求"查看脚本列表"、"查看该项目有哪些脚本"时使用。
参数格式：JSON字符串，包含 labId 和 projectId 字段。`,
  func: async (input: string) => {
    try {
      const { labId, projectId } = JSON.parse(input);
      const response = await fetch(baseUrl + `/api/labs/${labId}/projects/${projectId}/scripts`);
      const scripts = await response.json();
      return JSON.stringify(scripts, null, 2);
    } catch (error) {
      logger.error("list_scripts error:");
      logger.error(error);
      return `获取脚本列表失败: ${error}`;
    }
  },
});

/**
 * 创建/更新取数脚本
 */
export const saveScriptTool = new DynamicTool({
  name: "save_script",
  description: `为指定项目创建或更新取数脚本。
需要提供脚本内容和相关配置。
当用户要求"保存脚本"、"更新脚本"、"生成脚本"时使用。
参数格式：JSON字符串，包含 labId、projectId、templateId、scriptContent 等字段。`,
  func: async (input: string) => {
    try {
      const params = JSON.parse(input);
      const response = await fetch(baseUrl + `/api/labs/${params.labId}/projects/${params.projectId}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const result = await response.json();
      return `脚本保存成功！\nID: ${result.id || result.scriptId}\n状态: 已更新`;
    } catch (error) {
      logger.error("save_script error:");
      logger.error(error);
      return `保存脚本失败: ${error}`;
    }
  },
});

// ============================================
// 5. 文档上传工具
// ============================================

/**
 * 上传文档到项目
 */
export const uploadDocumentTool = new DynamicTool({
  name: "upload_document",
  description: `关联文档到指定项目或报告。
如果文件已通过 /api/documents/upload 上传，使用此工具建立 DB 关联记录。
当用户要求"上传文档"、"上传文件"、"添加模板图片"时使用。
参数格式：JSON字符串，包含 labId、projectId、reportId、name、type、url、storagePath、size 等字段。`,
  func: async (input: string) => {
    try {
      const params = JSON.parse(input);
      if (params.url) {
        const response = await fetch(baseUrl + "/api/documents", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documents: [{
              projectId: params.projectId,
              reportId: params.reportId,
              name: params.name,
              type: params.type || "application/octet-stream",
              url: params.url,
              storagePath: params.storagePath || params.url,
              size: params.size,
              status: params.status || "SUCCESS",
            }]
          }),
        });
        const result = await response.json();
        const doc = Array.isArray(result) ? result[0] : result;
        return `文档关联成功！\nID: ${doc?.id}\n文件名: ${params.name}`;
      }
      const response = await fetch(baseUrl + `/api/labs/${params.labId}/projects/${params.projectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const result = await response.json();
      const firstResult = Array.isArray(result) ? result[0] : result;
      return `文档上传记录创建成功！\n文档ID: ${firstResult?.id}\n文件名: ${params.fileName || params.name}\n类型: ${params.documentType || params.type}`;
    } catch (error) {
      logger.error("upload_document error:");
      logger.error(error);
      return `文档操作失败: ${error}`;
    }
  },
});

// ============================================
// 6. 知识库管理工具
// ============================================

/**
 * 获取实验室知识库
 */
export const getKnowledgeBaseTool = new DynamicTool({
  name: "get_knowledge_base",
  description: `获取指定实验室的知识库配置。
包括字段映射规则、提取规则、样本过滤规则、Prompt 模板等。
当用户要求"查看知识库"、"查看配置"时使用。
参数格式：JSON字符串，包含 labId 字段。`,
  func: async (input: string) => {
    try {
      const { labId } = JSON.parse(input);
      const response = await fetch(baseUrl + `/api/labs/${labId}/knowledge`);
      const knowledge = await response.json();
      return JSON.stringify(knowledge, null, 2);
    } catch (error) {
      logger.error("get_knowledge_base error:");
      logger.error(error);
      return `获取知识库失败: ${error}`;
    }
  },
});

/**
 * 更新实验室知识库
 */
export const updateKnowledgeBaseTool = new DynamicTool({
  name: "update_knowledge_base",
  description: `更新指定实验室的知识库配置。
可以更新字段映射、提取规则、Prompt 模板等。
当用户要求"更新知识库"、"修改配置"、"调整规则"时使用。
注意：此操作会覆盖现有配置，请谨慎使用。
参数格式：JSON字符串，包含 labId、fieldMappings、extractionRules 等字段。`,
  func: async (input: string) => {
    try {
      const params = JSON.parse(input);
      const { labId, ...updates } = params;
      const response = await fetch(baseUrl + `/api/labs/${labId}/knowledge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeBase: updates }),
      });
      const result = await response.json();
      return `知识库更新成功！\n${JSON.stringify(result, null, 2)}`;
    } catch (error) {
      logger.error("update_knowledge_base error:");
      logger.error(error);
      return `更新知识库失败: ${error}`;
    }
  },
});

// ============================================
// 7. 任务执行工具
// ============================================

/**
 * 获取任务状态
 */
export const getTaskStatusTool = new DynamicTool({
  name: "get_task_status",
  description: `获取任务的执行状态和结果。
需要提供 taskId 参数。
当用户要求"查看任务状态"、"查看执行结果"时使用。
参数格式：JSON字符串，包含 taskId 字段。`,
  func: async (input: string) => {
    try {
      const { taskId } = JSON.parse(input);
      const response = await fetch(baseUrl + `/api/tasks/${taskId}`);
      const task = await response.json();
      return JSON.stringify(task, null, 2);
    } catch (error) {
      logger.error("get_task_status error:");
      logger.error(error);
      return `获取任务状态失败: ${error}`;
    }
  },
});

// ============================================
// 导出所有工具
// ============================================

export const systemApiTools = [
  // 实验室管理
  listLabsTool,
  createLabTool,
  // 项目管理
  listProjectsTool,
  createProjectTool,
  getProjectTool,
  // 报告模板
  listReportTemplatesTool,
  createReportTemplateTool,
  // 脚本管理
  listScriptsTool,
  saveScriptTool,
  // 文档上传
  uploadDocumentTool,
  // 知识库
  getKnowledgeBaseTool,
  updateKnowledgeBaseTool,
  // 任务
  getTaskStatusTool,
];

// 工具名称映射（用于日志和调试）
export const toolNameMap: Record<string, string> = {
  list_labs: "获取实验室列表",
  create_lab: "创建实验室",
  list_projects: "获取项目列表",
  create_project: "创建项目",
  get_project: "获取项目详情",
  list_report_templates: "获取报告模板列表",
  create_report_template: "创建报告模板",
  list_scripts: "获取脚本列表",
  save_script: "保存脚本",
  upload_document: "上传文档",
  get_knowledge_base: "获取知识库",
  update_knowledge_base: "更新知识库",
  get_task_status: "获取任务状态",
};
