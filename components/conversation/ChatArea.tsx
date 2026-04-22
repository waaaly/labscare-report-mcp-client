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
import { Loader2, Send, Paperclip, X, Image as ImageIcon, File as FileIcon, Square, RefreshCw, Search, XCircle, Download } from 'lucide-react';
import React, { useEffect } from 'react';
import { VirtualizedMessages, Msg } from './VirtualizedMessages';


type Props = {
  title?: string;
  messages: Msg[];
  isLoading: boolean;
  input: string;
  onSend: (input: string) => void;
  onStop?: () => void;
  onRegenerate?: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
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
}: Props) {
  const [attachments, setAttachments] = React.useState<{ file: File; type: 'image' | 'json' | 'md'; preview?: string; previewText?: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [localInput, setLocalInput] = React.useState(input);
  const [showSearch, setShowSearch] = React.useState(false);

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

  const handleDrop = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

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
      <CardContent className="flex-1 overflow-auto">
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
                    <Button
                      size="icon"
                      type="button"
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 w-9 rounded-full"
                      aria-label="Attach files"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
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
  );
}

