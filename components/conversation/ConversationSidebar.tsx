'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Check,
  X,
  Clock,
  Search,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  messageCount?: number;
  preview?: string;
};

type Props = {
  conversations: Conversation[];
  currentId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
};

export default function ConversationSidebar({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedConversations = {
    today: filteredConversations.filter(
      (c) => new Date(c.createdAt).toDateString() === new Date().toDateString()
    ),
    yesterday: filteredConversations.filter((c) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return new Date(c.createdAt).toDateString() === yesterday.toDateString();
    }),
    older: filteredConversations.filter((c) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return new Date(c.createdAt) < yesterday;
    }),
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const handleStartEdit = (c: Conversation) => {
    setEditingId(c.id);
    setEditingTitle(c.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editingTitle.trim()) {
      onRename(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const renderConversationItem = (c: Conversation) => (
    <div
      key={c.id}
      className={cn(
        'group relative rounded-xl transition-all duration-200 cursor-pointer',
        c.id === currentId
          ? 'bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-200 dark:border-violet-800'
          : 'hover:bg-muted/60'
      )}
    >
      <button
        onClick={() => !editingId && onSelect(c.id)}
        className="w-full text-left p-3"
        disabled={editingId !== null}
      >
        {editingId === c.id ? (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-8 text-sm"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleSaveEdit}>
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleCancelEdit}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'p-1.5 rounded-lg shrink-0 mt-0.5',
                c.id === currentId
                  ? 'bg-violet-500/20'
                  : 'bg-muted group-hover:bg-muted-foreground/10'
              )}
            >
              <MessageSquare
                className={cn(
                  'h-3.5 w-3.5',
                  c.id === currentId ? 'text-violet-600' : 'text-muted-foreground'
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'font-medium text-sm truncate',
                    c.id === currentId ? 'text-violet-700 dark:text-violet-300' : ''
                  )}
                >
                  {c.title || '新对话'}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatTime(c.createdAt)}
                </span>
              </div>
              {c.preview && (
                <p className="text-xs text-muted-foreground truncate mt-1">{c.preview}</p>
              )}
            </div>
          </div>
        )}
      </button>

      {/* 操作按钮 */}
      {editingId !== c.id && (
        <div
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 p-1 rounded-lg bg-background/95 backdrop-blur border shadow-sm',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
        >
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit(c);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(c.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );

  const renderGroup = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-3 py-2">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
            {items.length}
          </span>
        </div>
        <div className="space-y-1 px-2">{items.map(renderConversationItem)}</div>
      </div>
    );
  };

  return (
    <>
      <Card className="h-full flex flex-col bg-gradient-to-b from-background to-muted/20">
        {/* 头部 */}
        <div className="p-4 border-b bg-gradient-to-r from-violet-500/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold">对话列表</span>
            </div>
            <Button
              size="sm"
              onClick={onNew}
              className="gap-1.5 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white shadow-md shadow-violet-500/20"
            >
              <Plus className="h-3.5 w-3.5" />
              新对话
            </Button>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索对话..."
              className="pl-8 h-9 text-sm bg-muted/50 border-transparent focus:border-violet-200"
            />
          </div>
        </div>

        {/* 对话列表 */}
        <CardContent className="flex-1 overflow-auto p-2 space-y-2">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-full bg-muted mb-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? '未找到匹配的对话' : '暂无对话记录'}
              </p>
              {!searchQuery && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={onNew}
                  className="mt-2 text-violet-600"
                >
                  开始新对话
                </Button>
              )}
            </div>
          ) : (
            <>
              {renderGroup('今天', groupedConversations.today)}
              {renderGroup('昨天', groupedConversations.yesterday)}
              {renderGroup('更早', groupedConversations.older)}
            </>
          )}
        </CardContent>
      </Card>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除对话</DialogTitle>
            <DialogDescription>
              确定要删除这个对话吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
