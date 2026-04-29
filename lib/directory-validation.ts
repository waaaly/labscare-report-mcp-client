import { DirectoryStructure, RawReportDir } from '@/components/conversation/ValidatedStructurePanel';

export async function traverseFileTree(entry: any, path = ""): Promise<File | File[] | null> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve) => entry.file(resolve));
    Object.defineProperty(file, 'webkitRelativePath', {
      value: path + file.name,
      writable: false
    });
    return file;
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const entries = await new Promise<any[]>((resolve) => dirReader.readEntries(resolve));
    const files: File[] = [];
    for (const childEntry of entries) {
      const childFile = await traverseFileTree(childEntry, path + entry.name + "/");
      if (childFile) {
        if (Array.isArray(childFile)) {
          files.push(...childFile);
        } else {
          files.push(childFile);
        }
      }
    }
    return files;
  }
  return null;
}

export function validateDirectoryStructure(files: File[]): DirectoryStructure {
  const result: DirectoryStructure = {
    topLevelDir: '',
    testCases: [],
    isValid: true,
    errors: []
  };

  if (files.length === 0) {
    result.isValid = false;
    result.errors.push('未选择任何文件');
    return result;
  }

  const pathMap = new Map<string, { type: 'dir' | 'file'; children?: string[]; files?: string[] }>();
  
  files.forEach(file => {
    const relativePath = (file as any).webkitRelativePath || file.name;
    const parts = relativePath.split('/');
    
    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = i === 0 ? part : `${currentPath}/${part}`;
      
      if (!pathMap.has(currentPath)) {
        if (i === parts.length - 1) {
          pathMap.set(currentPath, { type: 'file', files: [] });
        } else {
          pathMap.set(currentPath, { type: 'dir', children: [] });
        }
      }
      
      if (i > 0) {
        const parentPath = i === 1 ? parts[0] : currentPath.substring(0, currentPath.lastIndexOf('/'));
        const parent = pathMap.get(parentPath);
        if (parent && parent.children && !parent.children.includes(part)) {
          parent.children.push(part);
        }
      }
    }
  });

  const topLevelEntries = Array.from(pathMap.keys()).filter(p => !p.includes('/'));
  if (topLevelEntries.length !== 1) {
    result.isValid = false;
    result.errors.push(`期望只有一个顶层目录，但发现 ${topLevelEntries.length} 个`);
    return result;
  }
  
  result.topLevelDir = topLevelEntries[0];
  const topLevel = pathMap.get(result.topLevelDir);
  
  if (!topLevel || topLevel.type !== 'dir') {
    result.isValid = false;
    result.errors.push('顶层目录不是有效的目录');
    return result;
  }

  if (!topLevel.children || topLevel.children.length === 0) {
    result.isValid = false;
    result.errors.push('顶层目录为空，需要至少包含一个测试用例文件夹');
    return result;
  }

  topLevel.children.forEach(testCaseName => {
    const testCasePath = `${result.topLevelDir}/${testCaseName}`;
    const testCase = pathMap.get(testCasePath);
    
    if (!testCase || testCase.type !== 'dir') {
      result.testCases.push({
        name: testCaseName,
        jsonFiles: [],
        missingJson: true,
        rawReportDirs: [],
      });
      result.isValid = false;
      result.errors.push(`"${testCaseName}" 不是有效的目录`);
      return;
    }

    const TEST_CASE_JSON = ['样品数据.json', '流程数据.json'];
    const jsonFiles: string[] = [];
    (testCase.children || []).forEach(child => {
      const childPath = `${testCasePath}/${child}`;
      const childEntry = pathMap.get(childPath);
      if (childEntry?.type === 'file' && TEST_CASE_JSON.includes(child)) {
        jsonFiles.push(child);
      }
    });
    const missingJson = jsonFiles.length === 0;

    const rawReportDirs: RawReportDir[] = [];

    (testCase.children || []).forEach(child => {
      const childPath = `${testCasePath}/${child}`;
      const childEntry = pathMap.get(childPath);
      if (childEntry?.type !== 'dir') return;

      const dirFiles: string[] = [];
      const templatePngs: string[] = [];
      let descMd: string | null = null;

      (childEntry.children || []).forEach(grandchild => {
        const gcPath = `${childPath}/${grandchild}`;
        const gcEntry = pathMap.get(gcPath);
        if (gcEntry?.type === 'file') {
          dirFiles.push(grandchild);
          if (grandchild.match(/^(占位符模板|模板占位符).*\.png$/i)) {
            templatePngs.push(grandchild);
          }
          if (grandchild.match(/^(占位符描述|描述占位符).*\.md$/i)) {
            descMd = grandchild;
          }
        }
      });

      if (templatePngs.length > 0 || descMd) {
        rawReportDirs.push({
          name: child,
          files: dirFiles,
          templatePngs,
          descMd,
          missingTemplatePng: templatePngs.length === 0,
          missingDescMd: descMd === null,
        });
      }
    });

    result.testCases.push({
      name: testCaseName,
      jsonFiles,
      missingJson,
      rawReportDirs,
    });

    if (missingJson) {
      result.isValid = false;
      result.errors.push(`"${testCaseName}" 不是有效的测试用例（缺少 样品数据.json 或 流程数据.json）`);
    }
    if (rawReportDirs.length === 0) {
      result.isValid = false;
      result.errors.push(`"${testCaseName}" 缺少原始报告目录（需含占位符模板.png + 占位符描述文档.md）`);
    }
    rawReportDirs.forEach(rd => {
      if (rd.missingTemplatePng) {
        result.isValid = false;
        result.errors.push(`"${testCaseName}/${rd.name}" 缺少占位符模板图片（.png）`);
      }
      if (rd.missingDescMd) {
        result.isValid = false;
        result.errors.push(`"${testCaseName}/${rd.name}" 缺少占位符描述文档.md`);
      }
    });
  });

  return result;
}
