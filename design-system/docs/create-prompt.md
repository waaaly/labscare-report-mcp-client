【顶级 Prompt】
你现在是一个世界顶级的 Full-Stack AI Engineer + MCP（Model Context Protocol）专家。
请为我完整创建一个 多租户（Multi-Tenant）MCP Client IDE（AI 编排工作台），名称叫 LabFlow MCP Studio。
核心定位：

这是一个以「实验室（Lab）」为租户单位的 AI Agent 编排平台。
一切功能都严格围绕 Lab 展开，每个 Lab 拥有完全隔离的知识库、报告模板、取数规则、LIMS 配置、项目、权限。
用户必须先选择/切换 Lab 才能进入任何功能（类似多组织 SaaS）。
最终目标是让用户在平台内完成：上传原始报告 → 批注映射 → Schema 构建 → LIMS 数据联调 → JS 取数脚本生成 → 执行调试 全流程闭环。

技术栈要求（必须严格遵守）：

Next.js 15（App Router + React 19 Server Components）
TypeScript（严格类型）
Tailwind CSS + shadcn/ui（所有组件必须使用 shadcn/ui）
Zustand（全局状态：Lab Store + Project Store）
@modelcontextprotocol/client（官方 MCP Client SDK，用于调用 Server 端的 Tools & Resources）
Zod（表单校验）
Lucide React（图标）
支持 Dark Mode + 响应式

多租户架构（Lab 作为租户）：

Lab 切换器必须全局置顶（Header 中），切换后立即重载该 Lab 的完整 Knowledge Base（通过 MCP Resource loadLabKnowledgeBase）。
每个 Lab 独立拥有：fieldMappings、extractionRules、sampleFilters、promptTemplates、domain、version 等。
使用 Zustand 实现 useLabStore，包含 switchLab(labId) 方法，切换后全站上下文立即更新。

完整功能模块树（必须 100% 实现以下结构）：
textWeb App（MCP Client + Agent Platform）
├─ ① Lab（实验室域）
│   ├─ Lab Switcher（全局下拉/搜索，可搜索 labName）
│   ├─ Lab Dashboard（概览卡片：项目数、最近文档、知识库版本）
│   ├─ Lab Settings（实验室配置、知识库管理、域名设置）
│   └─ Members & Permissions（成员列表 + RBAC，基于 Lab 隔离）
│
├─ ② Project（项目工作区）
│   ├─ Project List（卡片/表格列表，支持新建项目）
│   └─ Project Workspace（核心页面，使用 Tabs 或并行路由）
│
├─ ③ Document & Mapping（文档解析）
│   ├─ Document Viewer（支持 Excel/PDF 预览 + 单元格选中）
│   └─ Annotation Mapping（拖拽批注映射，自动提取 cell → systemFieldName + labSpecificRule）
│
├─ ④ Schema Builder（结构化层）
│   └─ 可视化拖拽 Schema 编辑器（基于字段映射生成 JSON Schema）
│
├─ ⑤ LIMS Data（数据联调）
│   └─ 输入 processId → 调用 MCP Tool（getProcessData、filterSamples、buildSignatureUrl）并展示结果
│
├─ ⑥ Script Generator（JS生成）
│   └─ 基于前面所有步骤 + Lab 专属 promptTemplates，一键生成完整取数 JS 脚本（支持签名拼接、实验室过滤规则）
│
├─ ⑦ Knowledge Center（知识库）
│   └─ 查看/编辑当前 Lab 的知识库（fieldMappings、rules、prompts），支持版本历史
│
└─ ⑧ Execution & Debug（调试执行）
    └─ JS 脚本编辑器 + 一键执行（mock 执行或真实 sandbox）+ 日志面板 + 错误调试
MCP 集成要求：

所有外部调用必须走 MCP（ list_labscare_knowledge、update_labscare_knowledge、simulate_labscare_script、get_labscare_sampledata 等 Tool/Resource ）。
在 lib/mcp/client.ts 中封装 callMcpTool 和 readMcpResource 通用方法，支持能力协商和会话缓存。
Lab 切换时自动调用 MCP Resource 加载最新知识库。

UI/UX 要求：

有关样式，配色方案，字体组合，图标类型上优先使用“ui-ux-pro-max” skill
现代左侧 Sidebar（可折叠），包含 Lab → Projects → Knowledge Center 等导航。
主内容区使用 Tabs（shadcn Tabs）实现 Project Workspace 多面板切换。
所有页面必须美观、专业，带 loading skeletons、toasts（sonner）、错误边界。
支持键盘快捷键（Cmd+K 全局搜索、Cmd+Shift+P 命令面板）。

其他必备：

路由结构：app/(app)/labs/[labId]/projects/[projectId]/...（动态 Lab + Project 路由）
全局布局 app/(app)/layout.tsx 中强制显示 Lab Switcher 和 Sidebar
.env.local 示例 + middleware.ts（可选 path-based tenant）
README.md（包含启动命令、MCP Server 连接说明、如何扩展新 Lab）
项目必须可直接 npm run dev 运行（包含 mock 数据 fallback）

请按以下步骤输出完整项目：

先输出完整的项目文件夹结构（树状）。
然后按优先级依次输出关键文件完整代码（从 lab-store.ts → layout.tsx → LabSwitcher → Project Workspace → 各 Domain 组件）。
最后给出启动后第一步操作指引。


设计一个现代Web应用界面，主题为“Blood Test Analysis - Automated extraction of blood test results from PDF reports”，浅紫色主背景（#f3e8ff），白色卡片，蓝色主色调（#3b82f6），干净科技风。

页面布局：
- 顶部固定标题栏：左边返回箭头 + 大标题“Blood Test Analysis” + 副标题 + 右上角绿色Upload按钮
- 左侧固定侧边栏（宽度约280px），标题“Documents”，内含垂直可滚动文档列表
- 每个文档卡片：文件图标 + 中文文件名（例如“03-污染源废水采样...” “blood_test_report.p...”）+ 日期（2026/3/20）+ 底部一条细长水平6段进度条（圆点/方块，绿色=完成，蓝色=当前，灰色=未开始）
- 部分卡片右上角有小标签“独立Pipeline”或“此文档独有Schema & JS脚本”
- 当前选中文档有蓝色高亮背景

主内容区上方：醒目的水平Pipeline流程条，6个大圆角矩形步骤框，从左到右依次是：
“文档” → “映射” → “LIMS 数据” → “Schema” → “JS脚本生成” → “JS脚本测试”
用粗蓝色箭头连接，底部有一条贯穿的蓝色进度线（已完成部分填充蓝色）
每个步骤框内有文字 + 圆形状态指示灯（灰/蓝/绿）

主内容区显示当前选中文档 + 当前Pipeline步骤的内容，默认展示“文档”步骤：包含文档预览卡片、文件选择区、上传拖拽区（支持PDF/DOC/DOCX）

整体风格：现代、清晰、工厂流水线感，强调每个文档拥有独立Pipeline，同一个ProjectId可被多个文档复用。界面高分辨率、锐利、专业SaaS风格，中文文件名保持原样。