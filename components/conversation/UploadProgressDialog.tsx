'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Send, ChevronDown, ChevronRight } from 'lucide-react';

export interface UploadFileItem {
  relativePath: string;
  file: File;
}

export interface UploadFileResult {
  relativePath: string;
  fileName: string;
  url: string;
  storagePath: string;
  size: number;
  contentType: string;
}

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

interface FileState {
  item: UploadFileItem;
  status: FileStatus;
  result?: UploadFileResult;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  files: UploadFileItem[];
  onSend: (results: UploadFileResult[]) => void;
}

async function uploadWithRetry(
  file: File,
  relativePath: string,
  signal?: AbortSignal,
  maxRetries = 2
): Promise<UploadFileResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        signal,
      });
      if (res.ok) {
        const data = await res.json();
        return { ...data, relativePath };
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      if (attempt === maxRetries) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
  }
  throw new Error('Max retries exceeded');
}

export default function UploadProgressDialog({
  open,
  onClose,
  files,
  onSend,
}: Props) {
  const [fileStates, setFileStates] = React.useState<FileState[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());
  const abortControllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (open && files.length > 0) {
      const states: FileState[] = files.map((f) => ({
        item: f,
        status: 'pending' as FileStatus,
      }));
      setFileStates(states);
      setIsUploading(true);
    }
  }, [open, files]);

  React.useEffect(() => {
    if (!isUploading) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let cancelled = false;
    const pendingItems = fileStates.filter((s) => s.status === 'pending');

    if (pendingItems.length === 0) {
      setIsUploading(false);
      return;
    }

    const uploadAll = async () => {
      const concurrency = 3;
      const queue = [...pendingItems];

      const uploadNext = async (): Promise<void> => {
        if (cancelled || abortController.signal.aborted || queue.length === 0) return;
        const state = queue.shift()!;

        setFileStates((prev) =>
          prev.map((s) =>
            s.item.relativePath === state.item.relativePath
              ? { ...s, status: 'uploading' as FileStatus }
              : s
          )
        );

        try {
          const result = await uploadWithRetry(state.item.file, state.item.relativePath, abortController.signal);
          if (!cancelled && !abortController.signal.aborted) {
            setFileStates((prev) =>
              prev.map((s) =>
                s.item.relativePath === state.item.relativePath
                  ? { ...s, status: 'done' as FileStatus, result }
                  : s
              )
            );
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          if (!cancelled && !abortController.signal.aborted) {
            setFileStates((prev) =>
              prev.map((s) =>
                s.item.relativePath === state.item.relativePath
                  ? { ...s, status: 'error' as FileStatus, error: err?.message || '上传失败' }
                  : s
              )
            );
          }
        }

        await uploadNext();
      };

      const workers = Array.from({ length: concurrency }, () => uploadNext());
      await Promise.all(workers);

      if (!cancelled && !abortController.signal.aborted) {
        setIsUploading(false);
      }
    };

    uploadAll();
    return () => { cancelled = true; };
  }, [isUploading]);

  const retryFile = React.useCallback(async (relativePath: string) => {
    setFileStates((prev) =>
      prev.map((s) =>
        s.item.relativePath === relativePath
          ? { ...s, status: 'uploading' as FileStatus, error: undefined }
          : s
      )
    );

    const state = fileStates.find((s) => s.item.relativePath === relativePath);
    if (!state) return;

    try {
      const result = await uploadWithRetry(state.item.file, state.item.relativePath);
      setFileStates((prev) =>
        prev.map((s) =>
          s.item.relativePath === relativePath
            ? { ...s, status: 'done' as FileStatus, result }
            : s
        )
      );
    } catch (err: any) {
      setFileStates((prev) =>
        prev.map((s) =>
          s.item.relativePath === relativePath
            ? { ...s, status: 'error' as FileStatus, error: err?.message || '上传失败' }
            : s
        )
      );
    }
  }, [fileStates]);

  const retryAllFailed = React.useCallback(async () => {
    const failed = fileStates.filter((s) => s.status === 'error');
    for (const s of failed) {
      await retryFile(s.item.relativePath);
    }
  }, [fileStates, retryFile]);

  const handleSend = React.useCallback(() => {
    const results = fileStates
      .filter((s) => s.status === 'done' && s.result)
      .map((s) => s.result!);
    onSend(results);
  }, [fileStates, onSend]);

  const handleClose = React.useCallback(() => {
    abortControllerRef.current?.abort();
    setIsUploading(false);
    onClose();
  }, [onClose]);

  const doneCount = fileStates.filter((s) => s.status === 'done').length;
  const errorCount = fileStates.filter((s) => s.status === 'error').length;
  const totalCount = fileStates.length;
  const hasAnyDone = doneCount > 0;
  const allDone = doneCount === totalCount;

  const groupedByDir = React.useMemo(() => {
    const groups: Record<string, FileState[]> = {};
    fileStates.forEach((s) => {
      const parts = s.item.relativePath.split('/');
      const groupKey = parts.slice(0, -1).join('/') || '__root__';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(s);
    });
    return groups;
  }, [fileStates]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📤 正在上传文件...
            <Badge variant="secondary" className="text-[10px] h-5">
              {doneCount}/{totalCount}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-3 pr-1">
          {Object.entries(groupedByDir).map(([groupKey, states]) => {
            const groupDone = states.filter((s) => s.status === 'done').length;
            const isCollapsed = collapsedGroups.has(groupKey);

            return (
              <div key={groupKey} className="rounded-lg border bg-muted/20">
                <button
                  type="button"
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 rounded-t-lg transition-colors"
                  onClick={() => toggleGroup(groupKey)}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  <span className="truncate">{groupKey === '__root__' ? '根目录' : groupKey}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 ml-auto">
                    {groupDone}/{states.length}
                  </Badge>
                </button>

                {!isCollapsed && (
                  <div className="px-2 pb-2 space-y-1">
                    {states.map((s) => (
                      <div
                        key={s.item.relativePath}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1 rounded text-xs',
                          s.status === 'error' && 'bg-destructive/5'
                        )}
                      >
                        <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                          {s.status === 'uploading' && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                          )}
                          {s.status === 'done' && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          )}
                          {s.status === 'error' && (
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          )}
                          {s.status === 'pending' && (
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </span>
                        <span className="flex-1 truncate">
                          {s.item.file.name}
                        </span>
                        {s.status === 'error' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => retryFile(s.item.relativePath)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            重试
                          </Button>
                        )}
                        {s.status === 'done' && s.result && (
                          <span className="text-[10px] text-muted-foreground">
                            {(s.result.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {allDone
              ? '全部上传完成'
              : hasAnyDone
                ? `完成 ${doneCount} 个 · 失败 ${errorCount} 个`
                : errorCount === totalCount
                  ? '所有文件上传失败'
                  : '上传中...'}
          </div>
          <div className="flex gap-2">
            {errorCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={retryAllFailed}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                重试全部失败 ({errorCount})
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleSend}
              disabled={!hasAnyDone}
              title={!hasAnyDone ? (errorCount === totalCount ? '所有文件上传失败' : '请等待文件上传完成') : undefined}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              {allDone ? '发送到 Agent' : `发送 (仅 ${doneCount} 个成功)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
