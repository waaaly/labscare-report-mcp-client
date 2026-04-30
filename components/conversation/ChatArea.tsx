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
import { Send, Paperclip, Square, RefreshCw, Search, XCircle, Download, Folder } from 'lucide-react';
import React from 'react';
import { VirtualizedMessages, Msg } from './VirtualizedMessages';
import UploadProgressDialog, { UploadFileItem, UploadFileResult } from './UploadProgressDialog';
import ValidatedStructurePanel, { DirectoryStructure } from './ValidatedStructurePanel';
import ValidationDialog from './ValidationDialog';
import AttachmentsPreview, { AttachmentItem } from './AttachmentsPreview';
import { useLabStore } from '@/store/lab-store';
import { BatchImportData, BatchImportDocument, BatchImportProject, BatchImportReport } from '@/lib/llm/prompt-templates';
import { validateDirectoryStructure, traverseFileTree } from '@/lib/directory-validation';

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
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  highlightedMessageIndex?: number | null;
  onHighlightedIndexChange?: (index: number | null) => void;
  onExport?: (format: 'markdown' | 'json') => void;
  currentBranchId?: string;
  onSwitchBranch?: (branchId: string) => void;
  branches?: { id: string; name: string; createdAt: number }[];
  onCreateBranch?: (messageIndex: number) => void;
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
  const [attachments, setAttachments] = React.useState<AttachmentItem[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);
  const [localInput, setLocalInput] = React.useState(input);
  const [showSearch, setShowSearch] = React.useState(false);
  const [validationDialog, setValidationDialog] = React.useState<{
    open: boolean;
    result: DirectoryStructure | null;
    pendingFiles: File[];
  }>({ open: false, result: null, pendingFiles: [] });

  const [validatedStructure, setValidatedStructure] = React.useState<{
    structure: DirectoryStructure;
    files: File[];
    previews: Map<string, { preview?: string; previewText?: string }>;
  } | null>(null);

  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [uploadDialogFiles, setUploadDialogFiles] = React.useState<UploadFileItem[]>([]);
  const [pendingBatchStructure, setPendingBatchStructure] = React.useState<DirectoryStructure | null>(null);
  const { currentLab } = useLabStore();

  const addFiles = React.useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    const next: AttachmentItem[] = [];
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
              try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch { }
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

  const handleFolderChange = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files: File[] = [];
    for (let i = 0; i < e.target.files.length; i++) {
      files.push(e.target.files[i]);
    }
    
    const validation = validateDirectoryStructure(files);
    setValidationDialog({ open: true, result: validation, pendingFiles: files });
    e.currentTarget.value = '';
  }, []);

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
  }, [addFiles]);

  const handleDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleSendClick = React.useCallback(() => {
    const attachmentFiles = attachments.map(a => a.file);
    const validatedFiles = validatedStructure?.files || [];

    if (attachments.length > 0 || validatedFiles.length > 0) {
      setAttachments(prev => {
        prev.forEach(i => i.preview && URL.revokeObjectURL(i.preview));
        return [];
      });
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
  }, [onSend, localInput, attachments, onFilesChange, validatedStructure]);

  const handleValidationConfirm = React.useCallback((structure: DirectoryStructure, uploadItems: UploadFileItem[]) => {
    setPendingBatchStructure(structure);
    setUploadDialogFiles(uploadItems);
    setUploadDialogOpen(true);
    setValidationDialog({ open: false, result: null, pendingFiles: [] });
  }, []);

  const handleUploadComplete = React.useCallback((results: UploadFileResult[]) => {
    if (!pendingBatchStructure || !currentLab) return;

    const resultMap = new Map<string, UploadFileResult>();
    results.forEach(r => { resultMap.set(r.relativePath, r); });

    const projects: BatchImportProject[] = pendingBatchStructure.testCases.map(tc => {
      const tcPrefix = `${pendingBatchStructure.topLevelDir}/${tc.name}`;

      const reports: BatchImportReport[] = tc.rawReportDirs.map(rd => {
        const rdPrefix = `${tcPrefix}/${rd.name}`;
        const documents: BatchImportDocument[] = [];

        rd.templatePngs.forEach(png => {
          const rp = `${rdPrefix}/${png}`;
          const uploadResult = resultMap.get(rp);
          if (uploadResult) {
            documents.push({
              fileName: uploadResult.fileName,
              url: uploadResult.url,
              storagePath: uploadResult.storagePath,
              size: uploadResult.size,
              contentType: uploadResult.contentType,
            });
          }
        });

        if (rd.descMd) {
          const rp = `${rdPrefix}/${rd.descMd}`;
          const uploadResult = resultMap.get(rp);
          if (uploadResult) {
            documents.push({
              fileName: uploadResult.fileName,
              url: uploadResult.url,
              storagePath: uploadResult.storagePath,
              size: uploadResult.size,
              contentType: uploadResult.contentType,
            });
          }
        }

        return { name: rd.name, documents };
      });

      return { name: tc.name, reports };
    });

    const batchImportData: BatchImportData = {
      action: 'batch_import',
      labName: currentLab.name,
      projects,
    };

    onSend(JSON.stringify(batchImportData));
    setUploadDialogOpen(false);
    setPendingBatchStructure(null);
  }, [pendingBatchStructure, currentLab, onSend]);

  const handleKeyPress = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  }, [handleSendClick]);

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
        (m) => !(m.role === 'ASSISTANT' && m.isStreaming && !m.content?.trim()) && m.messageType !== 'status'
      ),
    [messages]
  );

  const history = React.useMemo(() => {
    const arr = messages
      .filter((m) => m.role === 'USER' && m.content?.trim())
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

              <AttachmentsPreview
                attachments={attachments}
                onRemove={removeAttachment}
              />

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

    <ValidationDialog
      open={validationDialog.open}
      onOpenChange={(open) => setValidationDialog(prev => ({ ...prev, open }))}
      result={validationDialog.result}
      pendingFiles={validationDialog.pendingFiles}
      onConfirm={handleValidationConfirm}
    />

    <UploadProgressDialog
      open={uploadDialogOpen}
      onClose={() => {
        setUploadDialogOpen(false);
        setPendingBatchStructure(null);
        setUploadDialogFiles([]);
      }}
      files={uploadDialogFiles}
      onSend={handleUploadComplete}
    />
    </>
  );
}
