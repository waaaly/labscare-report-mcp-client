/**
 * LabsCare 报表脚本自动修复工具
 *
 * 用途：根据测试报告自动修复生成的脚本
 *
 * 使用方法：
 *   const fixer = new ScriptAutoFixer(testData, requiredFields);
 *   const result = fixer.fix(scriptContent);
 */

class ScriptAutoFixer {
  constructor(testData, requiredFields, options = {}) {
    this.testData = testData;
    this.requiredFields = requiredFields || [];
    this.options = {
      targetAccuracy: 0.95,
      maxFixAttempts: 3,
      ...options
    };
    this.fixHistory = [];
  }

  /**
   * 自动修复脚本
   * @param {string} script - 原始脚本内容
   * @returns {object} 修复结果
   */
  async fix(script) {
    let currentScript = script;
    let attempt = 0;
    let lastAccuracy = 0;
    let bestScript = script;
    let bestAccuracy = 0;

    const ScriptTester = this.loadScriptTester();
    const tester = new ScriptTester(this.testData, this.requiredFields, this.options);

    // 初始测试
    const initialResult = tester.test(script);
    if (!initialResult.success) {
      return {
        success: false,
        error: initialResult.error,
        attempts: 0
      };
    }

    lastAccuracy = initialResult.accuracy.overall;
    bestAccuracy = lastAccuracy;

    // 修复循环
    while (attempt < this.options.maxFixAttempts) {
      attempt++;

      // 测试当前脚本
      const testResult = tester.test(currentScript);
      if (!testResult.success) {
        this.recordFix(attempt, 'error', '脚本执行失败', lastAccuracy, 0);
        break;
      }

      const currentAccuracy = testResult.accuracy.overall;

      // 检查是否达到目标
      if (currentAccuracy >= this.options.targetAccuracy) {
        this.recordFix(attempt, 'success', '达到目标准确率', lastAccuracy, currentAccuracy);
        return {
          success: true,
          script: currentScript,
          accuracy: currentAccuracy,
          attempts: attempt,
          history: this.fixHistory
        };
      }

      // 记录最佳版本
      if (currentAccuracy > bestAccuracy) {
        bestAccuracy = currentAccuracy;
        bestScript = currentScript;
      }

      // 检查是否有改善
      if (Math.abs(currentAccuracy - lastAccuracy) < 0.01) {
        this.recordFix(attempt, 'stalled', '准确率无明显改善', lastAccuracy, currentAccuracy);
        break;
      }

      // 生成修复
      const fixes = this.generateFixes(testResult, currentScript);
      if (fixes.length === 0) {
        this.recordFix(attempt, 'no_fix', '无法生成更多修复', lastAccuracy, currentAccuracy);
        break;
      }

      // 应用修复
      const fixedScript = this.applyFixes(currentScript, fixes);

      // 验证修复后没有降低准确率
      const verifyResult = tester.test(fixedScript);
      if (verifyResult.success && verifyResult.accuracy.overall >= currentAccuracy) {
        currentScript = fixedScript;
        lastAccuracy = verifyResult.accuracy.overall;
        this.recordFix(attempt, 'applied', `应用了 ${fixes.length} 个修复`, currentAccuracy, lastAccuracy);
      } else {
        this.recordFix(attempt, 'reverted', '修复导致准确率下降，已回滚', currentAccuracy, currentAccuracy);
        break;
      }
    }

    // 返回最佳结果
    return {
      success: bestAccuracy >= this.options.targetAccuracy,
      script: bestScript,
      accuracy: bestAccuracy,
      attempts: attempt,
      history: this.fixHistory,
      message: bestAccuracy >= this.options.targetAccuracy
        ? '修复成功'
        : `达到最大修复次数，最佳准确率 ${(bestAccuracy * 100).toFixed(0)}%`
    };
  }

  /**
   * 加载测试工具
   * @returns {class} ScriptTester 类
   */
  loadScriptTester() {
    // 在实际使用中，需要导入 ScriptTester
    // 这里假设已经在同一个环境中加载
    return typeof ScriptTester !== 'undefined' ? ScriptTester : null;
  }

  /**
   * 生成修复方案
   * @param {object} testResult - 测试结果
   * @param {string} script - 当前脚本
   * @returns {object[]} 修复方案数组
   */
  generateFixes(testResult, script) {
    const fixes = [];
    const { validation, output } = testResult;

    // 1. 修复缺失字段
    validation.missingFields.forEach(field => {
      const fix = this.generateFieldFix(field, script, output);
      if (fix) fixes.push(fix);
    });

    // 2. 修复类型错误
    validation.typeErrors.forEach(error => {
      const fix = this.generateTypeFix(error, script);
      if (fix) fixes.push(fix);
    });

    // 3. 修复数据行问题
    if (!validation.rowValidation.passed) {
      const fix = this.generateRowFix(script, validation.rowValidation);
      if (fix) fixes.push(fix);
    }

    return fixes;
  }

  /**
   * 生成字段修复方案
   * @param {string} field - 缺失字段名
   * @param {string} script - 当前脚本
   * @param {any} output - 当前输出
   * @returns {object|null} 修复方案
   */
  generateFieldFix(field, script, output) {
    const name = field.split('.').pop();

    // 页头字段
    if (['t_wtName', 't_htName', 't_baogaoDay', 't_baogaoNo', 't_baogaoType'].includes(name)) {
      return {
        type: 'add_field',
        field: field,
        source: 'form',
        action: 'add_form_field',
        description: `从 form/formJs 中添加页头字段 ${field}`,
        pattern: this.generateFormFieldPattern(field, name)
      };
    }

    // 签名字段
    if (['t_TestMan', 't_shuMan', 't_checkMan', 't_ratifyMan'].includes(name)) {
      return {
        type: 'fix_array',
        field: field,
        source: 'gauging',
        action: 'preserve_array_structure',
        description: `保留 ${field} 的数组结构，不要扁平化`,
        pattern: this.generateArrayFieldPattern(field, name)
      };
    }

    // 样品字段
    if (['caseName', 'sampleId', 'tempId', 't_sampleMan', 't_name', 't_sampMark'].includes(name)) {
      return {
        type: 'add_field',
        field: field,
        source: 'sample',
        action: 'add_sample_field',
        description: `从 sample 中添加样品字段 ${field}`,
        pattern: this.generateSampleFieldPattern(field, name)
      };
    }

    // 检测项字段
    if (['factorName', 'methodName', 'methodNo', 't_TestDate', 't_checkDate'].includes(name)) {
      return {
        type: 'add_field',
        field: field,
        source: 'gauging',
        action: 'add_gauging_field',
        description: `从 gauging 中添加检测项字段 ${field}`,
        pattern: this.generateGaugingFieldPattern(field, name)
      };
    }

    // 关联曲线字段
    if (['t_qx', 't_glQX', 't_dw', 't_nbdw'].includes(name)) {
      return {
        type: 'add_field',
        field: field,
        source: 'relation',
        action: 'add_relation_field',
        description: `从关联对象中添加字段 ${field}`,
        pattern: this.generateRelationFieldPattern(field, name)
      };
    }

    // 通用修复
    return {
      type: 'add_field',
      field: field,
      source: 'unknown',
      action: 'add_generic_field',
      description: `添加字段 ${field}，需要确定数据源`,
      pattern: this.generateGenericFieldPattern(field, name)
    };
  }

  /**
   * 生成类型错误修复方案
   * @param {object} error - 类型错误
   * @param {string} script - 当前脚本
   * @returns {object|null} 修复方案
   */
  generateTypeFix(error, script) {
    const field = error.field;
    const name = field.split('.').pop();

    // 检查是否是数组被扁平化
    if (['t_TestMan', 't_shuMan', 't_checkMan', 't_ratifyMan'].includes(name)) {
      return {
        type: 'fix_type',
        field: field,
        expectedType: error.expectedType,
        actualType: error.actualType,
        action: 'restore_array_structure',
        description: `${field} 被过度扁平化，需要恢复数组结构`,
        pattern: this.restoreArrayPattern(field, name)
      };
    }

    // 检查是否是对象被过度简化
    if (['t_clff', 't_judgeBQDD'].includes(name)) {
      return {
        type: 'fix_type',
        field: field,
        expectedType: error.expectedType,
        actualType: error.actualType,
        action: 'restore_object_structure',
        description: `${field} 被过度简化，需要保留完整对象`,
        pattern: this.restoreObjectPattern(field, name)
      };
    }

    return null;
  }

  /**
   * 生成数据行修复方案
   * @param {string} script - 当前脚本
   * @param {object} rowValidation - 行验证结果
   * @returns {object|null} 修复方案
   */
  generateRowFix(script, rowValidation) {
    if (rowValidation.rowCount === 0) {
      return {
        type: 'fix_rows',
        action: 'check_filter_conditions',
        description: '数据行为空，检查过滤条件是否过严',
        pattern: this.checkFilterPattern()
      };
    }

    if (rowValidation.rowCount < rowValidation.expectedRowCount) {
      return {
        type: 'fix_rows',
        action: 'relax_filter_conditions',
        description: `数据行不足 (${rowValidation.rowCount}/${rowValidation.expectedRowCount})，检查过滤条件`,
        pattern: this.relaxFilterPattern()
      };
    }

    return null;
  }

  /**
   * 应用修复方案
   * @param {string} script - 当前脚本
   * @param {object[]} fixes - 修复方案数组
   * @returns {string} 修复后的脚本
   */
  applyFixes(script, fixes) {
    let fixedScript = script;

    // 按优先级排序修复
    const sortedFixes = this.prioritizeFixes(fixes);

    for (const fix of sortedFixes) {
      fixedScript = this.applySingleFix(fixedScript, fix);
    }

    return fixedScript;
  }

  /**
   * 优先级排序
   * @param {object[]} fixes - 修复方案数组
   * @returns {object[]} 排序后的修复方案
   */
  prioritizeFixes(fixes) {
    const priority = {
      'fix_rows': 1,
      'fix_type': 2,
      'add_field': 3
    };

    return fixes.sort((a, b) => {
      return (priority[a.type] || 99) - (priority[b.type] || 99);
    });
  }

  /**
   * 应用单个修复
   * @param {string} script - 当前脚本
   * @param {object} fix - 修复方案
   * @returns {string} 修复后的脚本
   */
  applySingleFix(script, fix) {
    switch (fix.action) {
      case 'add_form_field':
        return this.addFormField(script, fix);
      case 'preserve_array_structure':
        return this.preserveArrayStructure(script, fix);
      case 'add_sample_field':
        return this.addSampleField(script, fix);
      case 'add_gauging_field':
        return this.addGaugingField(script, fix);
      case 'add_relation_field':
        return this.addRelationField(script, fix);
      case 'restore_array_structure':
        return this.restoreArrayStructure(script, fix);
      case 'restore_object_structure':
        return this.restoreObjectStructure(script, fix);
      case 'check_filter_conditions':
        return this.checkFilterConditions(script, fix);
      default:
        return script;
    }
  }

  /**
   * 添加表单字段
   */
  addFormField(script, fix) {
    const fieldName = fix.field;
    const shortName = fix.field.split('.').pop();

    // 检查是否已有 form 变量
    if (script.includes('var form =')) {
      // 在 output 对象中添加字段
      const pattern = /(\{[\s\S]*?)(\})\s*$/m;
      return script.replace(pattern, `$1,\n  ${fieldName}: form.${shortName}$2`);
    }

    return script;
  }

  /**
   * 保留数组结构
   */
  preserveArrayStructure(script, fix) {
    const fieldName = fix.field;
    const shortName = fix.field.split('.').pop();

    // 查找可能的扁平化代码
    const flattenPattern = new RegExp(`${fieldName}\\s*=\\s*(\\w+)\\[0\\]\\.val`, 'g');
    if (flattenPattern.test(script)) {
      return script.replace(flattenPattern, `${fieldName} = $1`);
    }

    return script;
  }

  /**
   * 添加样品字段
   */
  addSampleField(script, fix) {
    const fieldName = fix.field;
    const shortName = fix.field.split('.').pop();

    // 在 sample 映射中添加字段
    const mapPattern = /(samples|samplesJs)\.map\(\s*(\w+)\s*=>\s*\(\{([\s\S]*?)\}\)\)/;
    const match = script.match(mapPattern);

    if (match) {
      const fullMatch = match[0];
      const sampleVar = match[2];
      const existingFields = match[3];

      // 检查字段是否已存在
      if (!existingFields.includes(shortName)) {
        const newFields = existingFields.trim()
          ? `${existingFields},\n    ${fieldName}: ${sampleVar}.${shortName}`
          : `${fieldName}: ${sampleVar}.${shortName}`;

        const newMap = fullMatch.replace(existingFields, newFields);
        return script.replace(fullMatch, newMap);
      }
    }

    return script;
  }

  /**
   * 添加检测项字段
   */
  addGaugingField(script, fix) {
    const fieldName = fix.field;
    const shortName = fix.field.split('.').pop();

    // 查找 gaugingData 定义
    const gaugingDataPattern = /var gaugingData\s*=\s*\{([\s\S]*?)\};/;
    const match = script.match(gaugingDataPattern);

    if (match) {
      const existingFields = match[1];

      // 检查字段是否已存在
      if (!existingFields.includes(shortName)) {
        const newFields = existingFields.trim()
          ? `${existingFields},\n  ${fieldName}: g.${shortName}`
          : `${fieldName}: g.${shortName}`;

        const newGaugingData = `var gaugingData = {\n${newFields}\n};`;
        return script.replace(gaugingDataPattern, newGaugingData);
      }
    }

    return script;
  }

  /**
   * 添加关联字段
   */
  addRelationField(script, fix) {
    const fieldName = fix.field;
    const shortName = fix.field.split('.').pop();

    // 针对不同的关联字段使用不同的路径
    if (shortName === 't_qx') {
      // 检查是否已有 t_glQX 的处理
      if (script.includes('t_glQX')) {
        const glqxPattern = /var\s+\w+\s*=\s*(\w+)\.t_glQX/;
        const match = script.match(glqxPattern);

        if (match) {
          const gaugingVar = match[1];
          // 添加 t_qx 的提取
          const fkFirstPattern = /var\s+fkFirst\s*=\s*(\w+);?/;
          const fkFirstMatch = script.match(fkFirstPattern);

          if (fkFirstMatch) {
            // 已有 fkFirst，添加 t_qx
            const addTqxPattern = /var\s+fkFirst\s*=\s*(\w+);?/;
            return script.replace(
              addTqxPattern,
              `$0\nvar t_qx = fkFirst.t_qx;`
            );
          } else {
            // 创建新的 fkFirst 和 t_qx
            return script.replace(
              glqxPattern,
              `$0\nvar fkFirst = ${gaugingVar}.t_glQX ? ${gaugingVar}.t_glQX.fkCases[0] : '';\nvar t_qx = fkFirst ? fkFirst.t_qx : '';`
            );
          }
        }
      }
    }

    // 对于深层字段（如 t_dw），需要更复杂的路径
    if (shortName === 't_dw' || shortName === 't_nbdw') {
      const path = shortName === 't_dw'
        ? 'gauging.t_qx.caseList[0].t_JZtab[0].t_dw'
        : 'gauging.t_qx.caseList[0].t_JZtab[0].t_nbdw';

      // 在 gaugingData 中添加
      const gaugingDataPattern = /var gaugingData\s*=\s*\{([\s\S]*?)\};/;
      const match = script.match(gaugingDataPattern);

      if (match) {
        const existingFields = match[1];
        if (!existingFields.includes(shortName)) {
          const newFields = existingFields.trim()
            ? `${existingFields},\n  ${fieldName}: ${path}`
            : `${fieldName}: ${path}`;

          const newGaugingData = `var gaugingData = {\n${newFields}\n};`;
          return script.replace(gaugingDataPattern, newGaugingData);
        }
      }
    }

    return script;
  }

  /**
   * 恢复数组结构
   */
  restoreArrayStructure(script, fix) {
    const fieldName = fix.field;
    const shortName = fix.field.split('.').pop();

    // 查找可能的源变量
    const sourceVarPattern = new RegExp(`(${shortName})\\s*=\\s*(\\w+)\\.(\\w+)\\[0\\]\\.val`);
    const match = script.match(sourceVarPattern);

    if (match) {
      const sourceVar = match[2];
      const sourceField = match[3];
      // 恢复为数组
      return script.replace(
        sourceVarPattern,
        `${fieldName} = ${sourceVar}.${sourceField}`
      );
    }

    return script;
  }

  /**
   * 恢复对象结构
   */
  restoreObjectStructure(script, fix) {
    const fieldName = fix.field;
    const shortName = fix.field.split('.').pop();

    // 查找可能的源变量
    const sourceVarPattern = new RegExp(`${fieldName}\\s*=\\s*(\\w+)\\.(\\w+)\\.val`);
    const match = script.match(sourceVarPattern);

    if (match) {
      const sourceVar = match[1];
      const sourceField = match[2];
      // 恢复为完整对象
      return script.replace(
        sourceVarPattern,
        `${fieldName} = ${sourceVar}.${sourceField}`
      );
    }

    return script;
  }

  /**
   * 检查过滤条件
   */
  checkFilterConditions(script, fix) {
    // 查找过滤条件
    const filterPattern = /\.filter\(\s*(\w+)\s*=>\s*\{?([\s\S]*?)\}?\s*\)/g;
    const matches = Array.from(script.matchAll(filterPattern));

    if (matches.length > 0) {
      // 在过滤前添加注释提示
      return script.replace(
        filterPattern,
        '.filter($1 => {\n  // 检查过滤条件是否过严\n  $2\n})'
      );
    }

    return script;
  }

  /**
   * 记录修复历史
   */
  recordFix(attempt, status, message, beforeAccuracy, afterAccuracy) {
    this.fixHistory.push({
      attempt,
      status,
      message,
      beforeAccuracy,
      afterAccuracy,
      timestamp: new Date().toISOString()
    });
  }

  // 生成各种模式的辅助方法
  generateFormFieldPattern(field, name) {
    return `// 添加页头字段\n${field}: form.${name}`;
  }

  generateArrayFieldPattern(field, name) {
    return `// 保留数组结构\n${field}: ${name}  // 不要取 [0].val`;
  }

  generateSampleFieldPattern(field, name) {
    return `// 添加样品字段\n${field}: ${name}`;
  }

  generateGaugingFieldPattern(field, name) {
    return `// 添加检测项字段\n${field}: g.${name}`;
  }

  generateRelationFieldPattern(field, name) {
    return `// 添加关联字段\n${field}: ${name}`;
  }

  generateGenericFieldPattern(field, name) {
    return `// 添加字段\n${field}: ${name}`;
  }

  restoreArrayPattern(field, name) {
    return `// 恢复数组结构\n${field} = source.${name}  // 而非 source.${name}[0].val`;
  }

  restoreObjectPattern(field, name) {
    return `// 恢复对象结构\n${field} = source.${name}  // 而非 source.${name}.val`;
  }

  checkFilterPattern() {
    return `// 检查过滤条件是否过严`;
  }

  relaxFilterPattern() {
    return `// 放宽过滤条件`;
  }
}

// 导出供 Node.js 使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScriptAutoFixer;
}
