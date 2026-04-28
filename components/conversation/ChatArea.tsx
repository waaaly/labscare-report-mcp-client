'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Send, Paperclip, X, Image as ImageIcon, File as FileIcon, Square, RefreshCw, Search, XCircle, Download, Folder, AlertTriangle, FolderOpen, FileJson, FileText, Image, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useEffect } from 'react';
import { VirtualizedMessages, Msg } from './VirtualizedMessages';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


/** ── 校验通过目录结构展示面板 ── */
interface RawReportDir {
  name: string;
  files: string[];
  templatePngs: string[];
  descMd: string | null;
  missingTemplatePng: boolean;
  missingDescMd: boolean;
}

interface DirectoryStructure {
  topLevelDir: string;
  testCases: {
    name: string;
    jsonFiles: string[];
    missingJson: boolean;
    rawReportDirs: RawReportDir[];
  }[];
  isValid: boolean;
  errors: string[];
}

function ValidatedStructurePanel({
  data,
  onRemove,
}: {
  data: {
    structure: DirectoryStructure;
    files: File[];
    previews: Map<string, { preview?: string; previewText?: string }>;
  };
  onRemove: () => void;
}) {
  const [rootOpen, setRootOpen] = React.useState(true);
  const [openProjects, setOpenProjects] = React.useState<Set<number>>(() => {
    // 默认全部展开
    const s = new Set<number>();
    data.structure.testCases.forEach((_, i) => s.add(i));
    return s;
  });
  const [openReports, setOpenReports] = React.useState<Set<string>>(() => {
    // 默认全部展开，key 为 "tcIdx-rdIdx"
    const s = new Set<string>();
    data.structure.testCases.forEach((tc, tcIdx) => {
      tc.rawReportDirs.forEach((_, rdIdx) => s.add(`${tcIdx}-${rdIdx}`));
    });
    return s;
  });

  const toggleProject = (idx: number) => {
    setOpenProjects(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleReport = (key: string) => {
    setOpenReports(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="px-3 pt-3 pb-2 border-b">
      {/* ── 顶部：可展开/收起 ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-1.5 hover:bg-muted/50 rounded px-1 py-0.5 -ml-1 transition-colors"
          onClick={() => setRootOpen(v => !v)}
        >
          {rootOpen
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <FolderOpen className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">上传目录</span>
          <Badge className="text-[10px] h-5 bg-green-500 hover:bg-green-600">
            {data.structure.testCases.length} 个项目
          </Badge>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded bg-background/80 hover:bg-background p-1"
          aria-label="移除目录结构"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── 展开内容 ── */}
      {rootOpen && (
        <div className="mt-2 space-y-1.5 max-h-72 overflow-auto pr-1">
          {data.structure.testCases.map((tc, tcIdx) => {
            const tcPathPrefix = `${data.structure.topLevelDir}/${tc.name}`;
            const projectOpen = openProjects.has(tcIdx);
            const reportCount = tc.rawReportDirs.length;

            return (
              <div key={tcIdx} className="rounded-lg border border-green-500/20 bg-green-500/5">
                {/* 项目头部：可点击展开/收起 */}
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 bg-green-500/10 border-b border-green-500/10 hover:bg-green-500/15 transition-colors"
                  onClick={() => toggleProject(tcIdx)}
                >
                  {projectOpen
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  <Folder className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium">{tc.name}</span>
                  <span className="text-[10px] text-muted-foreground">项目</span>
                  <Badge variant="secondary" className="text-[10px] h-4 ml-auto">
                    {reportCount} 个报告
                  </Badge>
                </button>

                {/* 项目内容 */}
                {projectOpen && (
                  <div className="px-3 py-2 space-y-2">
                    {/* JSON 数据文件（共享） — 水平排列 */}
                    {tc.jsonFiles.length > 0 && (
                      <div className="pl-5">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                          <FileJson className="h-3 w-3 text-sky-400" />
                          <span>数据文件</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {tc.jsonFiles.map((jf, jfIdx) => {
                            const rp = `${tcPathPrefix}/${jf}`;
                            const pv = data.previews.get(rp);
                            const fileObj = data.files.find(f => (f as any).webkitRelativePath === rp);
                            return (
                              <div key={jfIdx} className="flex-shrink-0 w-48 rounded border bg-background overflow-hidden">
                                <div className="px-2 py-1.5 border-b bg-muted/30 flex items-center gap-1">
                                  <FileJson className="h-3 w-3 text-sky-400" />
                                  <span className="text-[10px] font-medium truncate">{jf}</span>
                                </div>
                                <div className="p-1.5">
                                  <div className="h-14 w-full overflow-auto rounded bg-muted/60 p-1.5 text-[9px] leading-snug">
                                    {pv?.previewText ? (
                                      <pre className="whitespace-pre-wrap">{pv.previewText}</pre>
                                    ) : (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <FileIcon className="h-3 w-3" />
                                        <span>Loading…</span>
                                      </div>
                                    )}
                                  </div>
                                  {fileObj && (
                                    <div className="mt-0.5 text-[9px] text-muted-foreground">
                                      {(fileObj.size / 1024).toFixed(1)} KB
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 原始报告目录 */}
                    {tc.rawReportDirs.map((rd, rdIdx) => {
                      const rdPathPrefix = `${tcPathPrefix}/${rd.name}`;
                      const reportKey = `${tcIdx}-${rdIdx}`;
                      const reportOpen = openReports.has(reportKey);

                      return (
                        <div key={rdIdx} className="pl-5 border-l-2 border-amber-500/20">
                          {/* 报告头部：可点击展开/收起 */}
                          <button
                            type="button"
                            className="w-full flex items-center gap-1.5 py-1 hover:bg-amber-500/5 rounded px-1 -ml-1 transition-colors"
                            onClick={() => toggleReport(reportKey)}
                          >
                            {reportOpen
                              ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                            <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-xs font-medium">{rd.name}</span>
                            <span className="text-[10px] text-muted-foreground">报告</span>
                          </button>

                          {/* 报告内容：物料水平排列 */}
                          {reportOpen && (
                            <div className="pl-4 pb-1">
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {/* 模板图片 */}
                                {rd.templatePngs.map((png, pngIdx) => {
                                  const rp = `${rdPathPrefix}/${png}`;
                                  const pv = data.previews.get(rp);
                                  return (
                                    <div key={pngIdx} className="flex-shrink-0 w-28 rounded border bg-background overflow-hidden">
                                      <div className="h-20 w-full">
                                        {pv?.preview ? (
                                          <img src={pv.preview} alt={png} className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="h-full flex items-center justify-center text-muted-foreground">
                                            <ImageIcon className="h-4 w-4" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="px-1.5 py-1 text-[9px] truncate text-muted-foreground flex items-center gap-0.5">
                                        <Image className="h-2.5 w-2.5 text-green-400" />
                                        {png}
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* 描述文档 */}
                                {rd.descMd && (() => {
                                  const rp = `${rdPathPrefix}/${rd.descMd}`;
                                  const pv = data.previews.get(rp);
                                  const fileObj = data.files.find(f => (f as any).webkitRelativePath === rp);
                                  return (
                                    <div className="flex-shrink-0 w-48 rounded border bg-background overflow-hidden">
                                      <div className="px-2 py-1.5 border-b bg-muted/30 flex items-center gap-1">
                                        <FileText className="h-3 w-3 text-orange-400" />
                                        <span className="text-[10px] font-medium truncate">{rd.descMd}</span>
                                      </div>
                                      <div className="p-1.5">
                                        <div className="h-14 w-full overflow-auto rounded bg-muted/60 p-1.5 text-[9px] leading-snug">
                                          {pv?.previewText ? (
                                            <pre className="whitespace-pre-wrap">{pv.previewText}</pre>
                                          ) : (
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                              <FileIcon className="h-3 w-3" />
                                              <span>Loading…</span>
                                            </div>
                                          )}
                                        </div>
                                        {fileObj && (
                                          <div className="mt-0.5 text-[9px] text-muted-foreground">
                                            {(fileObj.size / 1024).toFixed(1)} KB
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Props = {
  title?: string;
  messages: Msg[];
  isLoading: boolean;
  input: string;
  onSend: (input: string) => void;
  onStop?: () => void;
  onRegenerate?: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onFilesChange: (files: File[]) => void;
  currentStatus?: string | null;
  // 搜索相关
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  highlightedMessageIndex?: number | null;
  onHighlightedIndexChange?: (index: number | null) => void;
  // 导出相关
  onExport?: (format: 'markdown' | 'json') => void;

  // 分支管理相关
  currentBranchId?: string;
  onSwitchBranch?: (branchId: string) => void;
  branches?: { id: string; name: string; createdAt: number }[];
  onCreateBranch?: (messageIndex: number) => void;

  // 背景图相关
  showUploadBackground?: boolean;
};

export default function ChatArea({
  title = 'Chat',
  messages,
  isLoading,
  input,
  onSend,
  onStop,
  onRegenerate,
  messagesEndRef,
  onFilesChange,
  currentStatus = null,
  searchQuery = '',
  onSearchChange,
  highlightedMessageIndex,
  onHighlightedIndexChange,
  onExport,
  currentBranchId = 'main',
  onSwitchBranch,
  branches = [],
  onCreateBranch,
  showUploadBackground = false,
}: Props) {
  const [attachments, setAttachments] = React.useState<{ file: File; type: 'image' | 'json' | 'md'; preview?: string; previewText?: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);
  const [localInput, setLocalInput] = React.useState(input);
  const [showSearch, setShowSearch] = React.useState(false);
  const [validationDialog, setValidationDialog] = React.useState<{
    open: boolean;
    result: DirectoryStructure | null;
    /** 待确认后添加的文件列表 */
    pendingFiles: File[];
  }>({ open: false, result: null, pendingFiles: [] });

  /** 校验通过并确认后的目录结构（含文件引用），按层级展示在输入框上方 */
  const [validatedStructure, setValidatedStructure] = React.useState<{
    structure: DirectoryStructure;
    files: File[];
    /** 物料文件预览信息：key 为 relativePath */
    previews: Map<string, { preview?: string; previewText?: string }>;
  } | null>(null);

  const addFiles = React.useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    const next: { file: File; type: 'image' | 'json' | 'md'; preview?: string; previewText?: string }[] = [];
    const textForPreview: File[] = [];
    for (const f of list) {
      const isImg = f.type.startsWith('image/');
      const isJson = f.type === 'application/json' || f.name.toLowerCase().endsWith('.json');
      const isMd = f.type === 'text/markdown' || f.name.toLowerCase().endsWith('.md');
      if (!isImg && !isJson && !isMd) continue;
      next.push({
        file: f,
        type: isImg ? 'image' : isJson ? 'json' : 'md',
        preview: isImg ? URL.createObjectURL(f) : undefined,
        previewText: undefined
      });
      if (isJson || isMd) textForPreview.push(f);
    }
    if (next.length > 0) {
      setAttachments(prev => {
        const merged = [...prev, ...next];
        onFilesChange?.(merged.map(i => i.file));
        return merged;
      });
      if (textForPreview.length > 0) {
        textForPreview.forEach(async (tf) => {
          try {
            const raw = await tf.text();
            let pretty = raw;
            const isLikelyJson = tf.type === 'application/json' || tf.name.toLowerCase().endsWith('.json');
            if (isLikelyJson) {
              try {
                const parsed = JSON.parse(raw);
                pretty = JSON.stringify(parsed, null, 2);
              } catch { }
            }
            const snippet = pretty.slice(0, 600);
            setAttachments(prev =>
              prev.map(att => att.file === tf ? { ...att, previewText: snippet } : att)
            );
          } catch { }
        });
      }
    }
  }, [onFilesChange]);

  const removeAttachment = React.useCallback((idx: number) => {
    setAttachments(prev => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      onFilesChange?.(copy.map(i => i.file));
      return copy;
    });
  }, [onFilesChange]);

  const handleFileChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.currentTarget.value = '';
  }, [addFiles]);

  const traverseFileTree = React.useCallback(async (entry: any, path = "") => {
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
  }, []);

  const validateDirectoryStructure = React.useCallback((files: File[]): DirectoryStructure => {
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

      // ── 1. 判断测试用例文件夹：直接在目录下找 样品数据.json / 流程数据.json ──
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

      // ── 2. 判断原始报告目录：遍历子目录，找含 .png 模板 + .md 描述的目录（可有多个） ──
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

        // 只要有模板图或描述文件就视为原始报告目录候选
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

      // ── 3. 错误收集 ──
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
    console.log(result);
    
    return result;
  }, []);

  const handleFolderChange = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files: File[] = [];
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      files.push(file);
    }
    
    const validation = validateDirectoryStructure(files);
    
    // 始终弹出确认弹窗，让用户确认映射关系
    setValidationDialog({ open: true, result: validation, pendingFiles: files });
    e.currentTarget.value = '';
  }, [validateDirectoryStructure]);

  const handleDrop = React.useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const items = e.dataTransfer?.items;
    if (!items) return;

    const allFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        const result = await traverseFileTree(entry);
        if (result) {
          if (Array.isArray(result)) {
            allFiles.push(...result);
          } else {
            allFiles.push(result);
          }
        }
      }
    }
    
    if (allFiles.length > 0) addFiles(allFiles);
  }, [addFiles, traverseFileTree]);

  const handleDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleSendClick = React.useCallback(() => {
    const attachmentFiles = attachments.map(a => a.file);
    const validatedFiles = validatedStructure?.files || [];
    const allFiles = [...attachmentFiles, ...validatedFiles];

    if (attachments.length > 0 || validatedFiles.length > 0) {
      setAttachments(prev => {
        prev.forEach(i => i.preview && URL.revokeObjectURL(i.preview));
        return [];
      });
      // 清理 validatedStructure 的预览
      if (validatedStructure) {
        validatedStructure.previews.forEach(v => {
          if (v.preview) URL.revokeObjectURL(v.preview);
        });
        setValidatedStructure(null);
      }
      onFilesChange?.([]);
    }
    onSend(localInput);
    setLocalInput('');
  }, [onSend, localInput, setLocalInput, attachments, onFilesChange, validatedStructure]);

  const handleKeyPress = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  }, [handleSendClick, localInput]);

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f && f.type.startsWith('image/')) {
            files.push(f);
          }
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    },
    [addFiles]
  );
  const visibleMessages = React.useMemo(
    () =>
      messages.filter(
        (m) => !(m.role === 'assistant' && m.isStreaming && !m.content?.trim()) && m.messageType !== 'status'
      ),
    [messages]
  );
  const history = React.useMemo(() => {
    const arr = messages
      .filter((m) => m.role === 'user' && m.content?.trim())
      .map((m) => m.content.trim());
    const seen = new Set<string>();
    const uniq: string[] = [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const v = arr[i];
      if (!seen.has(v)) {
        seen.add(v);
        uniq.push(v);
      }
    }
    return uniq;
  }, [messages]);
  const [historyIndex, setHistoryIndex] = React.useState<number | null>(null);
  const draftRef = React.useRef<string>('');
  const handleHistoryKey = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (history.length === 0) return;
      const el = e.currentTarget;
      const caretStart = el.selectionStart ?? 0;
      const caretEnd = el.selectionEnd ?? 0;
      const atStart = caretStart === 0 && caretEnd === 0;
      const atEnd = caretStart === el.value.length && caretEnd === el.value.length;
      if (e.key === 'ArrowUp' && (atStart || !el.value)) {
        e.preventDefault();
        if (historyIndex === null) {
          draftRef.current = el.value;
          setHistoryIndex(0);
          setLocalInput(history[0] ?? '');
        } else if (historyIndex + 1 < history.length) {
          const nextIdx = historyIndex + 1;
          setHistoryIndex(nextIdx);
          setLocalInput(history[nextIdx]);
        }
      } else if (e.key === 'ArrowDown' && (atEnd || !el.value)) {
        e.preventDefault();
        if (historyIndex === null) return;
        if (historyIndex > 0) {
          const nextIdx = historyIndex - 1;
          setHistoryIndex(nextIdx);
          setLocalInput(history[nextIdx]);
        } else {
          setHistoryIndex(null);
          setLocalInput(draftRef.current);
        }
      }
    },
    [history, historyIndex]
  );
  return (
    <>
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="truncate">{title}</CardTitle>
        {/* 分支选择下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 px-3 mr-2">
              {branches.find(b => b.id === currentBranchId)?.name || currentBranchId}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {branches.map((branch) => (
              <DropdownMenuItem 
                key={branch.id} 
                onClick={() => onSwitchBranch?.(branch.id)}
                className={currentBranchId === branch.id ? 'bg-primary/10' : ''}
              >
                {branch.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {showSearch ? (
          <div className="flex items-center gap-1 flex-1 max-w-[200px] ml-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search..."
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
            {searchQuery && (
              <span className="text-xs text-muted-foreground">
                {highlightedMessageIndex !== null && highlightedMessageIndex !== undefined ? highlightedMessageIndex + 1 : 0}
              </span>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setShowSearch(false);
                onSearchChange?.('');
                onHighlightedIndexChange?.(null);
              }}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setShowSearch(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
        )}
        {onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 ml-1">
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport('markdown')}>
                Export as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('json')}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent
        className="flex-1 overflow-auto relative"
        style={showUploadBackground ? {
          backgroundImage: `url('/image/upload-path-bg.png')`,
          backgroundSize: '800px auto',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          backgroundAttachment: 'fixed'
        } : {}}
      >
      
        <VirtualizedMessages
          messages={visibleMessages}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
          currentStatus={currentStatus}
          searchQuery={searchQuery}
          highlightedMessageIndex={highlightedMessageIndex}
        />
      </CardContent>
      <div className="p-4 border-t">
        <div className="flex items-end">
          <div className="flex-1">
            <div
              className="relative rounded-lg border bg-background transition-shadow focus-within:ring-2 focus-within:ring-primary"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {validatedStructure && (
                <ValidatedStructurePanel
                  data={validatedStructure}
                  onRemove={() => {
                    validatedStructure.previews.forEach(v => {
                      if (v.preview) URL.revokeObjectURL(v.preview);
                    });
                    setValidatedStructure(null);
                    onFilesChange?.(attachments.map(a => a.file));
                  }}
                />
              )}

              {attachments.length > 0 && (
                <div className="px-3 pt-3 pb-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-auto pr-1">
                    {attachments.map((att, idx) => (
                      <Card key={idx} className="relative overflow-hidden">
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="absolute right-1 top-1 rounded bg-background/80 hover:bg-background p-1"
                          aria-label="Remove attachment"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <CardHeader className="py-2 pr-6">
                          <CardTitle className="text-xs font-medium truncate">{att.file.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-2">
                          {att.type === 'image' ? (
                            att.preview ? (
                              <img src={att.preview} alt={att.file.name} className="h-24 w-full object-cover rounded" />
                            ) : (
                              <div className="h-24 w-full flex items-center justify-center text-muted-foreground">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            )
                          ) : (
                            <div className="h-24 w-full overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-snug">
                              {att.previewText ? (
                                <pre className="whitespace-pre-wrap">{att.previewText}</pre>
                              ) : (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <FileIcon className="h-4 w-4" />
                                  <span>Loading preview…</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-2 text-[10px] text-muted-foreground">
                            {(att.file.size / 1024).toFixed(1)} KB
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              <Textarea
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e)}
                onKeyDown={handleHistoryKey}
                onPaste={handlePaste}
                placeholder="Type your message..."
                className="min-h-[72px] w-full resize-none border-0 bg-transparent px-3 py-3 pr-24 pb-12 shadow-none focus-visible:ring-0"
                rows={3}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/json,text/markdown,.md"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  // @ts-ignore
                  webkitdirectory=""
                  // @ts-ignore
                  directory=""
                  className="hidden"
                  onChange={handleFolderChange}
                />
                {isLoading ? (
                  <>
                    {/* 停止生成按钮 */}
                    <Button
                      size="icon"
                      type="button"
                      variant="destructive"
                      onClick={onStop}
                      className="h-9 w-9 rounded-full"
                      aria-label="Stop generating"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                    {/* 重新生成按钮 */}
                    <Button
                      size="icon"
                      type="button"
                      variant="secondary"
                      onClick={onRegenerate}
                      className="h-9 w-9 rounded-full"
                      aria-label="Regenerate response"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        type="button"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-9 w-9 rounded-full"
                        aria-label="上传物料"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        type="button"
                        variant="secondary"
                        onClick={() => folderInputRef.current?.click()}
                        className="h-9 w-9 rounded-full"
                        aria-label="上传文件夹"
                      >
                        <Folder className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      size="icon"
                      onClick={handleSendClick}
                      disabled={(!localInput.trim() && attachments.length === 0 && !validatedStructure)}
                      className="h-9 w-9 rounded-full"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>

    {/* 目录结构验证确认弹窗 */}
    <Dialog open={validationDialog.open} onOpenChange={(open) => {
      if (!open) setValidationDialog(prev => ({ ...prev, open }));
    }}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-1.5 rounded-md',
              validationDialog.result?.isValid ? 'bg-green-500/10' : 'bg-destructive/10'
            )}>
              {validationDialog.result?.isValid
                ? <FolderOpen className="h-5 w-5 text-green-600" />
                : <AlertTriangle className="h-5 w-5 text-destructive" />}
            </div>
            <DialogTitle>
              {validationDialog.result?.isValid ? '目录结构验证通过' : '目录结构验证未通过'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {validationDialog.result?.isValid
              ? 'Agent 将按照以下映射关系创建项目和报告，请确认后上传'
              : '部分目录不符合要求，请检查以下问题后重新上传'}
          </DialogDescription>
        </DialogHeader>

        {validationDialog.result && (() => {
          type TestCase = DirectoryStructure['testCases'][number];
          const isTestCaseValid = (tc: TestCase) => {
            if (tc.missingJson) return false;
            if (tc.rawReportDirs.length === 0) return false;
            return tc.rawReportDirs.every(rd => !rd.missingTemplatePng && !rd.missingDescMd);
          };
          const passed = validationDialog.result.testCases.filter(isTestCaseValid);
          const failed = validationDialog.result.testCases.filter(tc => !isTestCaseValid(tc));

          return (
            <div className="flex-1 overflow-auto space-y-4 pr-1">
              {/* 通过检查的目录：映射提示 */}
              {passed.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-green-600" />
                    通过检查的目录
                    <Badge className="text-[10px] h-5 bg-green-500 hover:bg-green-600">{passed.length}</Badge>
                  </h4>
                  <div className="space-y-2">
                    {passed.map((tc, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium">{tc.name}</span>
                          </div>
                          <Badge className="text-[10px] h-5 bg-green-500 hover:bg-green-600">通过</Badge>
                        </div>

                        {/* 映射提示 */}
                        <div className="space-y-1.5 pl-2 border-l-2 border-green-500/20">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">目录名称</span>
                            <span className="font-mono text-foreground/80">{tc.name}</span>
                            <span className="text-green-600">→</span>
                            <span className="font-medium text-green-700">项目名称</span>
                          </div>
                          {tc.rawReportDirs.map((rd, ridx) => (
                            <div key={ridx} className="space-y-1 pl-2 border-l border-green-500/15">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">报告目录</span>
                                <span className="font-mono text-foreground/80">{rd.name}</span>
                                <span className="text-green-600">→</span>
                                <span className="font-medium text-green-700">报告名称</span>
                              </div>
                              <div className="flex items-start gap-2 text-xs">
                                <span className="text-muted-foreground">物料文件</span>
                                <div className="flex flex-wrap gap-1">
                                  {rd.templatePngs.map((f, fidx) => (
                                    <span key={fidx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 font-mono text-[10px]">
                                      <Image className="h-2.5 w-2.5" />
                                      {f}
                                    </span>
                                  ))}
                                  {rd.descMd && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 font-mono text-[10px]">
                                      <FileText className="h-2.5 w-2.5" />
                                      {rd.descMd}
                                    </span>
                                  )}
                                </div>
                                <span className="text-green-600">→</span>
                                <span className="font-medium text-green-700">报告物料</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 文件清单 */}
                        <div className="space-y-1.5 pt-1">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <FileJson className="h-3 w-3 text-sky-400" />
                              数据文件（共享）
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">OK</Badge>
                            </div>
                            {['样品数据.json', '流程数据.json'].map(fname => {
                              const found = tc.jsonFiles.includes(fname);
                              return (
                                <div key={fname} className="flex items-center gap-1 text-[11px] text-muted-foreground/80 pl-4">
                                  {found
                                    ? <span className="text-green-500">✓</span>
                                    : <span className="text-muted-foreground/40">✗</span>}
                                  <span className={found ? '' : 'text-muted-foreground/40'}>{fname}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="space-y-1.5">
                            {tc.rawReportDirs.map((rd, ridx) => (
                              <div key={ridx} className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <FolderOpen className="h-3 w-3 text-amber-400" />
                                  {rd.name}
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">OK</Badge>
                                </div>
                                <div className="pl-4 space-y-0.5">
                                  {rd.templatePngs.map((f, fidx) => (
                                    <div key={fidx} className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                      <span className="text-green-500">✓</span>
                                      <Image className="h-3 w-3 text-green-400" />
                                      <span>{f}</span>
                                    </div>
                                  ))}
                                  {rd.descMd && (
                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                      <span className="text-green-500">✓</span>
                                      <FileText className="h-3 w-3 text-orange-400" />
                                      <span>{rd.descMd}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 未通过检查的目录 */}
              {failed.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    未通过检查的目录
                    <Badge variant="destructive" className="text-[10px] h-5">{failed.length}</Badge>
                  </h4>
                  <div className="space-y-2">
                    {failed.map((tc, idx) => {
                      const tcErrors: string[] = [];
                      if (tc.missingJson) tcErrors.push('缺少 样品数据.json 或 流程数据.json（至少一个）');
                      if (tc.rawReportDirs.length === 0) tcErrors.push('缺少原始报告目录（需含占位符模板.png + 占位符描述文档.md）');
                      tc.rawReportDirs.forEach(rd => {
                        if (rd.missingTemplatePng) tcErrors.push(`${rd.name} 缺少占位符模板图片（.png）`);
                        if (rd.missingDescMd) tcErrors.push(`${rd.name} 缺少占位符描述文档.md`);
                      });

                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-destructive/10 bg-destructive/5 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Folder className="h-4 w-4 text-blue-400" />
                              <span className="text-sm font-medium">{tc.name}</span>
                            </div>
                            <Badge variant="destructive" className="text-[10px] h-5">未通过</Badge>
                          </div>

                          <div className="space-y-1.5">
                            {tcErrors.map((err, eidx) => (
                              <div key={eidx} className="flex items-center gap-2 text-xs text-destructive/90">
                                <XCircle className="h-3 w-3 flex-shrink-0" />
                                {err}
                              </div>
                            ))}
                          </div>

                          {/* 文件清单（即使未通过也显示已有文件） */}
                          <div className="space-y-1.5 pt-1">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <FileJson className="h-3 w-3 text-sky-400" />
                                数据文件
                                {tc.missingJson
                                  ? <XCircle className="h-3 w-3 text-destructive" />
                                  : <Badge variant="secondary" className="text-[10px] h-4 px-1">OK</Badge>}
                              </div>
                              {['样品数据.json', '流程数据.json'].map(fname => {
                                const found = tc.jsonFiles.includes(fname);
                                return (
                                  <div key={fname} className="flex items-center gap-1 text-[11px] text-muted-foreground/80 pl-4">
                                    {found
                                      ? <span className="text-green-500">✓</span>
                                      : <span className="text-muted-foreground/40">✗</span>}
                                    <span className={found ? '' : 'text-muted-foreground/40'}>{fname}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {tc.rawReportDirs.length > 0 ? tc.rawReportDirs.map((rd, ridx) => (
                              <div key={ridx} className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <FolderOpen className="h-3 w-3 text-amber-400" />
                                  {rd.name}
                                  {rd.missingTemplatePng || rd.missingDescMd
                                    ? <XCircle className="h-3 w-3 text-destructive" />
                                    : <Badge variant="secondary" className="text-[10px] h-4 px-1">OK</Badge>}
                                </div>
                                <div className="pl-4 space-y-0.5">
                                  {rd.templatePngs.length > 0 ? rd.templatePngs.map((f, fidx) => (
                                    <div key={fidx} className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                      <span className="text-green-500">✓</span>
                                      <Image className="h-3 w-3 text-green-400" />
                                      <span>{f}</span>
                                    </div>
                                  )) : (
                                    <div className="flex items-center gap-1 text-[11px] text-destructive/60 pl-1">
                                      <span>✗</span>
                                      <span>缺少占位符模板图片</span>
                                    </div>
                                  )}
                                  {rd.descMd ? (
                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                      <span className="text-green-500">✓</span>
                                      <FileText className="h-3 w-3 text-orange-400" />
                                      <span>{rd.descMd}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-[11px] text-destructive/60 pl-1">
                                      <span>✗</span>
                                      <span>缺少占位符描述文档.md</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )) : (
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <FolderOpen className="h-3 w-3 text-amber-400" />
                                <span className="text-destructive/60">未找到报告目录</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 期望的目录结构（始终展示参考） */}
              <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground">期望的目录结构</h4>
                <div className="font-mono text-xs text-muted-foreground space-y-0.5 leading-relaxed">
                  <div className="flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-blue-400" />
                    <span>顶层目录/</span>
                  </div>
                  <div className="pl-4 flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-blue-400" />
                    <span>测试用例名称/</span>
                    <span className="text-[10px] text-green-600/80">→ 项目名称</span>
                  </div>
                  <div className="pl-8 flex items-center gap-1.5">
                    <FileJson className="h-3.5 w-3.5 text-sky-400" />
                    <span>样品数据.json</span>
                    <span className="text-[10px] text-amber-600/80">(至少一个)</span>
                  </div>
                  <div className="pl-8 flex items-center gap-1.5">
                    <FileJson className="h-3.5 w-3.5 text-sky-400" />
                    <span>流程数据.json</span>
                    <span className="text-[10px] text-muted-foreground/60">(可选)</span>
                  </div>
                  <div className="pl-8 flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                    <span>原始报告名称1/</span>
                    <span className="text-[10px] text-green-600/80">→ 报告名称</span>
                  </div>
                  <div className="pl-12 flex items-center gap-1.5">
                    <Image className="h-3.5 w-3.5 text-green-400" />
                    <span>占位符模板.png</span>
                    <span className="text-[10px] text-muted-foreground/60">(可多个)</span>
                  </div>
                  <div className="pl-12 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-orange-400" />
                    <span>占位符描述文档.md</span>
                  </div>
                  <div className="pl-8 flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                    <span>原始报告名称2/</span>
                    <span className="text-[10px] text-green-600/80">→ 报告名称</span>
                  </div>
                  <div className="pl-12 flex items-center gap-1.5">
                    <Image className="h-3.5 w-3.5 text-green-400" />
                    <span>占位符模板.png</span>
                  </div>
                  <div className="pl-12 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-orange-400" />
                    <span>占位符描述文档.md</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <DialogFooter>
          {validationDialog.result && (() => {
            type TC = DirectoryStructure['testCases'][number];
            const isTCValid = (tc: TC) => {
              if (tc.missingJson) return false;
              if (tc.rawReportDirs.length === 0) return false;
              return tc.rawReportDirs.every(rd => !rd.missingTemplatePng && !rd.missingDescMd);
            };
            const passed = validationDialog.result.testCases.filter(isTCValid);
            const hasPassed = passed.length > 0;

            /** 将通过检测的目录文件加入 validatedStructure */
            const handleUploadPassed = () => {
              if (!validationDialog.result || validationDialog.pendingFiles.length === 0) return;

              // 构建通过检测的目录路径前缀集合
              const passedPaths = new Set<string>();
              passed.forEach(tc => {
                const tcPrefix = `${validationDialog.result!.topLevelDir}/${tc.name}`;
                // 测试用例目录本身的文件
                passedPaths.add(tcPrefix);
                tc.rawReportDirs.forEach(rd => {
                  passedPaths.add(`${tcPrefix}/${rd.name}`);
                });
              });

              // 只保留通过检测的文件
              const passedFiles = validationDialog.pendingFiles.filter(f => {
                const rp = (f as any).webkitRelativePath || f.name;
                // 文件的父目录路径
                const lastSlash = rp.lastIndexOf('/');
                const parentPath = lastSlash > 0 ? rp.substring(0, lastSlash) : '';
                return passedPaths.has(parentPath);
              });

              // 构建只含通过检测目录的 DirectoryStructure
              const filteredStructure: DirectoryStructure = {
                topLevelDir: validationDialog.result.topLevelDir,
                testCases: passed,
                isValid: true,
                errors: [],
              };

              // 为物料文件生成预览
              const previews = new Map<string, { preview?: string; previewText?: string }>();
              passedFiles.forEach(f => {
                const rp = (f as any).webkitRelativePath || f.name;
                const isImg = f.type.startsWith('image/') || rp.toLowerCase().endsWith('.png') || rp.toLowerCase().endsWith('.jpg') || rp.toLowerCase().endsWith('.jpeg');
                const isJson = f.type === 'application/json' || rp.toLowerCase().endsWith('.json');
                const isMd = f.type === 'text/markdown' || rp.toLowerCase().endsWith('.md');
                const entry: { preview?: string; previewText?: string } = {};
                if (isImg) {
                  entry.preview = URL.createObjectURL(f);
                }
                previews.set(rp, entry);
                if (isJson || isMd) {
                  f.text().then(raw => {
                    let pretty = raw;
                    if (isJson) {
                      try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch {}
                    }
                    const snippet = pretty.slice(0, 600);
                    previews.set(rp, { ...previews.get(rp)!, previewText: snippet });
                    setValidatedStructure(prev => prev ? { ...prev, previews: new Map(previews) } : prev);
                  }).catch(() => {});
                }
              });

              setValidatedStructure({
                structure: filteredStructure,
                files: passedFiles,
                previews,
              });
              onFilesChange?.([...(attachments.map(a => a.file)), ...passedFiles]);
              setValidationDialog({ open: false, result: null, pendingFiles: [] });
            };

            return hasPassed ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setValidationDialog({ open: false, result: null, pendingFiles: [] })}
                >
                  取消
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleUploadPassed}
                >
                  上传通过检测目录{passed.length > 0 ? `（${passed.length} 个项目）` : ''}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setValidationDialog({ open: false, result: null, pendingFiles: [] })}
              >
                关闭
              </Button>
            );
          })()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

