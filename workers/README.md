# 批量任务处理系统使用说明

## 概述

批量任务处理系统基于 BullMQ 和 Redis Stream 实现，支持并发处理多个 LLM 生成任务，同时保持流式输出的实时体验。

## 架构

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       ▼
┌───────────────────────────────────┐
│   Next.js API                   │
│   - POST /api/llm/batch         │
│   - GET  /api/stream            │
│   - GET  /api/stream/batch      │
└──────┬──────────────────────────┘
       │
       ▼
┌───────────────────────────────────┐
│   Redis + BullMQ                │
│   - Queue: report               │
│   - Stream: stream:{jobId}      │
│   - Stream: batch-stream:{id}   │
└──────┬──────────────────────────┘
       │
       ▼
┌───────────────────────────────────┐
│   Worker Process                │
│   - Workers/batch-worker.ts      │
│   - Concurrency: 3              │
└──────────────────────────────────┘
       │
       ▼
┌───────────────────────────────────┐
│   LLM Provider                  │
└──────────────────────────────────┘
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

**关键配置项**：
- `REDIS_URL`: Redis 连接地址
- `FLOW_API_KEY`: LLM API 密钥
- `WORKER_CONCURRENCY`: Worker 并发数（默认 3）
- `LLM_MAX_CONCURRENCY`: LLM 并发数（默认 10）

### 3. 启动 Redis

使用 Docker 启动 Redis：

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 4. 启动 Next.js 开发服务器

```bash
npm run dev
```

### 5. 启动 Worker（新终端）

```bash
npm run worker
```

或者开发模式（自动重启）：

```bash
npm run worker:dev
```

## API 使用

### 批量提交任务

```bash
POST /api/llm/batch
Content-Type: application/json

{
  "tasks": [
    {
      "prompt": "生成报表脚本：...",
      "contextJson": "{\"conversationId\": \"conv-1\"}",
      "messagesJson": "[{\"role\": \"user\", \"content\": \"...\"}]",
      "files": [
        {
          "name": "template.png",
          "type": "image",
          "content": "data:image/png;base64,...",
          "dataUrl": "data:image/png;base64,..."
        }
      ]
    }
  ]
}
```

**响应**：

```json
{
  "success": true,
  "batchId": "batch-uuid",
  "jobIds": ["batch-uuid-0", "batch-uuid-1"],
  "totalTasks": 2,
  "queuedTasks": 2
}
```

### 订阅单个任务流

```bash
GET /api/stream?jobId=batch-uuid-0
```

**SSE 消息格式**：

```
data: {"type":"thought","text":"正在分析..."}
data: {"type":"content","text":"生成报表..."}
data: {"type":"done","total_duration":5000}
```

### 订阅批量任务流

```bash
GET /api/stream/batch?batchId=batch-uuid
```

**SSE 消息格式**：

```
data: {"type":"task_start","jobId":"batch-uuid-0","taskIndex":0}
data: {"type":"content","jobId":"batch-uuid-0","text":"..."}
data: {"type":"done","jobId":"batch-uuid-0"}
data: {"type":"task_end","batchId":"batch-uuid","completedTasks":2,"failedTasks":0}
```

## 前端集成示例

```typescript
// 提交批量任务
async function submitBatchTasks(tasks: Task[]) {
  const response = await fetch('/api/llm/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks })
  });

  const { batchId, jobIds } = await response.json();

  // 订阅批量任务流
  subscribeBatchStream(batchId);
}

// 订阅批量任务流
function subscribeBatchStream(batchId: string) {
  const eventSource = new EventSource(`/api/stream/batch?batchId=${batchId}`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'task_start':
        // 任务开始
        updateTaskStatus(data.jobId, 'processing');
        break;

      case 'content':
        // 接收内容
        appendContent(data.jobId, data.text);
        break;

      case 'done':
        // 任务完成
        updateTaskStatus(data.jobId, 'completed');
        break;

      case 'batch_end':
        // 批量任务完成
        console.log(`Batch completed: ${data.completedTasks}/${data.totalTasks}`);
        eventSource.close();
        break;
    }
  };
}
```

## 配置说明

### Worker 并发控制

| 配置项 | 默认值 | 说明 |
|-------|--------|------|
| `WORKER_CONCURRENCY` | 3 | Worker 同时处理任务数 |
| `LLM_MAX_CONCURRENCY` | 10 | LLM 最大并发请求数 |

**原则**：`WORKER_CONCURRENCY <= LLM_MAX_CONCURRENCY`

### 批量任务限制

| 配置项 | 默认值 | 说明 |
|-------|--------|------|
| `MAX_BATCH_SIZE` | 10 | 单次批量最大任务数 |
| `MAX_PROMPT_LENGTH` | 10000 | 单个提示词最大长度 |

## 监控

### Prometheus 指标

启用监控后，可以访问 `http://localhost:9090` 查看指标。

**关键指标**：

- `tasks_total`: 任务总数
- `task_duration_seconds`: 任务处理时长
- `tasks_active`: 当前活跃任务数
- `queue_size`: 队列积压任务数
- `llm_calls_total`: LLM 调用总数
- `llm_latency_seconds`: LLM 调用延迟

### 日志

日志使用 Pino 格式化输出：

```bash
# 开发环境
npm run dev | pino-pretty

# 生产环境（JSON 格式）
npm run start
```

## 故障排查

### Worker 无法连接 Redis

```bash
# 检查 Redis 是否运行
redis-cli ping

# 检查 Redis 配置
redis-cli CONFIG GET requirepass
```

### 任务卡在 queued 状态

```bash
# 检查 Worker 进程
pm2 list

# 检查队列状态
redis-cli LLEN bull:report:waiting
```

### SSE 连接断开

- 检查 Redis Stream 是否存在：`redis-cli XLEN stream:{jobId}`
- 检查 Stream TTL：`redis-cli TTL stream:{jobId}`
- 使用 `fromId` 参数实现断线重连

## 生产部署

### 使用 PM2 管理 Worker

```bash
# 安装 PM2
npm install -g pm2

# 启动 Worker
pm2 start npm --name "batch-worker" -- run worker

# 查看状态
pm2 status

# 查看日志
pm2 logs batch-worker

# 重启
pm2 restart batch-worker
```

### Docker Compose 部署

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  nextjs:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  worker:
    build: .
    command: npm run worker
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    deploy:
      replicas: 2
```

## 当前功能兼容性

✅ **保持现有功能**：
- 单任务 API (`POST /api/llm`) 仍然可用
- 对话界面功能不受影响
- 现有的 Agent 和 Skill 系统保持不变

🆕 **新增功能**：
- 批量任务 API (`POST /api/llm/batch`)
- 任务流式订阅 API (`GET /api/stream`)
- 批量任务流式订阅 API (`GET /api/stream/batch`)
- Worker 进程处理并发任务

## 下一步

1. 实现批量任务前端界面
2. 添加任务状态查询 API
3. 实现任务取消功能
4. 添加任务优先级支持
5. 实现任务结果导出
