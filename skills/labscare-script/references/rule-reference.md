# 历史规则与冲突说明

这个文件专门用来提醒未来的 Codex：旧文档里有些说法太绝对，已经被真实案例推翻或弱化。

## 目录

- 信息优先级
- 已被推翻或弱化的旧说法
- 仍然可信的经验
- 当前实验室的现实倾向

## 1. 以谁为准

优先级固定如下：

1. 用户当前提供的模板图、结果图、占位符说明
2. 用户当前提供的真实数据 JSON
3. 本 skill 的内置摘要文档
4. 更旧的历史规则

## 2. 已被样本推翻或弱化的旧说法

### “只能用 ES5，禁止箭头函数 / const / find”

不成立。

真实样本里已经出现：

- `=>`
- `const`
- `.find()`
- `.forEach()`
- `Object.assign()`

执行建议：

- 默认仍可写保守语法。
- 但不要把 ES5 说成唯一合法语法。

### “Java Map 必须全程 `.get()`”

不成立。

真实样本里同时存在：

- `procedures.get(processId)`
- `procedures[processId]`
- `procedure.processes[templateld].form`
- `getForm(procedures)`

执行建议：

- 跟随最接近的已知参考风格。
- 同一脚本内部保持一致。

### “`templateld` 是引擎硬要求”

不成立。

真实情况是：

- 样本普遍沿用 `var templateId = ''` 加 `templateld = i` 这种复制习惯。
- 真正重要的是你后续取值用的变量名要一致。

执行建议：

- 复制最接近的已知参考时原样保留最稳。
- 但不要再把它描述成引擎保留字。

### “模板内联 JS 必须先 `set(getCheckBox/formatDateCN/signUrl)`”

当前样本不能支持这个结论。

因为：

- 样本模板说明里确实用了 `getCheckBox`、`formatDateCN`、`headerUrl`。
- 但样本脚本通常没有显式 `set()` 导出这些符号。

执行建议：

- 在当前实验室先按样本默认行为处理。
- 只有运行时报缺失，再补 `set()`。

### “多页报表应返回 `{page1, page2}`”

当前样本里不是主流事实。

当前主流现实写法是：

- 返回单个对象
- 返回对象数组
- 返回 `formJs` 再由模板控制多页

## 3. 仍然可信的旧经验

这些经验当前样本仍然支持：

- `load('/tools.js')` 是常规开头。
- `get("labscareHelper")` 是常规入口。
- `helper.getProjectSamples(projectId)` / `helper.getProjectData(projectId)` 是主 API。
- `JSON.stringify` 后修复 `null` 键再 `JSON.parse` 是常见清洗动作。
- 模板图片看不到 `<data>` 绑定名，需要结合结果图和内置结构参考反推。
- `caseName`、`factorName`、`tempId` 这类系统字段常常需要你显式放进最终返回结构，尤其是你已经把原始 `sample` 压扁成新对象时。

## 4. 当前实验室的现实倾向

从当前样本看，这家实验室更像是：

- 以真实脚本家族为中心，而不是统一模板规范。
- 同类报告会复用一整套结构化骨架。
- 不同报告家族之间会并存多种签名、图片、日期处理方案。

因此未来写脚本时最稳的策略不是“统一重构”，而是：

- 先找最近邻结构家族。
- 再最小改动地跟随它。
