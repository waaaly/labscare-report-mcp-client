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
import { Loader2, Send, Paperclip, X, Image as ImageIcon, File as FileIcon, Square, RefreshCw, Search, XCircle, Download, Folder, AlertTriangle, FolderOpen, FileJson, FileText, Image } from 'lucide-react';
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
  }>({ open: false, result: null });

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

  interface DirectoryStructure {
    topLevelDir: string;
    testCases: {
      name: string;
      hasRawReportDir: boolean;
      hasMaterialDir: boolean;
      rawReportFiles: string[];
      materialFiles: string[];
      missingJson: boolean;
      missingMd: boolean;
      missingImages: boolean;
    }[];
    isValid: boolean;
    errors: string[];
  }

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
          hasRawReportDir: false,
          hasMaterialDir: false,
          rawReportFiles: [],
          materialFiles: [],
          missingJson: true,
          missingMd: true,
          missingImages: true
        });
        result.isValid = false;
        result.errors.push(`测试用例 "${testCaseName}" 不是有效的目录`);
        return;
      }

      const hasRawReportDir = testCase.children?.includes('原始报告文件夹') || false;
      const hasMaterialDir = testCase.children?.includes('报告物料文件') || false;
      
      const rawReportFiles: string[] = [];
      const materialFiles: string[] = [];
      let missingJson = true;
      let missingMd = true;
      let missingImages = true;

      if (hasRawReportDir) {
        const rawReportPath = `${testCasePath}/原始报告文件夹`;
        const rawReport = pathMap.get(rawReportPath);
        if (rawReport && rawReport.children) {
          rawReport.children.forEach(child => {
            const filePath = `${rawReportPath}/${child}`;
            const fileEntry = pathMap.get(filePath);
            if (fileEntry?.type === 'file') {
              rawReportFiles.push(child);
              if (child.toLowerCase().endsWith('.json')) {
                missingJson = false;
              }
            }
          });
        }
      }

      if (hasMaterialDir) {
        const materialPath = `${testCasePath}/报告物料文件`;
        const material = pathMap.get(materialPath);
        if (material && material.children) {
          material.children.forEach(child => {
            const filePath = `${materialPath}/${child}`;
            const fileEntry = pathMap.get(filePath);
            if (fileEntry?.type === 'file') {
              materialFiles.push(child);
              if (child.toLowerCase().endsWith('.md')) {
                missingMd = false;
              }
              if (child.match(/\.(jpg|jpeg|png|gif|bmp)$/i)) {
                missingImages = false;
              }
            }
          });
        }
      }

      result.testCases.push({
        name: testCaseName,
        hasRawReportDir,
        hasMaterialDir,
        rawReportFiles,
        materialFiles,
        missingJson,
        missingMd,
        missingImages
      });

      if (!hasRawReportDir) {
        result.isValid = false;
        result.errors.push(`测试用例 "${testCaseName}" 缺少 "原始报告文件夹"`);
      }
      if (!hasMaterialDir) {
        result.isValid = false;
        result.errors.push(`测试用例 "${testCaseName}" 缺少 "报告物料文件" 文件夹`);
      }
      if (hasRawReportDir && missingJson) {
        result.isValid = false;
        result.errors.push(`测试用例 "${testCaseName}" 的 "原始报告文件夹" 缺少 JSON 数据文件（样品数据.json 或 流程数据.json）`);
      }
      if (hasMaterialDir && missingMd) {
        result.isValid = false;
        result.errors.push(`测试用例 "${testCaseName}" 的 "报告物料文件" 缺少 Markdown 描述文件（.md）`);
      }
      if (hasMaterialDir && missingImages) {
        result.isValid = false;
        result.errors.push(`测试用例 "${testCaseName}" 的 "报告物料文件" 缺少占位模板图片（.jpg, .png 等）`);
      }
    });

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
    
    if (!validation.isValid) {
      setValidationDialog({ open: true, result: validation });
      e.currentTarget.value = '';
      return;
    }
    
    if (files.length > 0) addFiles(files);
    e.currentTarget.value = '';
  }, [addFiles, validateDirectoryStructure]);

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
    const files = attachments.map(a => a.file);

    if (attachments.length > 0) {
      setAttachments(prev => {
        prev.forEach(i => i.preview && URL.revokeObjectURL(i.preview));
        return [];
      });
      onFilesChange?.([]);
    }
    onSend(localInput);
    setLocalInput('');
  }, [onSend,  localInput, setLocalInput, attachments, onFilesChange]);

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
                      disabled={(!localInput.trim() && attachments.length === 0)}
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

    {/* 目录结构验证失败弹窗 */}
    <Dialog open={validationDialog.open} onOpenChange={(open) => setValidationDialog(prev => ({ ...prev, open }))}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>目录结构验证失败</DialogTitle>
          </div>
          <DialogDescription>
            上传的文件夹不符合系统要求，请检查以下问题后重新上传
          </DialogDescription>
        </DialogHeader>

        {validationDialog.result && (
          <div className="flex-1 overflow-auto space-y-4 pr-1">
            {/* 全局错误 */}
            {validationDialog.result.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  全局问题
                </h4>
                <div className="space-y-1.5">
                  {validationDialog.result.errors.map((err, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-sm rounded-md bg-destructive/5 border border-destructive/10 p-2.5"
                    >
                      <span className="mt-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive/10 text-destructive text-xs font-medium flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-foreground/90 leading-relaxed">{err}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 测试用例明细 */}
            {validationDialog.result.testCases.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  测试用例检查明细
                </h4>
                <div className="space-y-2">
                  {validationDialog.result.testCases.map((tc, idx) => {
                    const tcErrors: string[] = [];
                    if (!tc.hasRawReportDir) tcErrors.push('缺少"原始报告文件夹"');
                    if (!tc.hasMaterialDir) tcErrors.push('缺少"报告物料文件"文件夹');
                    if (tc.missingJson) tcErrors.push('原始报告文件夹缺少 JSON 数据文件');
                    if (tc.missingMd) tcErrors.push('报告物料文件缺少 Markdown 描述文件');
                    if (tc.missingImages) tcErrors.push('报告物料文件缺少占位模板图片');
                    const isValid = tcErrors.length === 0;

                    return (
                      <div
                        key={idx}
                        className={cn(
                          'rounded-lg border p-3 space-y-2',
                          isValid
                            ? 'bg-green-500/5 border-green-500/20'
                            : 'bg-destructive/5 border-destructive/10'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{tc.name}</span>
                          <Badge
                            variant={isValid ? 'default' : 'destructive'}
                            className={cn(
                              'text-xs',
                              isValid && 'bg-green-500 hover:bg-green-600'
                            )}
                          >
                            {isValid ? '通过' : '未通过'}
                          </Badge>
                        </div>

                        {!isValid && (
                          <div className="space-y-1.5">
                            {tcErrors.map((err, eidx) => (
                              <div key={eidx} className="flex items-center gap-2 text-xs text-destructive/90">
                                <XCircle className="h-3 w-3 flex-shrink-0" />
                                {err}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 文件清单 */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {tc.hasRawReportDir && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <FolderOpen className="h-3 w-3" />
                                原始报告文件夹
                                {tc.missingJson && <XCircle className="h-3 w-3 text-destructive" />}
                                {!tc.missingJson && <Badge variant="secondary" className="text-[10px] h-4 px-1">OK</Badge>}
                              </div>
                              <div className="space-y-0.5">
                                {tc.rawReportFiles.length > 0 ? tc.rawReportFiles.map((f, fidx) => (
                                  <div key={fidx} className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                    <FileJson className="h-3 w-3 text-blue-400" />
                                    {f}
                                  </div>
                                )) : (
                                  <span className="text-[11px] text-muted-foreground/50">空文件夹</span>
                                )}
                              </div>
                            </div>
                          )}
                          {tc.hasMaterialDir && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <FolderOpen className="h-3 w-3" />
                                报告物料文件
                                {(tc.missingMd || tc.missingImages) && <XCircle className="h-3 w-3 text-destructive" />}
                                {!tc.missingMd && !tc.missingImages && <Badge variant="secondary" className="text-[10px] h-4 px-1">OK</Badge>}
                              </div>
                              <div className="space-y-0.5">
                                {tc.materialFiles.length > 0 ? tc.materialFiles.map((f, fidx) => (
                                  <div key={fidx} className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                    {f.toLowerCase().endsWith('.md') ? (
                                      <FileText className="h-3 w-3 text-orange-400" />
                                    ) : (
                                      <Image className="h-3 w-3 text-green-400" />
                                    )}
                                    {f}
                                  </div>
                                )) : (
                                  <span className="text-[11px] text-muted-foreground/50">空文件夹</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 目录结构说明 */}
            <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">期望的目录结构</h4>
              <div className="font-mono text-xs text-muted-foreground space-y-0.5 leading-relaxed">
                <div className="flex items-center gap-1.5">
                  <Folder className="h-3.5 w-3.5 text-blue-400" />
                  <span>顶层目录/</span>
                </div>
                <div className="pl-4 flex items-center gap-1.5">
                  <Folder className="h-3.5 w-3.5 text-blue-400" />
                  <span>测试用例1/</span>
                </div>
                <div className="pl-8 flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                  <span>原始报告文件夹/</span>
                  <span className="text-[10px] text-destructive/70">(需包含 .json)</span>
                </div>
                <div className="pl-8 flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                  <span>报告物料文件/</span>
                  <span className="text-[10px] text-destructive/70">(需包含 .md + 图片)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setValidationDialog({ open: false, result: null })}
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

