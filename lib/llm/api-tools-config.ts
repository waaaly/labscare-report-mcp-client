/**
 * API Tools 配置
 * 
 * 定义系统暴露的 API 工具列表，包括：
 * - 工具名称和描述
 * - 入参说明
 * - 示例 prompt
 */

export interface ApiToolConfig {
  name: string;
  nameCn: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    example?: string;
  }[];
  examplePrompt: string;
  category: 'lab' | 'project' | 'report' | 'script' | 'document' | 'knowledge' | 'task';
}

export const apiToolsConfig: ApiToolConfig[] = [
  // ============================================
  // 1. 实验室管理工具
  // ============================================
  {
    name: 'list_labs',
    nameCn: '获取实验室列表',
    description: '获取系统中所有实验室的列表，返回实验室 ID、名称、域名等信息。',
    parameters: [],
    examplePrompt: '查看一下系统中都有哪些实验室？',
    category: 'lab',
  },
  {
    name: 'create_lab',
    nameCn: '创建实验室',
    description: '在系统中创建一个新的实验室，需要提供实验室名称和配置信息。',
    parameters: [
      { name: 'name', type: 'string', required: true, description: '实验室名称' },
      { name: 'domain', type: 'string', required: false, description: '实验室域名', example: 'example.com' },
      { name: 'token', type: 'string', required: false, description: 'LIMS API Token' },
    ],
    examplePrompt: '帮我创建一个新的实验室，名称叫"测试实验室"，域名为 test.example.com',
    category: 'lab',
  },

  // ============================================
  // 2. 项目管理工具
  // ============================================
  {
    name: 'list_projects',
    nameCn: '获取项目列表',
    description: '获取指定实验室下的所有项目列表。',
    parameters: [
      { name: 'labId', type: 'string', required: true, description: '实验室 ID', example: 'lab_001' },
    ],
    examplePrompt: '查看九江农检实验室有哪些项目？',
    category: 'project',
  },
  {
    name: 'create_project',
    nameCn: '创建项目',
    description: '在指定实验室下创建一个新的报表项目。',
    parameters: [
      { name: 'labId', type: 'string', required: true, description: '实验室 ID' },
      { name: 'name', type: 'string', required: true, description: '项目名称' },
      { name: 'limsPid', type: 'string', required: true, description: 'LIMS 项目 ID' },
    ],
    examplePrompt: '在九江农检实验室下创建一个新的报表项目，项目名叫"沙门氏菌检测报告"，LIMS项目ID是 P001',
    category: 'project',
  },
  {
    name: 'get_project',
    nameCn: '获取项目详情',
    description: '获取指定项目的详细信息，包括配置、脚本列表等。',
    parameters: [
      { name: 'labId', type: 'string', required: true, description: '实验室 ID' },
      { name: 'projectId', type: 'string', required: true, description: '项目 ID' },
    ],
    examplePrompt: '查看九江农检实验室下项目 P001 的详细信息，包括有哪些脚本？',
    category: 'project',
  },

  // ============================================
  // 3. 报告模板管理工具
  // ============================================
  {
    name: 'list_report_templates',
    nameCn: '获取报告模板列表',
    description: '获取指定实验室下的报告模板列表。',
    parameters: [
      { name: 'labId', type: 'string', required: true, description: '实验室 ID' },
    ],
    examplePrompt: '查看九江农检实验室有哪些报告模板可用？',
    category: 'report',
  },
  {
    name: 'create_report_template',
    nameCn: '创建报告模板',
    description: '在指定实验室下创建一个新的报告模板。',
    parameters: [
      { name: 'labId', type: 'string', required: true, description: '实验室 ID' },
      { name: 'name', type: 'string', required: true, description: '模板名称' },
      { name: 'templateId', type: 'string', required: true, description: 'LIMS 系统模板 ID' },
    ],
    examplePrompt: '帮我在九江农检实验室创建一个新的报告模板，模板名称是"霉菌检测报告"，模板ID是 T001',
    category: 'report',
  },

  // ============================================
  // 4. 脚本管理工具
  // ============================================
  {
    name: 'list_scripts',
    nameCn: '获取脚本列表',
    description: '获取指定项目下的取数脚本列表。',
    parameters: [
      { name: 'labId', type: 'string', required: true, description: '实验室 ID' },
      { name: 'projectId', type: 'string', required: true, description: '项目 ID' },
    ],
    examplePrompt: '查看九江农检实验室沙门氏菌项目有哪些取数脚本？',
    category: 'script',
  },
  {
    name: 'save_script',
    nameCn: '保存脚本',
    description: '为指定项目创建或更新取数脚本。',
    parameters: [
      { name: 'labId', type: 'string', required: true, description: '实验室 ID' },
      { name: 'projectId', type: 'string', required: true, description: '项目 ID' },
      { name: 'templateId', type: 'string', required: true, description: '模板 ID' },
      { name: 'scriptContent', type: 'string', required: true, description: '脚本内容' },
    ],
    examplePrompt: '帮我为九江农检实验室的沙门氏菌项目创建一个新的取数脚本，用于提取样品编号和检测结果',
    category: 'script',
  },

  // ============================================
  // 5. 文档上传工具
  // ============================================
  {
    name: 'upload_document',
    nameCn: '上传文档',
    description: '上传文档（PDF、Excel、图片等）到指定项目。',
    parameters: [
      { name: 'labId', type: 'string', required: true, description: '实验室 ID' },
      { name: 'projectId', type: 'string', required: true, description: '项目 ID' },
      { name: 'documentType', type: 'string', required: true, description: '文档类型', example: 'template_image' },
      { name: 'fileName', type: 'string', required: true, description: '文件名' },
    ],
    examplePrompt: '上传一份模板图片到九江农检实验室的沙门氏菌项目，文档类型是模板图片',
    category: 'document',
  },

  // ============================================
  // 6. 知识库管理工具
  // ============================================
  {
    name: 'get_knowledge_base',
    nameCn: '获取知识库',
    description: '获取指定实验室的知识库配置，包括字段映射规则、提取规则等。',
    parameters: [
      { name: 'labId', type: 'string', required: true, description: '实验室 ID' },
    ],
    examplePrompt: '查看九江农检实验室的知识库配置，包括字段映射规则和提取规则',
    category: 'knowledge',
  },
  {
    name: 'update_knowledge_base',
    nameCn: '更新知识库',
    description: '更新指定实验室的知识库配置。',
    parameters: [
      { name: 'labId', type: 'string', required: true, description: '实验室 ID' },
      { name: 'fieldMappings', type: 'object', required: false, description: '字段映射规则' },
      { name: 'extractionRules', type: 'object', required: false, description: '提取规则' },
    ],
    examplePrompt: '帮我更新九江农检实验室的知识库配置，添加一个新的字段映射规则',
    category: 'knowledge',
  },

  // ============================================
  // 7. 任务执行工具
  // ============================================
  {
    name: 'get_task_status',
    nameCn: '获取任务状态',
    description: '获取任务的执行状态和结果。',
    parameters: [
      { name: 'taskId', type: 'string', required: true, description: '任务 ID' },
    ],
    examplePrompt: '查看任务 TASK001 的执行状态和结果',
    category: 'task',
  },
];

// 分类映射
export const categoryNames: Record<ApiToolConfig['category'], string> = {
  lab: '实验室管理',
  project: '项目管理',
  report: '报告模板',
  script: '脚本管理',
  document: '文档上传',
  knowledge: '知识库',
  task: '任务执行',
};

// 分类图标映射
export const categoryIcons: Record<ApiToolConfig['category'], string> = {
  lab: '🏢',
  project: '📁',
  report: '📄',
  script: '📝',
  document: '📎',
  knowledge: '🧠',
  task: '⚙️',
};
