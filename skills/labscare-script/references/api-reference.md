# 真实数据结构参考（内置快照）

这个文件总结的是一份真实导出 JSON 的关键数据形状，用来帮助你理解 LabsCare 常见输入结构。

## 目录

- `formJs` 的真实形状
- `samplesJs` 的真实形状
- `gaugingTableList` 的真实形状
- 常见字段类型
- 关联对象深入路径
- `t_version` 与数据覆盖范围
- `procedures` / `form` 取值风格

## 1. 文件定位与使用原则

- 原始来源是一份约 53 MB 的真实导出 JSON，不要整文件读进上下文。
- 只在需要确认字段形状时，按目标字段做定向抽查。
- 实际使用 skill 时，不要求用户手里一定有这份原始文件；用户只要提供任意一份真实同类 JSON，也能按同样方法分析。

当前快照里的顶层结构只有两个键：

```javascript
{
  formJs: {...},
  samplesJs: [...]
}
```

这也说明了一件事：

- 模板层脚本里常见的 `formJs`、`samplesJs`，并不是空想命名，而是有现实对应的数据形状。

## 2. `formJs` 的真实形状

当前快照里：

- `formJs` 键数约 321 个。
- 同时存在“可读标签名”和“纯数字组件 ID”。

真实字段类型至少包括：

### 普通文本

```javascript
t_wtName: "测试有限公司"
t_htName: "..."
t_baogaoDay: "2026-03-10"
```

### 下拉/单选对象

```javascript
t_judgeBQDD: {
  val: "...",
  isTitle: "...",
  checked: "...",
  id: "...",
  oldId: "..."
}
```

### 签名/图片数组

```javascript
t_ratifyMan: [
  {
    val: "/user/.../sign.png",
    name: "...",
    id: "...",
    url: "/user/.../sign.png"
  }
]
```

### 关联对象

```javascript
关联仪器: {
  val: "F-77—电子天平",
  fkCaseIds: "...",
  fkCases: [...],
  caseList: [...]
}
```

### 数字组件 ID 字段

```javascript
"3156134978269966916": ""
"3155886868086342054": []
```

结论：

- 模板字段不一定都有语义化标签。
- 当样本 JS 里出现一串数字 key，不要自动认为是脏数据，它很可能就是未配置标签的真实组件 ID。

## 3. `samplesJs` 的真实形状

当前快照里：

- `samplesJs.length === 6`
- 每个样品当前快照大约有 121 个键。
- 每个样品都带 `gaugingTableList`，当前快照里每个样品有 31 条检测项目。

样品上反复出现的关键字段：

- `caseName`
- `tempId`
- `processId`
- `gaugingTableList`
- `t_sampleMan`
- `t_sampleManTwo`
- `t_sampleManThree`
- `t_sampleManFour`
- `t_shr`
- `t_wenduWD`
- `t_shiduSD`
- `t_changSuo`
- `t_name`
- `t_sampMark`

还会混入大量：

- 纯数字组件 ID
- `xxx_pinyinArray` 辅助字段

所以写脚本时：

- 先抓“当前模板真正用到的少数字段”。
- 不要试图把整个样品对象完全抽象化。

## 4. `gaugingTableList` 的真实形状

当前快照里：

- 总检测项目数约 186 条。
- 唯一 `gaugingTemplateName` 至少 21 种。
- 检测项目对象键数远多于样品，当前快照统计到 700+ 不同键。

几乎每条检测项目上都会出现的核心字段：

- `factorName`
- `gaugingTemplateName`
- `t_version`
- `methodName`
- `methodNo`
- `t_nameYQ`
- `t_typeYQ`
- `t_numberYQ`
- `t_TestMan`
- `t_TestManTwo`
- `t_checkMan`
- `t_TestDate`
- `t_checkDate`
- `t_mark`

还要注意：

- 同一语义字段可能同时存在中文别名和 `t_` 标签名，例如 `分析人1` / `t_TestMan`、`校核人` / `t_checkMan`。
- 说明这个实验室数据里既有标签字段，也保留了中文语义字段。

## 5. 当前快照已证实的值类型

### 签名数组

```javascript
t_TestMan: [
  {
    val: "/user/2013835364173471452/sign.png",
    name: "LabsCarexd",
    id: "2013835364173471452",
    url: "/user/2013835364173471452/sign.png"
  }
]
```

可见：

- 模板里直接写 `headerUrl + t_TestMan[0].val` 是合理的。
- 脚本里若要预计算图片 URL，也可以从这个结构出发。

### 单选 / 下拉对象

```javascript
t_clff: {
  val: "...",
  isTitle: "...",
  componentId: "...",
  checked: "...",
  id: "...",
  oldId: "..."
}
```

可见：

- `.val` 是最常用的展示值。
- 但如果模板内联 JS 还要看 `checked` 或整个对象，不要过早扁平化。

### 关联记录对象

```javascript
t_glQX: {
  val: "原子吸收光谱测定水样中元素分析原始记录表（2-2）",
  fkCaseIds: "...",
  fkCases: [...],
  caseList: [...]
}
```

```javascript
t_qx: {
  val: "电感耦合等离子体质谱法分析原始记录表",
  fkCaseIds: "...",
  fkCases: [...],
  caseList: [...]
}
```

可见：

- 这类字段不是普通下拉。
- 样本脚本之所以会写 `fkCases[0]`、`caseList[0]`，是因为数据本体就真在里面。

## 6. 关联对象的典型深入路径

### 原子吸收：`t_glQX.fkCases[0].t_qx`

样本 `原子吸收光谱测定水样中元素分析原始记录表` 使用：

```javascript
var fkFirst = GaugingFirstData.t_glQX ? GaugingFirstData.t_glQX.fkCases[0] : ''
var t_qx = fkFirst.t_qx
```

说明：

- `t_glQX` 指向的是另一份关联档案。
- 真正需要的曲线数组 `t_qx` 在 `fkCases[0]` 里面。

### 电感耦合：`t_qx.caseList[0].t_JZtab[0]`

样本 `电感耦合等离子体质谱法分析原始记录表` 使用：

```javascript
gauging.t_qx.caseList[0].t_JZtab[0].t_dw
gauging.t_qx.caseList[0].t_JZtab[0].t_nbdw
```

说明：

- `t_qx` 是直接挂在检测项目对象上的关联曲线对象。
- 真正有单位信息的是 `caseList[0].t_JZtab[0]`。

### 关联仪器：`关联仪器.fkCases[0]`

快照中明确能看到：

- `t_numYQ`
- `t_modeXH`
- `t_manufactor`

都在关联仪器记录里。

所以如果模板要“仪器名称 + 型号 + 编号”，不一定都在当前 `gauging` 顶层；有时要进关联仪器里再取。

## 7. 关于 `t_version` 与样本文件夹的关系

要特别小心这个误区：

- 当前大 JSON 只覆盖这一个实验室、这一批数据。
- 它并不保证覆盖内置参考里提到的每一份报告家族。

例如当前快照里：

- 能直接看到 `062`、`146`、`131` 等模板族。
- 但 `099` / `X-γ` 样本脚本里使用的 `t_version === '024'`、`t_version === '005'`，当前快照并没有直接命中。

结论：

- 大 JSON 只能用来理解“数据长什么样”。
- 不能拿它去否定某个样本脚本的过滤条件。
- 当 JSON 与更强的模板图 / 结果图 / 同类历史参考冲突时，优先信后者。

## 8. `procedures` / `form` 的取值风格

当前样本已证实至少有三种写法：

```javascript
var procedure = procedures.get(processId);
var form = procedure.get('processes').get(templateld).get('form');
```

```javascript
var procedure = procedures[processId];
var form = procedure.processes[templateld].form;
```

```javascript
var form = getForm(procedures);
```

执行建议：

- 同一个脚本里尽量只用一种风格。
- 首选与最接近的已知参考保持一致，而不是强行统一成 `.get()` 或 `[]`。

## 9. 在这个 JSON 上做定向排查的建议

遇到这些问题时优先查 JSON：

- 想知道签名字段到底是数组还是对象。
- 想知道某个下拉是不是 `{val, checked}`。
- 想知道某个 `t_` 字段到底在 `sample`、`gauging` 还是关联对象里。
- 想确认 `fkCases` / `caseList` 的嵌套深度。

如果只是想知道“当前有哪些报告家族、脚本返回什么结构”，先看 `examples.md` 和 `patterns.md`，不要直接啃 53 MB JSON。
