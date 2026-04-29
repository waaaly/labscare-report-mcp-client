/**
 * 系统 API 工具模块
 *
 * 将 Next.js 后端 API 封装为 LangChain DynamicStructuredTool，
 * 使 Agent 能够通过对话形式调用系统功能。
 * 使用 Zod 进行参数校验，LLM 可自动推断所需参数结构。
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { logger } from "@/lib/logger";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ============================================
// Schema 定义
// ============================================

const ListLabsSchema = z.object({});

const CreateLabSchema = z.object({
  name: z.string().min(1, "实验室名称不能为空"),
  domain: z.string().optional(),
  token: z.string().optional(),
});

const LabIdSchema = z.object({
  labId: z.string().min(1, "labId不能为空"),
});

const ProjectIdSchema = z.object({
  labId: z.string().min(1, "labId不能为空"),
  projectId: z.string().min(1, "projectId不能为空"),
});

const CreateProjectSchema = z.object({
  labId: z.string().min(1, "labId不能为空"),
  name: z.string().min(1, "项目名称不能为空"),
  limsPid: z.string().min(1, "LIMS项目ID不能为空"),
});

const CreateReportSchema = z.object({
  labId: z.string().min(1, "labId不能为空"),
  name: z.string().min(1, "报告名称不能为空"),
  projectId: z.string().min(1, "projectId不能为空"),
});

const SaveScriptSchema = z.object({
  labId: z.string().min(1, "labId不能为空"),
  projectId: z.string().min(1, "projectId不能为空"),
  reportId: z.string().min(1, "reportId不能为空"),
  scriptContent: z.string().min(1, "脚本内容不能为空"),
});

const UploadDocumentSchema = z.object({
  labId: z.string().min(1, "labId不能为空"),
  projectId: z.string().min(1, "projectId不能为空"),
  reportId: z.string().optional(),
  name: z.string().min(1, "文档名称不能为空"),
  type: z.string().optional(),
  fileName: z.string().optional(),
  documentType: z.string().optional(),
});

const AssociateDocumentSchema = z.object({
  projectId: z.string().min(1, "projectId不能为空"),
  reportId: z.string().min(1, "reportId不能为空"),
  name: z.string().min(1, "文档名称不能为空"),
  url: z.string().min(1, "文档URL不能为空"),
  type: z.string().default("application/octet-stream"),
  storagePath: z.string().optional(),
  size: z.number().optional(),
  status: z.string().default("SUCCESS"),
});

const UpdateKnowledgeBaseSchema = z.object({
  labId: z.string().min(1, "labId不能为空"),
}).passthrough();

const TaskIdSchema = z.object({
  taskId: z.string().min(1, "taskId不能为空"),
});

// ============================================
// 1. 实验室管理工具
// ============================================

export const listLabsTool = new DynamicStructuredTool({
  name: "list_labs",
  description: `获取系统中所有实验室的列表。
用于查看有哪些实验室可用，返回实验室 ID、名称、域名等信息。
当你需要查看系统中有哪些实验室，或需要获取特定实验室的 ID 时使用。`,
  schema: ListLabsSchema,
  func: async () => {
    try {
      logger.info("list_labs called");
      const response = await fetch(`${baseUrl}/api/labs`);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const labs = await response.json();
      return JSON.stringify({
        success: true,
        data: labs,
      });
    } catch (error: any) {
      logger.error("list_labs error:", error);
      throw new Error(`获取实验室列表失败：${error.message || "未知错误"}`);
    }
  },
});

export const createLabTool = new DynamicStructuredTool({
  name: "create_lab",
  description: `在系统中创建一个新的实验室。
需要提供实验室名称和配置信息。

【使用场景】
- 用户说：创建实验室 / 添加实验室 / 新建实验室

【必填参数】
- name: 实验室名称
- domain: 域名（可选）
- token: LIMS API Token（可选）`,
  schema: CreateLabSchema,
  func: async (input) => {
    try {
      logger.info(`create_lab input: ${JSON.stringify(input)}`);

      const response = await fetch(`${baseUrl}/api/labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const lab = await response.json();

      if (!lab || !lab.id) {
        throw new Error("实验室创建失败：未返回有效ID");
      }

      return JSON.stringify({
        success: true,
        message: "实验室创建成功",
        data: {
          id: lab.id,
          name: lab.name,
          domain: lab.domain || "未设置",
        },
      });
    } catch (error: any) {
      logger.error("create_lab error:", error);
      throw new Error(`创建实验室失败：${error.message || "未知错误"}。\n请检查参数是否完整（name）。`);
    }
  },
});

// ============================================
// 2. 项目管理工具
// ============================================

export const listProjectsTool = new DynamicStructuredTool({
  name: "list_projects",
  description: `获取指定实验室下的所有项目列表。

【使用场景】
- 用户说：查看项目 / 列出项目 / 查看项目列表

【必填参数】
- labId: 实验室ID`,
  schema: LabIdSchema,
  func: async (input) => {
    try {
      logger.info(`list_projects input: ${JSON.stringify(input)}`);

      const response = await fetch(`${baseUrl}/api/labs/${input.labId}/projects`);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const projects = await response.json();
      return JSON.stringify({
        success: true,
        data: projects,
      });
    } catch (error: any) {
      logger.error("list_projects error:", error);
      throw new Error(`获取项目列表失败：${error.message || "未知错误"}`);
    }
  },
});

export const createProjectTool = new DynamicStructuredTool({
  name: "create_project",
  description: `在指定实验室下创建一个新的报表项目。

【使用场景】
- 用户说：创建项目 / 新建项目 / 添加项目

【必填参数】
- labId: 实验室ID
- name: 项目名称
- limsPid: LIMS系统中的项目ID

【重要规则】
- 所有字段必须提供
- 如果缺少字段，不要调用工具，应先向用户询问`,
  schema: CreateProjectSchema,
  func: async (input) => {
    try {
      logger.info(`create_project input: ${JSON.stringify(input)}`);

      const response = await fetch(
        `${baseUrl}/api/labs/${input.labId}/projects`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const project = await response.json();

      if (!project || !project.id) {
        throw new Error("项目创建失败：未返回有效ID");
      }

      return JSON.stringify({
        success: true,
        message: "项目创建成功",
        data: {
          id: project.id,
          name: project.name,
          limsPid: project.limsPid,
        },
      });
    } catch (error: any) {
      logger.error("create_project error:", error);
      throw new Error(
        `创建项目失败：${error.message || "未知错误"}。\n` +
        `请检查参数是否完整（labId, name, limsPid）。`
      );
    }
  },
});

export const getProjectTool = new DynamicStructuredTool({
  name: "get_project",
  description: `获取指定项目的详细信息，包括配置、脚本列表等。

【使用场景】
- 用户说：查看项目详情 / 获取项目信息

【必填参数】
- labId: 实验室ID
- projectId: 项目ID`,
  schema: ProjectIdSchema,
  func: async (input) => {
    try {
      logger.info(`get_project input: ${JSON.stringify(input)}`);

      const response = await fetch(`${baseUrl}/api/labs/${input.labId}/projects/${input.projectId}`);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const project = await response.json();
      return JSON.stringify({
        success: true,
        data: project,
      });
    } catch (error: any) {
      logger.error("get_project error:", error);
      throw new Error(`获取项目详情失败：${error.message || "未知错误"}`);
    }
  },
});

// ============================================
// 3. 报告模板管理工具
// ============================================

export const listReportTool = new DynamicStructuredTool({
  name: "list_report",
  description: `获取指定实验室下的报告列表。

【使用场景】
- 用户说：查看报告 / 列出报告

【必填参数】
- labId: 实验室ID`,
  schema: LabIdSchema,
  func: async (input) => {
    try {
      logger.info(`list_reports input: ${JSON.stringify(input)}`);

      const response = await fetch(`${baseUrl}/api/labs/${input.labId}/reports`);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const reports = await response.json();
      return JSON.stringify({
        success: true,
        data: reports,
      });
    } catch (error: any) {
      logger.error("list_reports error:", error);
      throw new Error(`获取报告列表失败：${error.message || "未知错误"}`);
    }
  },
});

export const createReportTool = new DynamicStructuredTool({
  name: "create_report",
  description: `在指定实验室下创建一个新的报告。

【使用场景】
- 用户说：创建报告 / 新建报告

【必填参数】
- labId: 实验室ID
- name: 报告名称
- projectId: 项目ID`,
  schema: CreateReportSchema,
  func: async (input) => {
    try {
      logger.info(`create_report input: ${JSON.stringify(input)}`);
      const response = await fetch(
        `${baseUrl}/api/labs/${input.labId}/projects/${input.projectId}/reports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const report = await response.json();

      if (!report || !report.id) {
        throw new Error("报告创建失败：未返回有效ID");
      }

      return JSON.stringify({
        success: true,
        message: "报告创建成功",
        data: {
          id: report.id,
          name: report.name,
        },
      });
    } catch (error: any) {
      logger.error("create_report error:", error);
      throw new Error(
        `创建报告失败：${error.message || "未知错误"}。\n` +
        `请检查参数是否完整（labId, name, projectId）。`
      );
    }
  },
});

// ============================================
// 4. 脚本管理工具
// ============================================

export const listScriptsTool = new DynamicStructuredTool({
  name: "list_scripts",
  description: `获取指定项目下的取数脚本列表。

【使用场景】
- 用户说：查看脚本列表 / 查看该项目有哪些脚本

【必填参数】
- labId: 实验室ID
- projectId: 项目ID`,
  schema: ProjectIdSchema,
  func: async (input) => {
    try {
      logger.info(`list_scripts input: ${JSON.stringify(input)}`);

      const response = await fetch(
        `${baseUrl}/api/labs/${input.labId}/projects/${input.projectId}/scripts`
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const scripts = await response.json();
      return JSON.stringify({
        success: true,
        data: scripts,
      });
    } catch (error: any) {
      logger.error("list_scripts error:", error);
      throw new Error(`获取脚本列表失败：${error.message || "未知错误"}`);
    }
  },
});

export const saveScriptTool = new DynamicStructuredTool({
  name: "save_script",
  description: `为指定项目创建或更新取数脚本。

【使用场景】
- 用户说：保存脚本 / 更新脚本 / 生成脚本

【必填参数】
- labId: 实验室ID
- projectId: 项目ID
- reportId: 报告ID
- scriptContent: 脚本内容`,
  schema: SaveScriptSchema,
  func: async (input) => {
    try {
      logger.info(`save_script input: labId=${input.labId}, projectId=${input.projectId}, reportId=${input.reportId}, scriptContent=${input.scriptContent.length}chars`);

      const response = await fetch(
        `${baseUrl}/api/labs/${input.labId}/projects/${input.projectId}/scripts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const result = await response.json();

      if (!result || (!result.id && !result.scriptId)) {
        throw new Error("脚本保存失败：未返回有效ID");
      }

      return JSON.stringify({
        success: true,
        message: "脚本保存成功",
        data: {
          id: result.id || result.scriptId,
          status: "已更新",
        },
      });
    } catch (error: any) {
      logger.error("save_script error:", error);
      throw new Error(
        `保存脚本失败：${error.message || "未知错误"}。\n` +
        `请检查参数是否完整（labId, projectId, reportId, scriptContent）。`
      );
    }
  },
});

// ============================================
// 5. 文档上传工具
// ============================================

export const uploadDocumentTool = new DynamicStructuredTool({
  name: "upload_document",
  description: `上传文档到指定项目或报告（通过项目级文档接口创建记录）。

【使用场景】
- 用户说：上传文档 / 上传文件 / 添加模板图片

【必填参数】
- labId: 实验室ID
- projectId: 项目ID
- name: 文档名称
- reportId: 报告ID（可选）
- type: MIME类型（可选）

【注意】
- 如果文件已经在 MinIO 中，请使用 associate_document 工具建立关联记录`,
  schema: UploadDocumentSchema,
  func: async (input) => {
    try {
      logger.info(`upload_document input: ${JSON.stringify(input)}`);

      const response = await fetch(
        `${baseUrl}/api/labs/${input.labId}/projects/${input.projectId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const result = await response.json();
      const firstResult = Array.isArray(result) ? result[0] : result;

      if (!firstResult || !firstResult.id) {
        throw new Error("文档上传失败：未返回有效ID");
      }

      return JSON.stringify({
        success: true,
        message: "文档上传记录创建成功",
        data: {
          id: firstResult.id,
          name: input.fileName || input.name,
          type: input.documentType || input.type,
        },
      });
    } catch (error: any) {
      logger.error("upload_document error:", error);
      throw new Error(`文档操作失败：${error.message || "未知错误"}`);
    }
  },
});

export const associateDocumentTool = new DynamicStructuredTool({
  name: "associate_document",
  description: `将已在 MinIO 中的文件与指定的报告建立 DB 关联记录。
调用 PUT /api/documents 接口，在数据库中创建 Document 记录。

【使用场景】
- 文件已上传到 MinIO（通过 /api/documents/upload）
- 需要将文件关联到某个报告
- 批量导入场景中建立文档关联

【必填参数】
- projectId: 项目ID
- reportId: 报告ID
- name: 文档名称
- url: MinIO 中的文件 URL（如 /documents/目录A/1715000000000-报告.pdf）
- type: MIME 类型（默认 application/octet-stream）
- storagePath: 存储路径（可选，默认同 url）
- size: 文件大小（可选）
- status: 状态（默认 SUCCESS）`,
  schema: AssociateDocumentSchema,
  func: async (input) => {
    try {
      logger.info(`associate_document input: ${JSON.stringify(input)}`);

      const payload = {
        documents: [{
          projectId: input.projectId,
          reportId: input.reportId,
          name: input.name,
          type: input.type,
          url: input.url,
          storagePath: input.storagePath || input.url,
          size: input.size,
          status: input.status,
        }],
      };

      const response = await fetch(`${baseUrl}/api/documents`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const result = await response.json();
      const doc = Array.isArray(result) ? result[0] : result;

      if (!doc || !doc.id) {
        throw new Error("文档关联失败：未返回有效ID");
      }

      return JSON.stringify({
        success: true,
        message: "文档关联成功",
        data: { id: doc.id, name: input.name },
      });
    } catch (error: any) {
      logger.error("associate_document error:", error);
      throw new Error(`文档关联失败：${error.message || "未知错误"}`);
    }
  },
});

// ============================================
// 6. 知识库管理工具
// ============================================

export const getKnowledgeBaseTool = new DynamicStructuredTool({
  name: "get_knowledge_base",
  description: `获取指定实验室的知识库配置。
包括字段映射规则、提取规则、样本过滤规则、Prompt 模板等。

【使用场景】
- 用户说：查看知识库 / 查看配置

【必填参数】
- labId: 实验室ID`,
  schema: LabIdSchema,
  func: async (input) => {
    try {
      logger.info(`get_knowledge_base input: ${JSON.stringify(input)}`);

      const response = await fetch(`${baseUrl}/api/labs/${input.labId}/knowledge`);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const knowledge = await response.json();
      return JSON.stringify({
        success: true,
        data: knowledge,
      });
    } catch (error: any) {
      logger.error("get_knowledge_base error:", error);
      throw new Error(`获取知识库失败：${error.message || "未知错误"}`);
    }
  },
});

export const updateKnowledgeBaseTool = new DynamicStructuredTool({
  name: "update_knowledge_base",
  description: `更新指定实验室的知识库配置。
可以更新字段映射、提取规则、Prompt 模板等。

【使用场景】
- 用户说：更新知识库 / 修改配置 / 调整规则

【重要规则】
- 此操作会覆盖现有配置，请谨慎使用

【必填参数】
- labId: 实验室ID
- 其他字段：fieldMappings、extractionRules 等（按需提供）`,
  schema: UpdateKnowledgeBaseSchema,
  func: async (input) => {
    try {
      const { labId, ...updates } = input;
      logger.info(`update_knowledge_base input: labId=${labId}`);

      const response = await fetch(`${baseUrl}/api/labs/${labId}/knowledge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeBase: updates }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const result = await response.json();
      return JSON.stringify({
        success: true,
        message: "知识库更新成功",
        data: result,
      });
    } catch (error: any) {
      logger.error("update_knowledge_base error:", error);
      throw new Error(`更新知识库失败：${error.message || "未知错误"}`);
    }
  },
});

// ============================================
// 7. 任务执行工具
// ============================================

export const getTaskStatusTool = new DynamicStructuredTool({
  name: "get_task_status",
  description: `获取任务的执行状态和结果。

【使用场景】
- 用户说：查看任务状态 / 查看执行结果

【必填参数】
- taskId: 任务ID`,
  schema: TaskIdSchema,
  func: async (input) => {
    try {
      logger.info(`get_task_status input: ${JSON.stringify(input)}`);

      const response = await fetch(`${baseUrl}/api/tasks/${input.taskId}`);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const task = await response.json();
      return JSON.stringify({
        success: true,
        data: task,
      });
    } catch (error: any) {
      logger.error("get_task_status error:", error);
      throw new Error(`获取任务状态失败：${error.message || "未知错误"}`);
    }
  },
});

// ============================================
// 导出所有工具
// ============================================

export const systemApiTools = [
  listLabsTool,
  createLabTool,
  listProjectsTool,
  createProjectTool,
  getProjectTool,
  listReportTool,
  createReportTool,
  listScriptsTool,
  saveScriptTool,
  uploadDocumentTool,
  associateDocumentTool,
  getKnowledgeBaseTool,
  updateKnowledgeBaseTool,
  getTaskStatusTool,
];

export const toolNameMap: Record<string, string> = {
  list_labs: "获取实验室列表",
  create_lab: "创建实验室",
  list_projects: "获取项目列表",
  create_project: "创建项目",
  get_project: "获取项目详情",
  list_report: "获取报告模板列表",
  create_report: "创建报告模板",
  list_scripts: "获取脚本列表",
  save_script: "保存脚本",
  upload_document: "上传文档",
  associate_document: "关联文档到报告",
  get_knowledge_base: "获取知识库",
  update_knowledge_base: "更新知识库",
  get_task_status: "获取任务状态",
};
