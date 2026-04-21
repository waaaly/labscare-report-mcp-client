# 完整设计报告

## 1. 系统概述

LabFlow MCP Studio 是一个以「实验室（Lab）」为租户单位的 AI Agent 编排平台，旨在实现从上传原始报告到生成执行脚本的全流程闭环。系统核心功能包括文档解析、字段映射、Schema 构建、LIMS 数据联调、JS 取数脚本生成和执行调试。

### 1.1 核心定位
- 多租户架构：以 Lab 为租户单位，每个 Lab 拥有完全隔离的知识库、报告模板、取数规则、LIMS 配置、项目和权限
- 全流程闭环：上传原始报告 → 批注映射 → Schema 构建 → LIMS 数据联调 → JS 取数脚本生成 → 执行调试
- AI 驱动：利用 LLM 能力实现智能文档解析和脚本生成

### 1.2 技术栈
- Next.js 15（App Router + React 19 Server Components）
- TypeScript（严格类型）
- Tailwind CSS + shadcn/ui
- Zustand（全局状态管理）
- @modelcontextprotocol/client（MCP Client SDK）
- Zod（表单校验）
- Lucide React（图标）

## 2. 技术架构

### 2.1 整体架构

系统采用分层架构设计，包括前端层、API 层、队列层、Worker 层和外部服务层。

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │
│  │  对话界面        │  │  批量任务界面    │  │  任务管理界面        │   │
│  │  (单任务)       │  │  (批量提交)     │  │  (状态监控)          │   │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘   │
│           │                    │                       │             │
│           └────────────────────┼───────────────────────┘             │
│                                │                                      │
└────────────────────────────────┼──────────────────────────────────────┘
                                 │ SSE / WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Next.js API Layer                              │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │  POST /api/llm       │  │  POST /api/llm/batch │                 │
│  │  (兼容现有接口)      │  │  (批量任务提交)     │                 │
│  └──────────┬───────────┘  └──────────┬───────────┘                 │
│             │                         │                              │
│  ┌──────────▼───────────┐  ┌──────────▼───────────┐                 │
│  │  GET /api/stream     │  │  GET /api/batch/status│                │
│  │  (SSE 订阅流)        │  │  (批量任务状态)     │                 │
│  └──────────┬───────────┘  └──────────┬───────────┘                 │
│             │                         │                              │
└─────────────┼─────────────────────────┼──────────────────────────────┘
              │                         │
              │                         │
┌─────────────┼─────────────────────────┼──────────────────────────────┐
│             │        Queue Layer       │                              │
│  ┌──────────▼─────────────────────────▼───────────┐                  │
│  │            Redis + BullMQ                      │                  │
│  │  ┌─────────────┐  ┌──────────────┐            │                  │
│  │  │ Job Queue   │  │ Job State    │            │                  │
│  │  │ (report)    │  │ (RedisHash)  │            │                  │
│  │  └─────────────┘  └──────────────┘            │                  │
│  │  ┌──────────────────────────────────────┐     │                  │
│  │  │ Redis Pub/Sub / Redis Stream         │     │                  │
│  │  │ (用于实时推送 streaming 数据)           │     │                  │
│  │  └──────────────────────────────────────┘     │                  │
│  └────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
              │                         │
              │                         │
┌─────────────┼─────────────────────────┼──────────────────────────────┐
│             │       Worker Layer       │                              │
│  ┌──────────▼─────────────────────────▼───────────┐                  │
│  │            Worker Process (PM2)                 │                  │
│  │  ┌──────────────┐  ┌──────────────┐           │                  │
│  │  │ Worker 1     │  │ Worker 2     │   ...     │                  │
│  │  │ concurrency  │  │ concurrency  │           │                  │
│  │  │ = LLM并发数  │  │ = LLM并发数  │           │                  │
│  │  └──────┬───────┘  └──────┬───────┘           │                  │
│  │         │                  │                   │                  │
│  │         └────────┬─────────┘                   │                  │
│  │                  │                             │                  │
│  │  ┌───────────────▼───────────────────┐       │                  │
│  │  │  Shared LLM Instance (连接池)     │       │                  │
│  │  │  - maxConcurrent: 10              │       │                  │
│  │  │  - 复用 HTTP 连接                 │       │                  │
│  │  └───────────────────────────────────┘       │                  │
│  │  ┌───────────────┐  ┌───────────────┐       │                  │
│  │  │ Skill Loader  │  │ Tool Executor │       │                  │
│  │  │ (单例)        │  │              │       │                  │
│  │  └───────────────┘  └───────────────┘       │                  │
│  └────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       External Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐           │
│  │ LLM Provider │  │  Redis       │  │  Monitoring      │           │
│  │ (OpenRouter) │  │  (已部署)    │  │  (Prometheus)    │           │
│  └──────────────┘  └──────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心改造点

#### 2.2.1 Agent 架构升级
- 从「全局单例」升级为「任务级实例」
- 实现 LLM 实例共享（连接池）
- 支持并发任务处理

#### 2.2.2 Streaming 机制优化
- 从「直接返回流」升级为「发布到 Redis Stream」
- 支持消息持久化和断线重连
- 实现批量任务的流式处理

#### 2.2.3 并发控制设计
- Worker 并发控制：控制同时处理的任务数
- LLM 实例并发控制：限制 LLM 最大并发调用数
- BullMQ 队列限流：防止队列积压过大

## 3. 核心功能模块

### 3.1 功能模块树

```
Web App（MCP Client + Agent Platform）
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
```

### 3.2 对话界面

对话界面是用户与 LLM 交互的核心界面，支持以下功能：
- 消息发送和接收
- 流式响应展示
- 文件上传（支持图片、JSON、Markdown）
- 工具调用可视化
- 消息编辑和重新生成
- 对话导出和搜索

### 3.3 批量任务处理

批量任务处理功能允许用户一次提交多个任务，系统会并行处理这些任务并返回结果。
- 批量任务提交接口
- 任务状态监控
- 批量任务流式响应
- 任务错误处理和重试

## 4. 设计规范

### 4.1 色彩方案

#### LabFlow MCP Studio
- 主色：`#0891B2`（平静青色）
- 辅助色：`#22D3EE`
- CTA/强调色：`#059669`（健康绿色）
- 背景色：`#ECFEFF`
- 文本色：`#164E63`

#### LabScare Tasks
- 主色：`#7C3AED`（兴奋紫色）
- 辅助色：`#A78BFA`
- CTA/强调色：`#F97316`（行动橙色）
- 背景色：`#FAF5FF`
- 文本色：`#4C1D95`

### 4.2 排版规范

#### LabFlow MCP Studio
- 标题字体：Figtree
- 正文字体：Noto Sans
- 风格：医疗、干净、可访问、专业、医疗保健、值得信赖

#### LabScare Tasks
- 标题字体：Fira Code
- 正文字体：Fira Sans
- 风格：仪表盘、数据、分析、代码、技术、精确

### 4.3 组件规范

- 按钮：圆角 8px，有悬停效果
- 卡片：圆角 12px，有阴影和悬停效果
- 输入框：圆角 8px，有焦点状态
- 模态框：圆角 16px，有背景模糊效果

### 4.4 TypeScript 规范

- 严格类型检查：所有代码必须通过 `npm run typecheck`
- 无 any 类型：避免使用 `any`，使用具体类型或 `unknown`
- 类型推断：优先使用 TypeScript 的类型推断
- 接口优先：使用 `interface` 定义对象形状，`type` 定义联合类型
- 组件规范：明确 Props 类型，使用 React 事件类型
- Hooks 规范：明确 useState 类型，指定 useEffect 依赖数组
- API 路由规范：明确请求体类型，完善错误处理
- 状态管理规范：明确 Zustand Store 状态类型
- 工具函数规范：明确参数类型，使用泛型函数

## 5. 优化方案

### 5.1 对话体验优化

#### 5.1.1 缓冲区 + 批量更新
- 不要每个 chunk 都 setState
- 使用 requestAnimationFrame 批量更新
- 减少渲染次数，提高性能

#### 5.1.2 Markdown 渲染优化
- Streaming 阶段使用 plain text
- 完成后再渲染 Markdown
- 避免流式渲染时的性能问题

#### 5.1.3 滚动控制优化
- 流式传输时使用 auto 滚动
- 完成时使用 smooth 滚动
- 避免滚动抖动

#### 5.1.4 Pretext 思想的进阶实现
- 将 message 拆成「结构化 token」
- 流式传输时逐步构建 tokens
- 提高渲染效率和用户体验

### 5.2 LLM Pipeline 优化

#### 5.2.1 并发能力提升
- 支持批量并发任务（目标：50+）
- 提高任务吞吐量（目标：50+/min）
- 可配置 LLM 并发限制

#### 5.2.2 可靠性增强
- 任务持久化：重启不丢失任务
- 错误处理与重试：指数退避策略
- 死信队列：处理重试失败的任务

#### 5.2.3 可观测性提升
- 指标收集：任务数、执行时间、成功率
- 日志标准化：结构化日志输出
- 监控集成：Prometheus + OpenTelemetry

## 6. 实施建议

### 6.1 项目结构

```
app/
├── conversation/
│   ├── page.tsx
│   └── tools/
│       ├── index.ts
│       ├── tool-definitions.ts
│       └── tool-registry.ts
├── batch/
│   └── page.tsx
├── api/
│   ├── llm/
│   │   └── route.ts
│   ├── llm/batch/
│   │   └── route.ts
│   ├── stream/
│   │   └── route.ts
│   └── tools/
│       └── route.ts
├── (app)/
│   ├── layout.tsx
│   ├── labs/[labId]/
│   └── projects/[projectId]/
├── lib/
│   ├── mcp/
│   │   └── client.ts
│   ├── llm/
│   │   ├── agent-factory.ts
│   │   ├── skill-loader.ts
│   │   └── reactAgent.ts
│   ├── queue/
│   │   └── stream-publisher.ts
│   ├── monitoring/
│   │   ├── metrics.ts
│   │   └── logger.ts
│   └── store/
│       ├── lab-store.ts
│       └── project-store.ts
├── workers/
│   └── batch-worker.ts
└── skills/
    └── labscare-script/
```

### 6.2 分阶段实施

#### 第一阶段：核心功能实现
1. 完成 Lab 切换和项目管理功能
2. 实现文档上传和解析
3. 开发字段映射和 Schema 构建
4. 集成 LIMS 数据联调

#### 第二阶段：AI 能力集成
1. 实现 LLM 对话界面
2. 开发脚本生成功能
3. 集成 Execution & Debug 面板
4. 实现知识库管理

#### 第三阶段：性能优化
1. 升级 LLM Pipeline 架构
2. 实现批量任务处理
3. 增强可观测性
4. 优化前端性能

### 6.3 技术建议

1. **MCP 集成**：所有外部调用必须走 MCP，封装通用方法支持能力协商和会话缓存
2. **状态管理**：使用 Zustand 实现 Lab Store 和 Project Store，确保状态一致性
3. **类型安全**：严格遵循 TypeScript 规范，避免使用 any 类型
4. **错误处理**：完善的错误处理和日志记录，提高系统可靠性
5. **性能优化**：实现流式响应、批量更新、缓存策略等性能优化措施
6. **安全性**：实现基于 Lab 的权限控制，确保数据隔离

### 6.4 部署建议

1. **前端**：使用 Vercel 或类似平台部署 Next.js 应用
2. **后端**：部署 Redis 用于队列和状态管理
3. **Worker**：使用 PM2 管理 Worker 进程
4. **监控**：集成 Prometheus 和 Grafana 监控系统状态
5. **CI/CD**：配置自动化构建和部署流程

## 7. AI Agent 核心能力设计

### 7.1 Agent 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Runtime                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Short-term  │  │ Long-term   │  │ Working Memory      │  │
│  │ Memory      │  │ Memory      │  │ (推理中间状态)       │  │
│  │ (Session)   │  │ (Lab KB)    │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │              │
│         └────────────────┼────────────────────┘              │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              LLM Inference Engine                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │    │
│  │  │ Router   │  │ Prompt   │  │ Output Parser    │    │    │
│  │  │ (模型选择)│  │ Builder  │  │ (结构化解析)     │    │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘    │    │
│  └──────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Tool System                              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │    │
│  │  │ Executor │  │ Timeout  │  │ Fallback Handler │    │    │
│  │  │          │  │ Manager  │  │                  │    │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘    │    │
│  └──────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Self-Evaluation                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │    │
│  │  │ Quality  │  │ Confidence│  │ Retry Decision  │    │    │
│  │  │ Scorer   │  │ Estimator │  │                 │    │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘    │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 记忆系统设计

```typescript
// 短期记忆（Session 级别）
interface ShortTermMemory {
  sessionId: string;
  messages: ConversationMessage[];
  toolCallHistory: ToolCall[];
  intermediateResults: Map<string, any>;
  createdAt: Date;
  expiresAt: Date;  // 24小时后自动清理
}

// 长期记忆（Lab 知识库）
interface LongTermMemory {
  labId: string;
  fieldMappings: FieldMapping[];      // 字段映射规则
  labRules: LabRule[];                  // 实验室规则
  promptTemplates: PromptTemplate[];    // Prompt 模板
  successPatterns: SuccessPattern[];   // 成功的脚本模式
  lastUpdated: Date;
  version: number;
}

// 工作记忆（推理中间状态）
interface WorkingMemory {
  taskId: string;
  currentStep: number;
  reasoningTrace: ReasoningStep[];    // 推理链路
  pendingToolCalls: ToolCall[];
  context: Record<string, any>;        // 当前任务上下文
}
```

### 7.3 工具调用系统

```typescript
// 工具定义标准化
interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchema>;
    required: string[];
  };
  outputSchema: JSONSchema;
  timeout: number;           // 默认 30s
  retries: number;           // 默认 2 次
  fallback?: string;        // 降级工具名称
  permissions: string[];     // 所需权限
}

// 工具执行器
interface ToolExecutor {
  execute(tool: ToolDefinition, params: any): Promise<ToolResult>;
  validatePermissions(tool: ToolDefinition, userId: string): boolean;
  handleTimeout(tool: ToolDefinition): Promise<ToolResult>;
  handleError(tool: ToolDefinition, error: Error): Promise<ToolResult>;
}

// MCP 工具适配
interface MCPToolAdapter {
  // 能力协商
  negotiateCapabilities(serverInfo: ServerInfo): CapabilitySet;
  
  // 会话缓存
  cacheSession(sessionId: string, context: any): void;
  getCachedSession(sessionId: string): any | null;
  
  // 工具调用
  callTool(toolName: string, params: any): Promise<any>;
}
```

### 7.4 自我评估与置信度

```typescript
// 输出质量评估
interface Quality评估 {
  // 语法正确性
  syntaxValid: boolean;
  
  // 字段完整性
  fieldCompleteness: number;  // 0-1
  
  // 与历史输出一致性
  consistencyScore: number;  // 0-1
  
  // 置信度
  confidence: number;         // 0-1
  
  // 综合评分
  overallScore: number;       // 加权得分
}

// 置信度阈值控制
interface ConfidenceThreshold {
  autoAccept: number;   // > 0.9: 直接返回
  humanReview: number;  // 0.7-0.9: 需要人工确认
  retry: number;        // < 0.7: 重新生成或升级模型
}
```

---

## 8. 多模型路由与降级策略

### 8.1 模型配置

```typescript
// llm-config.ts
export interface LLMConfig {
  // 部署方式
  deployment: 'cloud' | 'self-hosted' | 'on-premise';
  
  // 云端模型
  cloud?: {
    provider: 'openrouter' | 'openai' | 'anthropic';
    apiKey: string;
  };
  
  // 自托管模型（Ollama）
  selfHosted?: {
    baseUrl: string;
    defaultModel: string;
    availableModels: string[];
  };
  
  // 企业私有部署
  onPremise?: {
    endpoint: string;
    apiKey: string;
    model: string;
  };
}

// 模型选择配置
export interface ModelSelection {
  // 主要模型
  primary: ModelConfig;
  
  // 降级模型
  fallback: ModelConfig;
  
  // 简单任务用便宜模型
  cheap: ModelConfig;
  
  // 任务类型 -> 模型映射
  taskModelMap: {
    document_parsing: string;     // 文档解析 -> gpt-4o
    code_generation: string;       // 代码生成 -> claude-3.5-sonnet
    simple_classification: string; // 简单分类 -> gpt-3.5-turbo
    batch_processing: string;     // 批量处理 -> 便宜模型
  };
}

// 降级触发条件
export interface FallbackTriggers {
  latencyThreshold: number;       // 如 > 5000ms 触发降级
  errorRateThreshold: number;    // 如错误率 > 5% 触发降级
  specificErrorCodes: string[];   // 特定错误码触发降级
}
```

### 8.2 路由器实现

```typescript
// llm-router.ts
export class LLMRouter {
  private config: ModelSelection;
  private fallbackTriggers: FallbackTriggers;
  
  // 智能选择模型
  async selectModel(task: Task): Promise<ModelConfig> {
    const taskType = this.classifyTask(task);
    const modelName = this.config.taskModelMap[taskType];
    
    // 检查模型可用性和成本
    if (await this.isModelAvailable(modelName)) {
      return this.getModelConfig(modelName);
    }
    
    // 降级到备用模型
    return this.config.fallback;
  }
  
  // 降级执行
  async executeWithFallback(
    task: Task,
    onFallback?: (from: string, to: string) => void
  ): Promise<LLMResponse> {
    const model = await this.selectModel(task);
    
    try {
      return await this.callLLM(task, model);
    } catch (error) {
      if (this.shouldFallback(error)) {
        onFallback?.(model.name, this.config.fallback.name);
        return this.callLLM(task, this.config.fallback);
      }
      throw error;
    }
  }
  
  // 判断是否需要降级
  private shouldFallback(error: Error): boolean {
    if (error instanceof TimeoutError) {
      return true;
    }
    if (error instanceof RateLimitError) {
      return true;
    }
    return false;
  }
}
```

---

## 9. Prompt 版本管理与 A/B 测试

### 9.1 目录结构

```
skills/
├── labscare-script/
│   ├── SKILL.md                    # 主 Skill 定义
│   ├── prompts/
│   │   ├── production/
│   │   │   ├── extract_v1.md       # 生产版本
│   │   │   └── extract_v2.md       # 迭代版本
│   │   ├── experiment/
│   │   │   ├── extract_variant_a.md  # A/B 测试变体 A
│   │   │   └── extract_variant_b.md  # A/B 测试变体 B
│   │   └── archive/
│   │       └── extract_deprecated.md # 已废弃版本
│   ├── prompt_registry.ts           # 版本管理和切换
│   ├── metrics/
│   │   ├── effectiveness.ts         # Prompt 效果追踪
│   │   └── a_b_test_results.ts       # A/B 测试结果
│   └── experiments/
│       └── experiment_log.json       # 实验记录
```

### 9.2 Prompt 注册表

```typescript
// prompt_registry.ts
interface PromptVersion {
  id: string;
  name: string;
  version: string;
  content: string;
  variables: string[];
  createdAt: Date;
  createdBy: string;
  status: 'production' | 'experiment' | 'deprecated';
  metrics?: PromptMetrics;
}

interface PromptMetrics {
  usageCount: number;
  successRate: number;
  avgLatency: number;
  avgCost: number;
  userSatisfaction?: number;
}

class PromptRegistry {
  // 获取当前生产版本
  getProductionPrompt(skillName: string): PromptVersion;
  
  // 切换到指定版本
  switchVersion(skillName: string, version: string): void;
  
  // 发布新版本
  publishVersion(prompt: PromptVersion): void;
  
  // A/B 测试分配
  async getPromptForUser(
    skillName: string, 
    userId: string
  ): Promise<PromptVersion>;
}
```

### 9.3 A/B 测试框架

```typescript
// a_b_testing.ts
interface ABTest {
  id: string;
  skillName: string;
  variants: {
    control: PromptVersion;    // 对照组
    treatment: PromptVersion;  // 实验组
  };
  allocation: {
    control: number;           // 对照组比例（如 0.5 = 50%）
    treatment: number;
  };
  metrics: {
    primary: string;           // 主要指标
    secondary: string[];       // 次要指标
  };
  status: 'running' | 'completed' | 'paused';
  startDate: Date;
  endDate?: Date;
}

// A/B 测试执行
class ABTestRunner {
  // 分配用户到实验组
  assignUser(testId: string, userId: string): 'control' | 'treatment';
  
  // 记录实验结果
  recordResult(
    testId: string, 
    variant: 'control' | 'treatment',
    metrics: Record<string, number>
  ): void;
  
  // 计算统计显著性
  calculateSignificance(testId: string): StatisticalResult;
}
```

---

## 10. AI 安全层

### 10.1 安全架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Security Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input Sanitization          Output Safety Check            │
│  ┌──────────────────┐       ┌──────────────────────────┐    │
│  │ • Prompt 注入检测 │       │ • 内容安全分类           │    │
│  │ • 恶意指令过滤   │       │ • 敏感信息检测           │    │
│  │ • 特殊字符转义   │       │ • 格式完整性验证         │    │
│  └──────────────────┘       └──────────────────────────┘    │
│            │                          │                      │
│            ▼                          ▼                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Permission Guard                         │    │
│  │  • 工具调用权限二次校验                                │    │
│  │  • 数据访问范围控制                                    │    │
│  │  • 操作审计日志                                        │    │
│  └──────────────────────────────────────────────────────┘    │
│                            │                                  │
│                            ▼                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Data Protection                          │    │
│  │  • LIMS 敏感字段自动脱敏                               │    │
│  │  • PII 数据识别与保护                                  │    │
│  │  • 数据最小化原则                                       │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Prompt 注入防护

```typescript
// prompt_injection_guard.ts
interface InjectionPattern {
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high';
  action: 'sanitize' | 'block' | 'alert';
}

class PromptInjectionGuard {
  private patterns: InjectionPattern[] = [
    // 指令覆盖尝试
    { 
      pattern: /ignore (previous|all|above) instructions?/i,
      severity: 'high',
      action: 'block'
    },
    // 系统提示提取尝试
    {
      pattern: /(reveal|show|print|return) (your|the) (system|sys) (prompt|instruct)/i,
      severity: 'high',
      action: 'block'
    },
    // 角色扮演逃逸
    {
      pattern: /forget (about) (your|layer)/i,
      severity: 'medium',
      action: 'sanitize'
    },
    // Base64/编码注入
    {
      pattern: /(base64|decode|encode).*(instruction|prompt)/i,
      severity: 'medium',
      action: 'sanitize'
    }
  ];
  
  // 检测并处理
  sanitize(userInput: string): SanitizedResult {
    for (const pattern of this.patterns) {
      if (pattern.pattern.test(userInput)) {
        return {
          sanitized: this.applySanitization(userInput),
          alert: pattern.action === 'alert' || pattern.action === 'block',
          blocked: pattern.action === 'block',
          severity: pattern.severity
        };
      }
    }
    return { sanitized: userInput, alert: false, blocked: false };
  }
}
```

### 10.3 输出内容安全

```typescript
// output_safety_check.ts
interface SafetyCheckConfig {
  // 敏感信息检测
  piiPatterns: PIIPattern[];
  
  // 内容分类阈值
  contentFilters: {
    violence: number;      // 暴力内容阈值
    adult: number;         // 成人内容阈值
    illegal: number;       // 违法内容阈值
  };
  
  // 自定义敏感词
  customKeywords: string[];
}

class OutputSafetyChecker {
  // 完整安全检查
  async check(output: string): Promise<SafetyReport> {
    const [
      piiResult,
      contentClassification,
      keywordResult
    ] = await Promise.all([
      this.detectPII(output),
      this.classifyContent(output),
      this.checkKeywords(output)
    ]);
    
    return {
      safe: piiResult.count === 0 && 
            contentClassification.confidence < 0.5 &&
            keywordResult.count === 0,
      piiDetected: piiResult,
      contentType: contentClassification.category,
      blockedKeywords: keywordResult.matches
    };
  }
  
  // PII 自动脱敏
  redactPII(text: string): RedactedResult {
    // 检测并脱敏：姓名、电话、邮箱、地址、身份证等
    return {
      redacted: text.replace(/\d{11}/g, '[PHONE]')
                    .replace(/\w+@\w+\.\w+/g, '[EMAIL]'),
      redactions: [...]
    };
  }
}
```

### 10.4 权限与审计

```typescript
// permission_guard.ts
interface ToolPermission {
  toolName: string;
  requiredRoles: string[];
  labAccessScope: 'own' | 'all';
  dataScope: 'own' | 'team' | 'all';
}

class PermissionGuard {
  // 工具调用权限校验
  async checkToolPermission(
    userId: string,
    labId: string,
    tool: ToolDefinition
  ): Promise<PermissionResult>;
  
  // 敏感操作审计
  async auditAction(action: AuditAction): Promise<void> {
    await this.log({
      userId: action.userId,
      labId: action.labId,
      action: action.type,
      resource: action.resource,
      timestamp: new Date(),
      success: action.success,
      metadata: action.metadata
    });
  }
}

// 审计日志格式
interface AuditLog {
  id: string;
  userId: string;
  labId: string;
  action: 'tool_call' | 'data_access' | 'config_change' | 'admin_action';
  resource: string;
  timestamp: Date;
  ip: string;
  userAgent: string;
  success: boolean;
  metadata?: Record<string, any>;
}
```

---

## 11. 成本监控与优化

### 11.1 成本追踪架构

```typescript
// cost_tracking.ts
interface TokenUsage {
  labId: string;
  projectId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheHits: number;         // 缓存节省的 tokens
  costUSD: number;
  timestamp: Date;
  requestId: string;
}

interface CostMetrics {
  labId: string;
  period: 'daily' | 'weekly' | 'monthly';
  totalCost: number;
  tokenUsage: {
    input: number;
    output: number;
    cached: number;
  };
  requestCount: number;
  avgCostPerRequest: number;
  byModel: Record<string, number>;
}

// 成本控制策略
interface CostControl {
  // 实验室月度预算
  monthlyBudgetPerLab: Record<string, number>;
  
  // 告警阈值
  alertThreshold: number;    // 如 0.8 = 80% 预算时告警
  
  // 超预算行为
  overBudgetAction: 'block' | 'throttle' | 'notify';
  
  // 每日限额
  dailyLimit?: number;
}
```

### 11.2 成本监控服务

```typescript
// cost_monitor.ts
class CostMonitor {
  private control: CostControl;
  private redis: Redis;
  
  // 实时记录用量
  async recordUsage(usage: TokenUsage): Promise<void>;
  
  // 获取当前周期用量
  async getCurrentUsage(labId: string): Promise<CostMetrics>;
  
  // 检查是否超预算
  async checkBudget(labId: string): Promise<BudgetStatus> {
    const usage = await this.getCurrentUsage(labId);
    const budget = this.control.monthlyBudgetPerLab[labId];
    const percent = usage.totalCost / budget;
    
    return {
      exceeded: percent >= 1.0,
      percentUsed: percent,
      remaining: budget - usage.totalCost,
      alert: percent >= this.control.alertThreshold
    };
  }
  
  // 超预算处理
  async handleOverBudget(labId: string): Promise<void>;
}
```

### 11.3 成本优化策略

```typescript
// cost_optimization.ts
class CostOptimizer {
  // 1. 缓存优化
  async getCachedResponse(prompt: string): Promise<string | null>;
  async cacheResponse(prompt: string, response: string): Promise<void>;
  
  // 2. Prompt 压缩
  compressPrompt(prompt: string, maxTokens: number): string;
  
  // 3. 智能模型选择
  // 简单任务用便宜模型
  selectOptimalModel(task: Task): string {
    if (task.complexity === 'low') {
      return 'gpt-3.5-turbo';  // 便宜 10x
    } else if (task.complexity === 'medium') {
      return 'gpt-4o-mini';    // 性价比高
    }
    return 'gpt-4o';           // 高质量
  }
  
  // 4. 批处理优化
  // 合并小请求
  async batchRequests(requests: Request[]): Promise<BatchResponse>;
}
```

---

## 12. 本地模型支持

### 12.1 多部署方式配置

```typescript
// llm_deployment.ts
type LLMDeployment = 
  | { type: 'cloud'; provider: 'openrouter' | 'openai' | 'anthropic' }
  | { type: 'self-hosted'; baseUrl: string; apiKey?: string }
  | { type: 'on-premise'; endpoint: string; apiKey: string };

interface DeploymentConfig {
  active: LLMDeployment;
  fallback?: LLMDeployment;
  // 是否启用本地模型
  enableLocalModel: boolean;
  // 本地模型优先级
  localModelPriority: 'primary' | 'fallback' | 'never';
}

// Ollama 自托管支持
interface OllamaConfig {
  baseUrl: string;           // 如 http://localhost:11434
  defaultModel: string;      // 如 llama3, codellama
  availableModels: string[];
  // 向后兼容 OpenAI 格式
  openAICompatible: boolean;  // Ollama v0.1.20+ 支持
}
```

### 12.2 混合调用策略

```typescript
// hybrid_llm_caller.ts
class HybridLLMCaller {
  // 优先使用本地模型
  async call(params: LLMParams): Promise<LLMResponse> {
    if (this.shouldUseLocal(params)) {
      try {
        return await this.callLocal(params);
      } catch (error) {
        if (this.shouldFallback(error)) {
          return await this.callCloud(params);
        }
        throw error;
      }
    }
    return await this.callCloud(params);
  }
  
  // 判断是否使用本地模型
  private shouldUseLocal(params: LLMParams): boolean {
    // 简单任务优先本地
    if (params.taskType === 'simple_classification') {
      return true;
    }
    // 本地模型擅长的任务
    if (params.taskType === 'code_generation') {
      return this.localModels.includes('codellama');
    }
    return false;
  }
}
```

---

## 13. MLOps 基础

### 13.1 模型注册表

```
mlops/
├── model_registry/
│   ├── registry.json              # 模型版本索引
│   ├── scripts/
│   │   ├── extract_v1/            # 脚本生成模型 v1
│   │   ├── extract_v2/            # 脚本生成模型 v2
│   │   └── schema_v1/             # Schema 生成模型
│   └── evaluation/
│       └── latest_results.json   # 最新评估结果
```

```typescript
// model_registry.ts
interface ModelVersion {
  id: string;
  name: string;
  version: string;
  skillType: 'script_generation' | 'schema_generation' | 'field_mapping';
  baseModel: string;
  fineTuneConfig?: FineTuneConfig;
  promptVersion: string;
  evaluationMetrics: EvaluationMetrics;
  deploymentStatus: 'staging' | 'production' | 'archived';
  createdAt: Date;
  deployedAt?: Date;
}

class ModelRegistry {
  // 注册新模型版本
  register(model: ModelVersion): void;
  
  // 获取生产版本
  getProduction(skillType: string): ModelVersion;
  
  // 切换生产版本
  switchProduction(modelId: string): void;
}
```

### 13.2 自动评估流水线

```typescript
// evaluation_pipeline.ts
interface EvaluationDataset {
  id: string;
  name: string;
  samples: EvaluationSample[];
}

interface EvaluationSample {
  input: {
    document?: string;
    schema?: object;
    context?: object;
  };
  expected: {
    output: string;
    score: number;
    metadata?: object;
  };
}

class EvaluationPipeline {
  // 评估脚本生成质量
  async evaluateScriptGeneration(
    model: ModelVersion,
    dataset: EvaluationDataset
  ): Promise<EvaluationResult> {
    const results = [];
    
    for (const sample of dataset.samples) {
      const output = await this.generateScript(sample.input);
      const comparison = this.compareOutput(output, sample.expected);
      results.push({
        sampleId: sample.id,
        output,
        expected: sample.expected,
        similarity: comparison.similarity,
        syntaxValid: comparison.syntaxValid,
        fieldsComplete: comparison.fieldCompleteness
      });
    }
    
    return this.aggregateResults(results);
  }
  
  // 聚合评估结果
  aggregateResults(results: SampleResult[]): EvaluationResult {
    return {
      totalSamples: results.length,
      syntaxAccuracy: results.filter(r => r.syntaxValid).length / results.length,
      fieldCompleteness: avg(results.map(r => r.fieldsComplete)),
      semanticSimilarity: avg(results.map(r => r.similarity)),
      passRate: results.filter(r => r.similarity > 0.8).length / results.length
    };
  }
}
```

### 13.3 数据漂移检测

```typescript
// drift_detection.ts
interface DataDriftMetrics {
  // 输入数据分布变化
  inputDistributionDrift: number;  // 0-1，越高表示漂移越大
  
  // Schema 变化检测
  schemaChanges: SchemaChange[];
  
  // 输出质量变化
  outputQualityTrend: 'stable' | 'degrading' | 'improving';
}

class DriftDetector {
  // 检测输入数据漂移
  async detectInputDrift(
    currentBatch: Document[],
    baselineBatch: Document[]
  ): Promise<number>;
  
  // 检测 Schema 变化
  async detectSchemaChanges(
    currentSchema: JSONSchema,
    previousSchema: JSONSchema
  ): Promise<SchemaChange[]>;
  
  // 检测输出质量趋势
  async detectQualityTrend(
    labId: string,
    days: number
  ): Promise<'stable' | 'degrading' | 'improving'>;
  
  // 告警触发
  async checkAndAlert(labId: string): Promise<void>;
}
```

### 13.4 实验追踪

```typescript
// experiments_tracker.ts
interface Experiment {
  id: string;
  name: string;
  description: string;
  // 实验变量
  variables: {
    promptVersion?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  // 固定参数
  fixedParams: Record<string, any>;
  // 评估指标
  metrics: Record<string, number>;
  // 样本量
  sampleSize: number;
  // 统计显著性
  significance?: StatisticalSignificance;
  status: 'running' | 'completed' | 'abandoned';
  createdAt: Date;
  completedAt?: Date;
}

class ExperimentTracker {
  // 创建实验
  createExperiment(exp: Omit<Experiment, 'id'>): string;
  
  // 记录实验结果
  recordResult(experimentId: string, result: Record<string, number>): void;
  
  // 比较实验
  compare(experimentIds: string[]): ComparisonResult;
}
```

---

## 14. 实施优先级与路线图

### 14.1 分阶段实施

```
Phase 1: MVP 阶段 (1-2月)
├── 核心功能
│   ├── Lab 切换和项目管理 ✓ (已有设计)
│   ├── 文档上传解析 ✓
│   ├── 字段映射 Schema ✓
│   └── LIMS 数据联调 ✓
└── AI 基础能力
    ├── 多模型路由基础版 ⚡ (新增)
    └── Prompt 版本管理基础版 ⚡ (新增)

Phase 2: 生产就绪 (2-3月)
├── AI 安全层 ⚡ (必须)
│   ├── Prompt 注入防护
│   ├── 输出内容审核
│   └── 权限审计
├── 成本监控 ⚡ (必须)
│   ├── Token 用量追踪
│   ├── 预算告警
│   └── 成本报表
└── 可靠性增强
    ├── 模型降级策略
    └── 错误重试优化

Phase 3: 高级特性 (3-4月)
├── Agent 记忆系统
├── 自我评估机制
├── A/B 测试框架
└── MLOps 基础
    ├── 模型注册表
    ├── 自动评估流水线
    └── 漂移检测
```

### 14.2 技术债务管理

| 类别 | 项目 | 优先级 | 预计工时 |
|------|------|--------|----------|
| 安全 | Prompt 注入防护 | P0 | 1周 |
| 安全 | 输出内容审核 | P0 | 1周 |
| 成本 | 用量追踪系统 | P0 | 3天 |
| 成本 | 预算告警 | P0 | 2天 |
| 可靠 | 模型降级 | P1 | 3天 |
| 可靠 | 重试策略优化 | P1 | 2天 |
| 可观测 | AI 质量指标 | P1 | 1周 |
| 优化 | 本地模型支持 | P2 | 2周 |

---

## 15. 总结

LabFlow MCP Studio 是一个功能完整、架构先进的 AI Agent 编排平台，旨在为实验室提供智能的报表生成和数据处理能力。系统采用现代化的技术栈和架构设计，支持多租户隔离、全流程闭环、AI 驱动的智能处理，以及高性能的批量任务处理。

### 补充后的核心优势

1. **AI 工程完整性** ✅
   - Agent 记忆系统支持多步骤推理
   - 工具调用标准化与安全防护
   - 自我评估机制确保输出质量

2. **可靠性增强** ✅
   - 多模型路由与智能降级
   - Prompt 版本管理与 A/B 测试
   - 完善的错误处理与重试策略

3. **生产就绪** ✅
   - AI 安全层防护
   - 成本监控与预算控制
   - 完整的审计日志

4. **可扩展性** ✅
   - 本地模型支持预留
   - MLOps 基础架构
   - 数据漂移检测

5. **运营效率** ✅
   - 自动化评估流水线
   - 实验追踪系统
   - 性能与成本可视化

通过实施本设计方案，系统将具备企业级 AI 产品的完整能力，确保在实验室场景中的可靠性、安全性和成本可控性。