/**
 * LabsCare 报表脚本测试工具
 *
 * 用途：在模拟环境中测试生成的脚本是否正确
 *
 * 使用方法：
 *   const tester = new ScriptTester(testData, requiredFields);
 *   const result = tester.test(scriptContent);
 */

class ScriptTester {
  constructor(testData, requiredFields, options = {}) {
    this.testData = testData;
    this.requiredFields = requiredFields || [];
    this.options = {
      targetAccuracy: 0.95,
      maxFixAttempts: 3,
      ...options
    };
  }

  /**
   * 测试脚本
   * @param {string} script - 脚本内容
   * @returns {object} 测试结果
   */
  test(script) {
    try {
      // 1. 创建模拟环境
      const env = this.createMockEnvironment();

      // 2. 执行脚本
      const output = this.executeScript(script, env);

      // 3. 验证输出
      const validation = this.validateOutput(output);

      // 4. 计算准确率
      const accuracy = this.calculateAccuracy(validation);

      // 5. 生成测试报告
      const report = this.generateReport(script, output, validation, accuracy);

      return {
        success: true,
        output: output,
        validation: validation,
        accuracy: accuracy,
        passed: accuracy >= this.options.targetAccuracy,
        report: report
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * 创建模拟环境
   * @returns {object} 模拟环境对象
   */
  createMockEnvironment() {
    const self = this;

    return {
      // 模拟全局函数
      load: function(path) {
        if (path === '/tools.js') {
          return true; // 模拟加载成功
        }
        throw new Error(`Cannot load ${path}`);
      },

      get: function(name) {
        if (name === 'labscareHelper') {
          return {
            getProjectData: (projectId) => self.testData.formJs,
            getProjectSamples: (projectId) => self.testData.samplesJs
          };
        }
        return null;
      },

      set: function(name, value) {
        // 存储导出的函数
        if (!this.exports) this.exports = {};
        this.exports[name] = value;
      },

      // 模拟工具函数
      getCheckBox: function(checked) {
        return checked ? '☑' : '☐';
      },

      formatDateCN: function(date) {
        if (!date) return '';
        const d = new Date(date);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      },

      getSignUrl: function(sign) {
        if (!sign) return '';
        if (Array.isArray(sign) && sign.length > 0) {
          return `/user/${sign[0].id}/sign.png`;
        }
        return sign;
      },

      // 全局常量
      headerUrl: '/user/',

      // 存储导出内容
      exports: {},

      // 模拟 procedures
      procedures: this.createMockProcedures(),

      // 模拟 projectId
      projectId: 'test-project-id'
    };
  }

  /**
   * 创建模拟 procedures 对象
   * @returns {object} 模拟 procedures
   */
  createMockProcedures() {
    const testData = this.testData;
    const processId = 'test-process-id';
    const templateId = 'test-template-id';

    return {
      [processId]: {
        processes: {
          [templateId]: {
            form: testData.formJs
          }
        }
      }
    };
  }

  /**
   * 执行脚本
   * @param {string} script - 脚本内容
   * @param {object} env - 模拟环境
   * @returns {any} 脚本执行结果
   */
  executeScript(script, env) {
    // 提取脚本中的变量声明
    const lines = script.split('\n');
    let lastExpression = null;

    // 构建执行函数
    const executeFn = new Function(
      'env',
      'load', 'get', 'set',
      'getCheckBox', 'formatDateCN', 'getSignUrl', 'headerUrl',
      'procedures', 'projectId',
      `
      // 注入模拟环境
      const formJs = env.procedures['test-process-id'].processes['test-template-id'].form;
      const samplesJs = env.procedures['test-process-id'].processes['test-template-id'].samples || [];
      const samples = samplesJs;
      const form = formJs;

      // 模拟 getForm 函数
      function getForm(procedures) {
        const processId = Object.keys(procedures)[0];
        const templateId = Object.keys(procedures[processId].processes)[0];
        return procedures[processId].processes[templateId].form;
      }

      // 清理数据中的 null 键
      if (samplesJs) {
        var samplesStr = JSON.stringify(samplesJs);
        samplesStr = samplesStr.replace(/null:/g, '"null":');
        var samples = JSON.parse(samplesStr);
      }

      // 执行脚本
      ${script}

      // 返回最后一个表达式的值
      return ${this.detectLastExpression(script)};
      `
    );

    return executeFn(
      env,
      env.load.bind(env),
      env.get.bind(env),
      env.set.bind(env),
      env.getCheckBox.bind(env),
      env.formatDateCN.bind(env),
      env.getSignUrl.bind(env),
      env.headerUrl,
      env.procedures,
      env.projectId
    );
  }

  /**
   * 检测脚本中最后一个表达式
   * @param {string} script - 脚本内容
   * @returns {string} 最后一个表达式
   */
  detectLastExpression(script) {
    const lines = script.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
    if (lines.length === 0) return 'undefined';

    const lastLine = lines[lines.length - 1].trim();

    // 如果最后一行是变量名或表达式
    if (!lastLine.startsWith('var ') &&
        !lastLine.startsWith('let ') &&
        !lastLine.startsWith('const ') &&
        !lastLine.startsWith('function ') &&
        !lastLine.startsWith('if ') &&
        !lastLine.startsWith('for ') &&
        !lastLine.startsWith('while ')) {
      return lastLine;
    }

    // 否则尝试找 outputData, reports, formJs 等常见返回变量
    const commonReturns = ['outputData', 'reports', 'formJs', 'output', 'result'];
    for (const ret of commonReturns) {
      if (script.includes(`var ${ret}`) ||
          script.includes(`let ${ret}`) ||
          script.includes(`const ${ret}`)) {
        return ret;
      }
    }

    return 'undefined';
  }

  /**
   * 验证输出
   * @param {any} output - 脚本输出
   * @returns {object} 验证结果
   */
  validateOutput(output) {
    const actualFields = this.extractFields(output);
    const missingFields = this.requiredFields.filter(f => !actualFields.includes(f));
    const extraFields = actualFields.filter(f => !this.requiredFields.includes(f));

    // 类型验证
    const typeErrors = this.validateFieldTypes(output, actualFields);

    // 数据行验证
    const rowValidation = this.validateRows(output);

    return {
      requiredFields: this.requiredFields,
      actualFields: actualFields,
      missingFields: missingFields,
      extraFields: extraFields,
      typeErrors: typeErrors,
      rowValidation: rowValidation
    };
  }

  /**
   * 从输出中提取所有字段名
   * @param {any} output - 输出对象
   * @returns {string[]} 字段名数组
   */
  extractFields(output) {
    const fields = new Set();

    function traverse(obj, prefix = '') {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => traverse(item, prefix));
        return;
      }

      Object.keys(obj).forEach(key => {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        fields.add(fullPath);

        // 对于数组类型的字段，只记录字段名
        if (!Array.isArray(obj[key]) && typeof obj[key] === 'object') {
          traverse(obj[key], fullPath);
        }
      });
    }

    traverse(output);
    return Array.from(fields);
  }

  /**
   * 验证字段类型
   * @param {any} output - 输出对象
   * @param {string[]} fields - 字段名数组
   * @returns {object[]} 类型错误列表
   */
  validateFieldTypes(output, fields) {
    const errors = [];

    function getValueByPath(obj, path) {
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return null;
        }
      }
      return current;
    }

    // 这里可以根据模板要求添加更严格的类型检查
    // 目前只检查 null/undefined 的情况
    fields.forEach(field => {
      const value = getValueByPath(output, field);
      if (value === null || value === undefined) {
        errors.push({
          field: field,
          expectedType: 'non-null',
          actualType: 'null',
          severity: 'error'
        });
      }
    });

    return errors;
  }

  /**
   * 验证数据行
   * @param {any} output - 输出对象
   * @returns {object} 行验证结果
   */
  validateRows(output) {
    const result = {
      outputType: Array.isArray(output) ? 'array' : typeof output,
      rowCount: 0,
      expectedRowCount: this.testData.samplesJs?.length || 0,
      passed: false
    };

    if (Array.isArray(output)) {
      result.rowCount = output.length;
    } else if (output && typeof output === 'object') {
      // 检查是否有 gaugingList 等数组字段
      const arrayFields = Object.keys(output).filter(k => Array.isArray(output[k]));
      if (arrayFields.length > 0) {
        result.rowCount = Math.max(...arrayFields.map(k => output[k].length));
      }
    }

    result.passed = result.rowCount > 0;
    return result;
  }

  /**
   * 计算准确率
   * @param {object} validation - 验证结果
   * @returns {number} 准确率 (0-1)
   */
  calculateAccuracy(validation) {
    const { requiredFields, actualFields, missingFields, typeErrors, rowValidation } = validation;

    // 字段完整率
    const fieldCompleteness = requiredFields.length > 0
      ? (requiredFields.length - missingFields.length) / requiredFields.length
      : 1;

    // 字段准确率
    const fieldAccuracy = actualFields.length > 0
      ? (actualFields.length - missingFields.length) / actualFields.length
      : 1;

    // 数据行完整率
    const rowCompleteness = rowValidation.expectedRowCount > 0
      ? Math.min(1, rowValidation.rowCount / rowValidation.expectedRowCount)
      : 1;

    // 类型准确率
    const typeAccuracy = requiredFields.length > 0
      ? (requiredFields.length - typeErrors.length) / requiredFields.length
      : 1;

    // 综合准确率
    const accuracy =
      fieldCompleteness * 0.3 +
      fieldAccuracy * 0.4 +
      rowCompleteness * 0.2 +
      typeAccuracy * 0.1;

    return {
      fieldCompleteness,
      fieldAccuracy,
      rowCompleteness,
      typeAccuracy,
      overall: Math.min(1, Math.max(0, accuracy))
    };
  }

  /**
   * 生成测试报告
   * @param {string} script - 脚本内容
   * @param {any} output - 输出
   * @param {object} validation - 验证结果
   * @param {object} accuracy - 准确率
   * @returns {string} Markdown 格式的报告
   */
  generateReport(script, output, validation, accuracy) {
    const { requiredFields, actualFields, missingFields, extraFields, typeErrors, rowValidation } = validation;

    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let report = `# 脚本测试报告\n\n`;
    report += `## 测试概要\n`;
    report += `- 测试时间：${now}\n`;
    report += `- 测试数据：${this.testData.samplesJs?.length || 0} 条样品\n`;
    report += `- 返回类型：${rowValidation.outputType}\n\n`;

    report += `## 准确率指标\n`;
    report += `- 字段完整率：${(accuracy.fieldCompleteness * 100).toFixed(0)}% (${requiredFields.length - missingFields.length}/${requiredFields.length} 字段)\n`;
    report += `- 字段准确率：${(accuracy.fieldAccuracy * 100).toFixed(0)}% (${requiredFields.length - missingFields.length}/${actualFields.length} 字段)\n`;
    report += `- 数据行完整率：${(accuracy.rowCompleteness * 100).toFixed(0)}% (${rowValidation.rowCount}/${rowValidation.expectedRowCount} 行)\n`;
    report += `- 类型准确率：${(accuracy.typeAccuracy * 100).toFixed(0)}% (${requiredFields.length - typeErrors.length}/${requiredFields.length} 字段)\n`;
    report += `- **综合准确率：${(accuracy.overall * 100).toFixed(0)}%**\n\n`;

    report += `## 测试结果\n`;
    report += accuracy.overall >= this.options.targetAccuracy
      ? `✅ 通过 (目标准确率：≥${(this.options.targetAccuracy * 100).toFixed(0)}%)\n\n`
      : `❌ 未通过 (目标准确率：≥${(this.options.targetAccuracy * 100).toFixed(0)}%)\n\n`;

    if (missingFields.length > 0) {
      report += `## 缺失字段 (${missingFields.length})\n`;
      missingFields.forEach(field => {
        report += `1. \`${field}\`\n`;
      });
      report += `\n`;
    }

    if (extraFields.length > 0) {
      report += `## 额外字段 (${extraFields.length})\n`;
      extraFields.forEach(field => {
        report += `1. \`${field}\`\n`;
      });
      report += `\n`;
    }

    if (typeErrors.length > 0) {
      report += `## 类型错误 (${typeErrors.length})\n`;
      typeErrors.forEach(error => {
        report += `1. \`${error.field}\` - 期望 ${error.expectedType}，实际 ${error.actualType}\n`;
      });
      report += `\n`;
    }

    report += `## 数据行检查\n`;
    report += `- 样品数：${rowValidation.rowCount}/${rowValidation.expectedRowCount} ${rowValidation.passed ? '✓' : '✗'}\n\n`;

    if (missingFields.length > 0) {
      report += `## 修复建议\n`;
      missingFields.forEach(field => {
        const suggestion = this.generateFixSuggestion(field);
        report += `1. ${suggestion}\n`;
      });
      report += `\n`;
    }

    return report;
  }

  /**
   * 为缺失字段生成修复建议
   * @param {string} field - 缺失字段名
   * @returns {string} 修复建议
   */
  generateFixSuggestion(field) {
    // 分析字段名特征
    const name = field.split('.').pop();

    if (name.startsWith('t_')) {
      // LabsCare 标签字段
      if (['t_wtName', 't_htName', 't_baogaoDay', 't_baogaoNo'].includes(name)) {
        return `\`${field}\` - 页头字段，需要从 \`form\` 或 \`formJs\` 中取值`;
      }
      if (['t_TestMan', 't_shuMan', 't_checkMan', 't_ratifyMan'].includes(name)) {
        return `\`${field}\` - 签名字段，需要保留数组结构，不要取 [0].val`;
      }
      if (['t_name', 't_sampleMan', 't_sampMark'].includes(name)) {
        return `\`${field}\` - 样品字段，需要从 \`sample\` 中取值`;
      }
      if (['t_nameYQ', 't_modeXH', 't_numYQ'].includes(name)) {
        return `\`${field}\` - 仪器字段，需要从 \`gauging\` 或关联仪器中取值`;
      }
      if (['t_qx', 't_glQX'].includes(name)) {
        return `\`${field}\` - 关联曲线字段，需要从 \`fkCases[0]\` 或 \`caseList[0]\` 深入取值`;
      }
    }

    if (['factorName', 'methodName', 'methodNo'].includes(name)) {
      return `\`${field}\` - 检测项字段，需要从 \`gauging\` 中取值并映射到输出对象`;
    }

    if (['caseName', 'sampleId', 'tempId'].includes(name)) {
      return `\`${field}\` - 样品标识字段，需要从 \`sample\` 中取值`;
    }

    return `\`${field}\` - 需要检查数据源并确定正确的取值路径`;
  }
}

// 导出供 Node.js 使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScriptTester;
}
