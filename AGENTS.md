# AGENTS.md - AI Agent 工作规则

> 本文件是 LabFlow MCP Studio 项目的根指令文件，定义 AI Agent 开工时必须遵循的工作流程和规则。

## 开工流程

每次开始工作前，Agent 必须按以下顺序执行：

1. **读取进度文件** — 查看 `progress.md` 了解项目当前状态
2. **读取功能清单** — 查看 `feature_list.json` 了解功能优先级
3. **确认当前任务** — 只做一个功能，不分散注意力
4. **开始工作** — 按照功能清单中的验证步骤执行

## 工作规则

### 做事前

- [ ] 读取 `progress.md` 的"当前已验证状态"部分
- [ ] 读取 `feature_list.json` 确认目标功能
- [ ] 在功能清单中将该功能状态改为 `in_progress`
- [ ] 理解功能正常时用户能看到什么行为

### 做事中

- [ ] 一次只做一个功能，不同时推进多个
- [ ] 根据当前任务，查询项目根目录下.agents/skills/ 目录下的可用 skill 文件
- [ ] 每次修改后运行对应的验证命令
- [ ] 记录每一步的证据（输出、截图、日志）
- [ ] 如果验证失败，先修基础状态再继续

### 收尾时

- [ ] 功能验证通过后，更新 `progress.md` 的会话记录
- [ ] 在 `feature_list.json` 中记录 evidence
- [ ] 将功能状态改为 `passing`
- [ ] 列出已知风险或未解决问题

## 完成定义

**一个功能必须满足以下全部条件才算完成：**

1. **代码层面**：所有相关文件已修改并保存
2. **验证层面**：运行了验证命令，输出符合预期
3. **记录层面**：在 `feature_list.json` 中记录了 evidence
4. **状态层面**：功能状态已更新为 `passing`
5. **下一跳层面**：在 `progress.md` 中记录了"下一步最佳动作"

## 项目规范

### 仓库根目录
```
d:/rocky-work/labscare-report-mcp-client
```

### 技术栈
- **框架**: Next.js 15 (App Router), React 19, TypeScript 5.6
- **数据库**: PostgreSQL via Prisma ORM
- **队列**: Redis + BullMQ
- **存储**: MinIO (S3-compatible)
- **AI**: LangChain + OpenAI/OpenRouter/Google GenAI
- **样式**: TailwindCSS 3 + shadcn/ui

### 标准验证命令
```bash
# TypeScript 类型检查
# 在确保 npm run typecheck运行完成后，检查根目录下的typecheck.log文件
# 在该文件中获取详细的类型检查错误信息
npm run typecheck

# ESLint 检查
npm run lint

# 启动开发服务器
npm run dev

# 启动 Worker
npm run worker:dev
```
## 何时调用何种skill
以下提到的skill，均在项目根目录.agents/skills/下。

## brainstorming
- 当需要帮助将想法转化为完整的设计和规格，调用此 skill。

### vercel-react-best-practices
当出现以下情况时，调用此 skill：
- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times
- 只要编写涉及到ts,tsx文件

### ui-ux-pro-max
- 当任务涉及用户界面结构、视觉设计决策、交互模式或用户体验质量控制时，应该使用此技能

### commit-with-readme
-  当需要commit提交代码时，调用此 skill。

## 重要规则

> **如果验证失败了，Agent 应该停下来先修基础状态，不要在坏的基础上继续叠新功能。**

---

> 本文件遵循 [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/) 规范
