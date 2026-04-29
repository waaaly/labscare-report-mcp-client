export interface BatchImportDocument {
  fileName: string;
  url: string;
  storagePath: string;
  size: number;
  contentType: string;
}

export interface BatchImportReport {
  name: string;
  documents: BatchImportDocument[];
}

export interface BatchImportProject {
  name: string;
  reports: BatchImportReport[];
}

export interface BatchImportData {
  action: 'batch_import';
  labName: string;
  projects: BatchImportProject[];
}

export function buildBatchImportPrompt(data: BatchImportData): string {
  const lines: string[] = [];

  lines.push('⚠️ 批量导入任务 — 请严格按以下步骤执行，每步完成后报告状态。');
  lines.push('');
  lines.push(`【当前实验室】${data.labName}`);
  lines.push('');
  lines.push('【执行规则】');
  lines.push('1. 必须按 步骤1 → 步骤2 → 步骤3 顺序执行，不要跳过或合并');
  lines.push('2. 每一步需要的 ID 必须从上一步的返回值中获取，不要猜测或编造');
  lines.push('3. 如果任一步骤失败，立即停止并报告具体错误，不要继续后续步骤');
  lines.push('4. 工具参数中的 name 字段必须与以下清单完全一致');
  lines.push('');
  lines.push('【待创建资源清单】');
  lines.push('');
  lines.push('步骤1：验证实验室');
  lines.push(`  调用 list_labs，确认实验室"${data.labName}"存在，获取 labId`);
  lines.push('');

  lines.push('步骤2：创建项目和报告');
  lines.push('  以下每个项目都需要先 create_project，拿到 projectId 后再创建其下的报告：');
  lines.push('');

  data.projects.forEach((project, pi) => {
    lines.push(`  项目${pi + 1}：${project.name}`);
    lines.push(`    a. create_project({ labId: <步骤1返回>, name: "${project.name}" })`);
    lines.push('    b. 等待返回 { id: projectId }');

    project.reports.forEach((report, ri) => {
      const step = ri === 0 ? 'c' : `c-${ri + 1}`;
      lines.push(`    ${step}. create_report_template({ labId, projectId, name: "${report.name}" })`);
      lines.push(`       → 返回 { id: reportId_${pi}_${ri} }`);
    });
    lines.push('');
  });

  lines.push('步骤3：关联已上传的物料文件');
  lines.push('  对每个报告的每个文件，调用 upload_document：');
  lines.push('');

  data.projects.forEach((project, pi) => {
    project.reports.forEach((report, ri) => {
      lines.push(`  ${project.name} / ${report.name}:`);
      report.documents.forEach((doc) => {
        lines.push(`    upload_document({ labId, projectId, reportId: reportId_${pi}_${ri}, `);
        lines.push(`      url: "${doc.url}", storagePath: "${doc.storagePath}", `);
        lines.push(`      name: "${doc.fileName}", type: "${doc.contentType}", size: ${doc.size} })`);
      });
      lines.push('');
    });
  });

  return lines.join('\n');
}

export function isBatchImportData(prompt: string): boolean {
  try {
    const parsed = JSON.parse(prompt);
    return parsed.action === 'batch_import';
  } catch {
    return false;
  }
}

export function parseBatchImportData(prompt: string): BatchImportData | null {
  try {
    const parsed = JSON.parse(prompt);
    if (parsed.action === 'batch_import') {
      return parsed as BatchImportData;
    }
    return null;
  } catch {
    return null;
  }
}
