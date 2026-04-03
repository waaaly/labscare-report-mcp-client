# LabsCare 报表脚本测试指南

这份指南定义了如何测试和验证生成的 LabsCare 报表脚本是否正确。

## 目录

- 测试目标
- 测试数据源
- 测试指标
- 测试流程
- 差异分析
- 测试报告格式

## 1. 测试目标

测试的核心目标是确保生成的脚本能够：

1. **字段完整性**：输出包含模板占位符所需的所有字段
2. **字段正确性**：每个字段的值来源和类型正确
3. **结构正确性**：返回根结构符合模板期望（formJs / 单对象 / outputData[]）
4. **数据完整性**：循环数组包含所有预期的数据行
5. **类型正确性**：字段类型（文本、数组、对象）符合模板要求

## 2. 测试数据源

### 必需的测试材料

```
输入材料：
├── data.json              # 真实数据源（formJs + samplesJs）
├── 模板图片
├── 预期结果图片
└── 占位符说明
```

### data.json 结构要求

测试数据应包含以下结构：

```json
{
  "formJs": {
    "t_wtName": "测试有限公司",
    "t_htName": "...",
    ...
  },
  "samplesJs": [
    {
      "sampleId": "...",
      "caseName": "...",
      "tempId": "...",
      "gaugingTableList": [
        {
          "factorName": "...",
          "gaugingTemplateName": "...",
          "t_version": "...",
          ...
        }
      ],
      ...
    }
  ]
}
```
对于data.json 顶层两个字段的阶段：
- formJs：为流程数据，有时候也会写为，formjs,form
- samplesJs：为样品数组数据，有时候也会写为：samples, sampleJs，sampleJs

## 3. 测试指标

### 准确率指标

基于模板占位符定义的准确率指标：

| 指标 | 说明 | 计算方式 |
|------|------|----------|
| 字段完整率 | 模板所需字段是否全部输出 | `(实际输出字段数 / 模板要求字段数) * 100%` |
| 字段准确率 | 输出字段中正确的比例 | `(正确字段数 / 实际输出字段数) * 100%` |
| 数据行完整率 | 循环数据是否包含所有行 | `(实际行数 / 预期行数) * 100%` |
| 类型准确率 | 字段类型正确的比例 | `(类型正确字段数 / 总字段数) * 100%` |

### 综合准确率

```
综合准确率 = (字段完整率 * 0.3) + (字段准确率 * 0.4) + (数据行完整率 * 0.2) + (类型准确率 * 0.1)
```

## 4. 测试流程

### 4.1 占位符提取

从模板图片和占位符说明中提取所有必需字段：

```
必需字段列表：
- 页头字段：t_wtName, t_htName, t_baogaoDay, ...
- 循环字段：factorName, methodName, t_TestMan, ...
- 签名字段：t_TestMan[], t_shuMan[], ...
- 关联字段：t_glQX, t_qx, ...
```

### 4.2 脚本执行

在模拟环境中执行生成的脚本：

```javascript
// 测试执行器伪代码
function testScript(script, testData) {
  // 1. 注入测试环境
  const env = createTestEnvironment(testData);

  // 2. 执行脚本
  const result = executeScript(script, env);

  // 3. 验证输出
  const validation = validateOutput(result);

  return {
    output: result,
    validation: validation,
    passed: validation.accuracy >= 0.95
  };
}
```

### 4.3 输出验证

验证脚本输出是否符合要求：

```javascript
function validateOutput(output, requiredFields) {
  const actualFields = extractFields(output);
  const missingFields = requiredFields.filter(f => !actualFields.includes(f));
  const extraFields = actualFields.filter(f => !requiredFields.includes(f));

  return {
    requiredFields: requiredFields,
    actualFields: actualFields,
    missingFields: missingFields,
    extraFields: extraFields,
    fieldCompleteness: (requiredFields.length - missingFields.length) / requiredFields.length,
    fieldAccuracy: (requiredFields.length - missingFields.length) / actualFields.length
  };
}
```

## 5. 差异分析

### 5.1 缺失字段分析

对于每个缺失字段，分析可能的原因：

| 缺失字段类型 | 可能原因 | 修复建议 |
|-------------|----------|----------|
| 页头字段 | 未从 form 取值、字段名错误 | 检查 `formJs` 映射 |
| 样品字段 | 未从 sample 取值、过滤过严 | 检查样品过滤逻辑 |
| 检测项字段 | 未从 gauging 取值、字段名错误 | 检查 gauging 映射 |
| 签名字段 | 未保留数组结构、路径错误 | 检查签名数组处理 |
| 关联字段 | 未深入关联对象取值 | 检查 fkCases/caseList 路径 |

### 5.2 类型错误分析

| 期望类型 | 实际类型 | 可能原因 |
|----------|----------|----------|
| 数组 | 字符串 | 过度扁平化、未保留原结构 |
| 对象 | 字符串 | 取了 .val 但模板需要完整对象 |
| 字符串 | 对象 | 未取 .val 或需要显示的字段 |

### 5.3 数据行缺失分析

| 现象 | 可能原因 | 修复建议 |
|------|----------|----------|
| 所有样品缺失 | 过滤条件过严 | 检查 tempId、gaugingTemplateName 等过滤条件 |
| 部分样品缺失 | 条件判断错误 | 检查 if 条件逻辑 |
| 部分检测项缺失 | gauging 过滤错误 | 检查 gaugingTableList 过滤逻辑 |
| 空行过多 | 过滤条件太宽松 | 检查是否需要额外的有效性过滤 |

## 6. 测试报告格式

### 标准测试报告

```markdown
# 脚本测试报告

## 测试概要
- 脚本名称：xxx
- 测试时间：YYYY-MM-DD HH:mm:ss
- 测试数据：data.json (N 条样品，M 条检测项)

## 准确率指标
- 字段完整率：85% (17/20 字段)
- 字段准确率：89% (17/19 字段)
- 数据行完整率：100% (6/6 行)
- 类型准确率：95% (18/19 字段)
- **综合准确率：91%**

## 测试结果
❌ 未通过 (目标准确率：≥95%)

## 缺失字段 (3)
1. `t_shuMan` - 签名字段
2. `t_qx` - 关联曲线数组
3. `t_dw` - 单位字段

## 类型错误 (1)
1. `t_clff` - 期望对象，实际字符串

## 数据行检查
- 样品数：6/6 ✓
- 检测项数：31/31 ✓

## 修复建议
1. 签名字段未保留数组结构，需要检查 `t_shuMan` 的取值路径
2. 关联曲线 `t_qx` 需要从 `t_glQX.fkCases[0].t_qx` 取值
3. 单位字段 `t_dw` 需要从 `t_qx.caseList[0].t_JZtab[0].t_dw` 取值
4. `t_clff` 需要保留完整对象 `{val, checked, ...}` 而非只取 `.val`
```

## 7. 测试触发条件

建议在以下情况自动触发测试：

1. **生成脚本后**：首次生成脚本时自动测试
2. **修复后**：每次修复后重新测试
3. **数据变更后**：测试数据更新时重新验证

## 8. 测试环境要求

### 模拟 API

需要模拟以下 LabsCare API：

```javascript
// 需要模拟的 API
const mockAPI = {
  getProjectData: (projectId) => testData.formJs,
  getProjectSamples: (projectId) => testData.samplesJs,
  getForm: (procedures) => procedures[processId]?.processes[templateId]?.form,
  getCheckBox: (checked) => checked ? '☑' : '☐',
  formatDateCN: (date) => { /* 格式化逻辑 */ },
  getSignUrl: (sign) => { /* 签名 URL 处理 */ },
  headerUrl: '/user/' // 签名 URL 前缀
};
```

### 全局函数

需要注入以下全局函数：

- `load()` - 加载工具库
- `get()` - 获取 helper
- `set()` - 设置导出函数
- `JSON.parse()` / `JSON.stringify()` - 标准库函数

## 9. 常见问题

### Q: 测试通过但实际运行失败？

**A**: 可能原因：
- 测试数据与真实数据结构不完全一致
- 模拟 API 与真实 API 行为差异
- 环境变量或全局对象缺失

**解决方案**：
- 确保测试数据覆盖所有分支
- 使用真实导出的 JSON 作为测试数据
- 验证模拟 API 的行为与真实 API 一致

### Q: 测试通过但模板渲染异常？

**A**: 可能原因：
- 字段类型正确但模板期望不同的子结构
- 数组索引错误（例如需要 [0] 但没有取）
- 字段存在但为空/null，模板未处理空值

**解决方案**：
- 检查模板内联 JS 期望的数据结构
- 验证数组访问路径
- 添加空值处理逻辑

### Q: 测试报告显示字段完整但实际缺少？

**A**: 可能原因：
- 字段名称拼写错误（大小写、下划线）
- 字段嵌套层级错误
- 返回根结构不正确

**解决方案**：
- 严格按模板占位符原样记录字段名
- 验证字段路径是否正确
- 确认返回根是 `formJs`、单对象还是 `outputData[]`
