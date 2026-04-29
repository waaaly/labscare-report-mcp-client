# 批量目录导入设计

## 概述

用户在 ChatArea 对话界面中上传规范的目录文件夹，系统根据目录结构自动创建项目（Project）、报告（Report）及报告物料（Document）。

## 核心架构决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 资源创建 | LLM Agent 调用 Tool | 复用现有 Tool 基础设施，维护成本低 |
| 文件上传 | 前端直传 MinIO | 避免 FormData 过大、LLM Token 消耗为零 |
| DB 记录创建 | 文件上传阶段不写 DB | Document 的 projectId/reportId 此时不存在 |
| 执行引擎 | 方案 A（LLM + Tool Calling） | 用户偏好，可后续扩展脚本/知识库生成 |
| Schema 变更 | 不改 | projectId/reportId 保持必填，上传阶段只写 MinIO |

## 数据流

```
阶段1: 前端校验
  validateDirectoryStructure() → 确认弹窗

阶段2: 文件直传 MinIO（前端）
  for each file: POST /api/documents/upload → { url, storagePath }
  上传进度弹窗，完成后方可发送

阶段3: 构造 Agent Prompt（纯文本 JSON）
  不含图片 base64，只有路径元数据和已上传的 URL/storagePath

阶段4: LLM Agent 执行
  list_labs → create_project → create_report_template → upload_document (关联模式)
  SSE 流式返回进度

阶段5: 前端展示
  batch_import 气泡 + Agent 执行结果气泡
  ValidatedStructurePanel 实时更新状态
```

## 改动清单

### 新建文件

| 文件 | 职责 |
|------|------|
| `app/api/documents/upload/route.ts` | POST 接收单文件 → 调 `uploadFile()` 上传 MinIO → 返回 `{ url, storagePath, fileName, size, contentType }`，不写 DB |
| `app/api/documents/route.ts` | PUT 批量创建 Document DB 记录（文件已在 MinIO），接收 `{ documents: [...] }` |
| `lib/llm/prompt-templates.ts` | 抽离 `buildBatchImportPrompt(batchData)` 函数，根据目录结构生成分步骤的 Agent 指令 |
| `components/conversation/UploadProgressDialog.tsx` | 上传进度弹窗：文件列表 + 进度条 + 发送按钮（全部完成后启用） |
| `components/conversation/BatchImportBubble.tsx` | batch_import 用户消息的气泡 UI，折叠树形展示项目/报告/物料 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `components/conversation/ChatArea.tsx` | `handleUploadPassed` 改为：启动上传进度弹窗 → 等待全部上传 → 构造 batch_import JSON → 发送对话；`ValidatedStructurePanel` 新增执行状态 prop |
| `lib/llm/api-tools.ts` | `upload_document` Tool 改为关联模式：`PUT /api/documents` 传入已有的 url/storagePath |
| `app/api/llm/route.ts` | 新增 batch_import 识别逻辑：检测 `{"action":"batch_import"...` → 调用 `buildBatchImportPrompt` 替换最后一条 HumanMessage |

### 不动文件

| 文件 | 原因 |
|------|------|
| `app/api/labs/[labId]/projects/[projectId]/documents/route.ts` | 保持现有队列异步处理路径 |
| `lib/minio/client.ts` | 已有 `uploadFile`，直接复用 |
| `prisma/schema.prisma` | Document.projectId / reportId 保持必填，上传阶段不写 DB |

## 前端交互流程

### ChatArea.tsx

1. `handleFolderChange` — 不变：`traverseFileTree` → `validateDirectoryStructure` → 弹出校验弹窗
2. 校验弹窗 — 不变：映射关系 + 错误列表 +"确认创建"按钮
3. 用户点"确认创建" → **新增 UploadProgressDialog**
   - 并发 `POST /api/documents/upload` 上传所有文件
   - 每个文件独立进度条
   - 总进度计数器
   - [发送到Agent] 按钮：全部上传完成前灰色 + "请等待文件上传完成"
4. 全部完成后用户点 [发送到Agent]：
   - 构造 `batch_import` JSON 作为 prompt 字段
   - 调用 `onSend(prompt)`，同时传入 `action: "batch_import"`
   - 消息在聊天列表显示 BatchImportBubble
5. SSE 流返回 Agent 执行结果，显示在 Agent 气泡中

### ValidatedStructurePanel

确认创建后保持在输入框上方，新增 `status` prop：
- `pending` — ⏳ 灰色
- `uploading` — 📤 蓝色
- `done` — ✅ 绿色
- `error` — ❌ 红色

### BatchImportBubble Props

```ts
interface BatchImportProps {
  labName: string;
  projects: {
    name: string;
    reports: {
      name: string;
      documents: {
        fileName: string;
        status: 'pending' | 'uploaded';
      }[];
    }[];
  }[];
  fileCount: number;
}
```

## Agent Prompt 结构

```ts
function buildBatchImportPrompt(data: BatchImportData): string {
  return `
⚠️ 批量导入任务 — 请严格按以下步骤执行，每步完成后报告状态。

【当前实验室】${data.labName}

【执行规则】
1. 必须按 步骤1 → 步骤2 → 步骤3 顺序执行，不要跳过或合并
2. 每一步需要的 ID 必须从上一步的返回值中获取，不要猜测或编造
3. 如果任一步骤失败，立即停止并报告具体错误，不要继续后续步骤
4. 工具参数中的 name 字段必须与以下清单完全一致

【待创建资源清单】

步骤1：验证实验室
  调用 list_labs，确认实验室"${data.labName}"存在，获取 labId

步骤2：创建项目和报告
${data.projects.map((p, pi) => `
  项目${pi + 1}：${p.name}
    a. create_project({ labId, name: "${p.name}" })
    b. 等待返回 { id: projectId }
${p.reports.map((r, ri) => 
`    c${ri > 0 ? `+${ri}` : ''}. create_report_template({ labId, projectId, name: "${r.name}" })
       → 返回 { id: reportId_${pi}_${ri} }`
).join('\n')}`
).join('\n')}

步骤3：关联已上传的物料文件
${data.projects.map((p, pi) => 
p.reports.map((r, ri) => 
r.documents.map(d => 
`  upload_document({ labId, projectId, reportId: reportId_${pi}_${ri}, 
    url: "${d.url}", storagePath: "${d.storagePath}", name: "${d.fileName}", 
    type: "${d.contentType}", size: ${d.size} })`
).join('\n')
).join('\n')
).join('\n')}
  `.trim();
}
```

## API 接口规格

### POST /api/documents/upload

```
Request:
  Content-Type: multipart/form-data
  file: <binary>

Response 200:
  {
    "url": "/documents/1714567890-占位符模板.png",
    "storagePath": "documents/1714567890-占位符模板.png",
    "fileName": "占位符模板.png",
    "size": 204800,
    "contentType": "image/png"
  }
```

### PUT /api/documents

```
Request:
  Content-Type: application/json
  {
    "documents": [
      {
        "projectId": "proj_001",
        "reportId": "rpt_001",
        "name": "占位符模板.png",
        "type": "image/png",
        "url": "/documents/1714567890-模板.png",
        "storagePath": "documents/1714567890-模板.png",
        "size": 204800,
        "status": "SUCCESS"
      }
    ]
  }

Response 200:
  [
    { "id": "doc_001", "name": "占位符模板.png", ... }
  ]
```

## Token 消耗估算

| 阶段 | Token 消耗 |
|------|-----------|
| 文件上传 MinIO | 0（前端直传） |
| Agent Prompt（纯文本 JSON） | ~500-1200（取决于项目/报告数量） |
| Agent 工具调用参数 | ~200-500 |
| 图片 | 0（LLM 不接触文件内容） |
| **总计** | ~700-1700 |

## 错误处理与重试

### MinIO 上传重试

```
单文件上传
  │
  ├─ 自动重试（2次，指数退避 1s → 2s）
  │   └─ 成功 → ✅
  │   └─ 全部失败 → ❌ 显示 [重试] 按钮
  │
  └─ 用户手动点 [重试]（单文件 / 全部失败文件）
      └─ 再次自动重试 2 次
          └─ 成功 → ✅
          └─ 仍失败 → ❌ 保持失败状态（用户可忽略该文件继续）
```

### [发送到Agent] 按钮启用规则

| 场景 | 启用 |
|------|------|
| 全部上传成功 | ✅ |
| 有失败文件但至少一个成功 | ✅（失败文件从 Prompt 中排除） |
| 全部失败 | ❌ 灰色禁用，提示"所有文件上传失败" |

### 实现

```ts
async function uploadFileWithRetry(
  file: File,
  relativePath: string,
  maxRetries = 2
): Promise<UploadResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
      if (res.ok) return { ...await res.json(), status: 'uploaded' };
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
  }
  throw new Error('Max retries exceeded');
}
```

### 其他错误

| 场景 | 处理 |
|------|------|
| list_labs 失败 | Agent 停止执行，SSE 返回错误消息 |
| create_project 失败 | Agent 停止执行，输出失败的项目名称 |
| create_report_template 失败 | Agent 停止执行，输出失败的报告名称 |
| upload_document（关联）失败 | Agent 继续执行，输出失败的物料列表 |
