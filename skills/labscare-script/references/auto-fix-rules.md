# LabsCare 报表脚本自动修复规则

这份规则定义了如何根据测试报告自动修复生成的脚本。

## 目录

- 修复优先级
- 字段缺失修复
- 类型错误修复
- 数据行缺失修复
- 修复验证
- 修复限制

## 1. 修复优先级

按严重程度和修复难度排序的修复顺序：

```
修复优先级：
1. 返回根结构错误（阻塞性问题）
2. 主过滤条件错误（导致数据为空）
3. 字段类型错误（影响渲染）
4. 关键字段缺失（核心字段）
5. 次要字段缺失（可选字段）
6. 数据排序问题（不影响功能）
```

## 2. 字段缺失修复

### 2.1 页头字段缺失

**症状**：模板中的页头字段（如 `t_wtName`, `t_htName`）未在输出中找到

**修复策略**：

```javascript
// 原脚本可能的问题
var outputData = samples.map(s => ({
  t_name: s.t_name,
  // 缺少 t_wtName, t_htName
}));

// 修复：从 formJs 补充
var form = getForm(procedures);
outputData = samples.map(s => ({
  ...form,  // 或显式补充所需字段
  t_wtName: form.t_wtName,
  t_htName: form.t_htName,
  t_name: s.t_name
}));
```

**判断依据**：
- 字段名以 `t_` 开头
- 字段是报告头信息（单位、报告号、日期等）
- 字段值对所有输出项相同

### 2.2 样品字段缺失

**症状**：样品相关字段（如 `caseName`, `sampleId`）缺失

**修复策略**：

```javascript
// 原脚本可能的问题
var outputData = samples.map(s => ({
  // 缺少 sampleId, caseName
  gaugingList: s.gaugingTableList
}));

// 修复：补充样品字段
var outputData = samples.map(s => ({
  sampleId: s.sampleId,
  caseName: s.caseName,
  gaugingList: s.gaugingTableList
}));
```

**判断依据**：
- 字段名包含 sample、case、样品等关键词
- 字段值与样品相关
- 在输出根级别或每个样品对象中

### 2.3 检测项字段缺失

**症状**：`gaugingTableList` 中的字段缺失

**修复策略**：

```javascript
// 原脚本可能的问题
gaugingData = {
  factorName: g.factorName,
  // 缺少 methodName, t_TestMan
};

// 修复：补充检测项字段
gaugingData = {
  factorName: g.factorName,
  methodName: g.methodName,
  methodNo: g.methodNo,
  t_TestMan: g.t_TestMan,
  t_TestDate: g.t_TestDate
};
```

**判断依据**：
- 字段在 gauging 对象上
- 字段与检测项目相关（方法、检测人、日期等）
- 需要映射到 `gaugingData()` 或行对象

### 2.4 签名字段缺失

**症状**：签名数组未输出或输出为字符串

**修复策略**：

```javascript
// 原脚本可能的问题（过度扁平化）
output.t_TestMan = gauging.t_TestMan[0].val;

// 修复：保留完整数组结构
output.t_TestMan = gauging.t_TestMan;
```

**判断依据**：
- 字段名包含 Man、Sign、签名等
- 模板中使用 `headerUrl + t_xxx[0].val`
- 数据源是数组类型

### 2.5 关联对象字段缺失

**症状**：需要从关联对象深入取值的字段缺失

**修复策略**：

```javascript
// 原脚本可能的问题
var newData = {
  // 缺少 t_qx 字段
};

// 修复：深入关联对象取值
var fkFirst = GaugingFirstData.t_glQX ? GaugingFirstData.t_glQX.fkCases[0] : '';
var t_qx = fkFirst ? fkFirst.t_qx : '';
newData.t_qx = t_qx;

// 或深入多层
newData.t_dw = gauging.t_qx ? gauging.t_qx.caseList[0].t_JZtab[0].t_dw : '';
```

**判断依据**：
- 字段在测试数据中需要多层访问
- 字段名前有 `t_gl`、`t_qx` 等关联标识
- 需要通过 `fkCases`、`caseList` 等路径访问

## 3. 类型错误修复

### 3.1 数组被扁平化

**症状**：模板期望数组（如 `t_TestMan[0].val`），但实际是字符串

**修复策略**：

```javascript
// 错误：过度扁平化
output.t_TestMan = t_TestMan[0].val;

// 修复：保留原数组
output.t_TestMan = t_TestMan;
```

**判断依据**：
- 模板中使用 `[0]` 索引访问
- 模板中使用 `.join()` 等数组方法
- 原始数据中是数组类型

### 3.2 对象被过度简化

**症状**：模板期望对象（如 `t_clff.val`），但实际是字符串

**修复策略**：

```javascript
// 错误：只取了 .val
output.t_clff = gauging.t_clff.val;

// 修复：保留完整对象
output.t_clff = gauging.t_clff;
```

**判断依据**：
- 模板中访问对象的子属性（`.val`, `.checked`）
- 模板内联 JS 需要完整对象
- 原始数据中是对象类型且有多个属性

### 3.3 字符串被过度复杂化

**症状**：模板期望简单字符串，但实际是复杂对象

**修复策略**：

```javascript
// 错误：保留了完整对象
output.t_name = gauging.t_name; // 实际是对象

// 修复：取实际需要的值
output.t_name = gauging.t_name.val || gauging.t_name;
```

**判断依据**：
- 模板中直接使用字段名，无子属性访问
- 模板期望的是显示文本
- 原始数据可能是对象但实际只需显示值

## 4. 数据行缺失修复

### 4.1 过滤条件过严

**症状**：所有或大部分样品/检测项被过滤掉

**修复策略**：

```javascript
// 错误：过滤条件过严
var filtered = samples.filter(s =>
  s.tempId === '1143311212931801601' &&  // 特定 ID 过严
  s.caseName === '特定名称'  // 额外条件
);

// 修复：使用正确的业务过滤条件
var filtered = samples.filter(s =>
  s.tempId === '正确的模板ID' ||  // 使用模板名或其他业务条件
  s.gaugingTableList.some(g => g.gaugingTemplateName === '目标模板')
);
```

**判断依据**：
- 测试数据中有多个样品但输出为空或极少
- 过滤条件使用了硬编码的测试 ID
- 过滤条件与模板类型不匹配

### 4.2 gauging 过滤错误

**症状**：检测项列表为空或缺少部分项目

**修复策略**：

```javascript
// 错误：gauging 过滤错误
var gaugingList = sample.gaugingTableList.filter(g =>
  g.gaugingTemplateName === '错误的模板名' ||
  g.t_version !== '正确的版本'
);

// 修复：使用正确的过滤条件
var gaugingList = sample.gaugingTableList.filter(g =>
  g.gaugingTemplateName === '正确的模板名' &&
  (!版本过滤 || g.t_version === '正确的版本')
);
```

**判断依据**：
- 测试数据中有检测项但输出为空
- 模板名拼写错误
- 版本过滤与数据不匹配

### 4.3 循环构建错误

**症状**：有数据但没有正确组装到循环数组

**修复策略**：

```javascript
// 错误：没有正确组装循环数组
var outputData = {};
samples.forEach(s => {
  // 没有构建数组
});

// 修复：正确构建 outputData 数组
var outputData = [];
samples.forEach(s => {
  outputData.push({
    sampleId: s.sampleId,
    gaugingList: s.gaugingTableList
  });
});
```

**判断依据**：
- 输出根不是数组但模板期望循环
- 输出根是对象但数据在错误的属性下
- 返回了 `formJs` 但模板期望 `outputData[]`

## 5. 修复验证

### 5.1 修复后必须验证

每次修复后必须重新运行测试：

```
修复循环：
1. 执行测试 → 生成测试报告
2. 分析差异 → 生成修复方案
3. 应用修复 → 更新脚本
4. 重新测试 → 验证修复效果
5. 如未通过 → 返回步骤 2
6. 如通过 → 完成修复
```

### 5.2 修复次数限制

防止无限修复循环：

```javascript
const MAX_FIX_ATTEMPTS = 3;
const TARGET_ACCURACY = 0.95;

function fixScript(script, testData, requiredFields, attempt = 0) {
  if (attempt >= MAX_FIX_ATTEMPTS) {
    return {
      success: false,
      reason: `达到最大修复次数 ${MAX_FIX_ATTEMPTS}，建议人工介入`
    };
  }

  const testResult = testScript(script, testData, requiredFields);

  if (testResult.passed) {
    return { success: true, script: script };
  }

  const fixes = generateFixes(testResult);
  const fixedScript = applyFixes(script, fixes);

  return fixScript(fixedScript, testData, requiredFields, attempt + 1);
}
```

### 5.3 回滚机制

如果修复后准确率下降，需要回滚：

```javascript
function applyFixWithRollback(script, fix) {
  const oldScript = script;
  const newScript = fix(script);
  const newResult = testScript(newScript);

  if (newResult.accuracy < oldResult.accuracy) {
    console.warn('修复导致准确率下降，回滚修复');
    return oldScript;
  }

  return newScript;
}
```

## 6. 修复限制

### 6.1 需要人工介入的情况

以下情况建议人工介入而非自动修复：

1. **模板理解错误**：模板结构复杂，需要重新分析
2. **业务逻辑复杂**：涉及复杂的业务规则或条件判断
3. **数据结构不明确**：测试数据无法覆盖所有情况
4. **修复失败多次**：连续 3 次修复未达到目标
5. **测试数据不足**：测试数据与真实数据差异较大

### 6.2 不可自动修复的问题

| 问题类型 | 原因 | 解决方案 |
|----------|------|----------|
| 模板需要修改 | 脚本无法满足模板要求 | 建议修改模板或明确说明 |
| 数据源不匹配 | 测试数据与真实数据结构不同 | 使用真实数据更新测试 |
| 性能问题 | 脚本正确但性能不佳 | 人工优化算法 |
| 边界情况 | 测试数据未覆盖的边界条件 | 补充测试用例 |

### 6.3 修复安全原则

1. **最小修改原则**：只修改必要的部分，保持其他代码不变
2. **保留注释**：修复时保留原有的业务逻辑注释
3. **测试驱动**：每次修改都有明确的测试依据
4. **可回溯**：保留每次修复的版本，便于回滚

## 7. 修复模板

### 7.1 通用修复模板

```javascript
// 修复模板：从特定数据源补充字段
function addMissingFieldsFromSource(output, source, fields) {
  fields.forEach(field => {
    if (!output[field]) {
      output[field] = source[field];
    }
  });
  return output;
}

// 使用示例
output = addMissingFieldsFromSource(output, form, ['t_wtName', 't_htName']);
```

```javascript
// 修复模板：修复数组扁平化
function preserveArrayStructure(output, fieldName) {
  if (Array.isArray(output[fieldName]) &&
      fieldName in output &&
      typeof output[fieldName] === 'string') {
    // 已被扁平化，需要从原始数据重新获取
    console.warn(`字段 ${fieldName} 被意外扁平化`);
  }
}
```

```javascript
// 修复模板：修复对象过度简化
function preserveObjectStructure(output, fieldName) {
  if (typeof output[fieldName] === 'string' &&
      output[fieldName].includes('{')) {
    // 可能是 JSON 字符串，需要解析
    try {
      output[fieldName] = JSON.parse(output[fieldName]);
    } catch (e) {
      // 保持原样
    }
  }
}
```

## 8. 修复效果评估

### 8.1 修复成功率指标

```javascript
const fixMetrics = {
  totalAttempts: 0,
  successfulFixes: 0,
  failedFixes: 0,
  averageAttempts: 0,
  fieldsFixed: 0,
  accuracyImprovement: 0
};

function evaluateFixEffect(before, after) {
  fixMetrics.totalAttempts++;
  fixMetrics.accuracyImprovement += after.accuracy - before.accuracy;

  if (after.passed) {
    fixMetrics.successfulFixes++;
  } else {
    fixMetrics.failedFixes++;
  }

  fixMetrics.averageAttempts =
    fixMetrics.successfulFixes * 1 +
    fixMetrics.failedFixes * MAX_FIX_ATTEMPTS /
    fixMetrics.totalAttempts;
}
```

### 8.2 修复质量标准

| 质量指标 | 标准 | 说明 |
|----------|------|------|
| 修复成功率 | ≥ 80% | 达到目标准确率的修复比例 |
| 平均修复次数 | ≤ 2 次 | 大部分问题在 2 次内修复 |
| 准确率提升 | ≥ 10% | 每次修复的平均准确率提升 |
| 无副作用 | 100% | 修复不引入新的错误 |

## 9. 修复日志记录

### 9.1 修复日志格式

```javascript
function logFix(fixType, description, before, after) {
  return {
    timestamp: new Date().toISOString(),
    fixType: fixType,  // 'field_missing', 'type_error', 'data_missing'
    description: description,
    beforeAccuracy: before.accuracy,
    afterAccuracy: after.accuracy,
    fieldsAffected: before.missingFields.filter(f => !after.missingFields.includes(f)),
    scriptChanges: describeScriptChanges(before.script, after.script)
  };
}
```

### 9.2 修复历史追踪

```javascript
const fixHistory = [];

function recordFix(fixLog) {
  fixHistory.push(fixLog);

  // 分析修复模式
  const pattern = analyzeFixPatterns(fixHistory);

  // 学习常见修复策略
  const commonFixes = findCommonFixes(fixHistory);

  return { pattern, commonFixes };
}
```
