'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Conversation } from '@/store/conversation-store';

type Props = {
  conversations: Conversation[];
  currentId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  loading?: boolean;
};

const ConversationItem = ({
  conversation,
  currentId,
  editingId,
  editingTitle,
  onSelect,
  onStartEdit,
  onEditingTitleChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  conversation: Conversation;
  currentId: string;
  editingId: string | null;
  editingTitle: string;
  onSelect: (id: string) => void;
  onStartEdit: (c: Conversation) => void;
  onEditingTitleChange: (title: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}) => {
  const isEditing = editingId === conversation.id;
  const isSelected = conversation.id === currentId;

  const formatTime = (timestamp: number | string | undefined) => {
    if (!timestamp) return '';
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

  const handleSave = () => {
    if (editingTitle.trim()) {
      onSaveEdit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancelEdit();
  };

  return (
    <div
      key={conversation.id}
      className={cn(
        'group relative rounded-xl transition-all duration-200 cursor-pointer',
        isSelected
          ? 'bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-200 dark:border-violet-800'
          : 'hover:bg-muted/60'
      )}
    >
      {/* 使用 div 替代外层 button，避免嵌套 button */}
      <div
        onClick={() => !editingId && onSelect(conversation.id)}
        className="w-full text-left p-3"
      >
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editingTitle}
              onChange={(e) => {
                e.stopPropagation();
                onEditingTitleChange(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="h-8 text-sm"
              autoFocus
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              className="h-8 w-8 p-2 rounded-md hover:bg-muted transition-colors"
            >
              <Check className="h-3 w-3 text-green-600" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelEdit();
              }}
              className="h-8 w-8 p-2 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'p-1.5 rounded-lg shrink-0 mt-0.5',
                isSelected
                  ? 'bg-violet-500/20'
                  : 'bg-muted group-hover:bg-muted-foreground/10'
              )}
            >
              <MessageSquare
                className={cn(
                  'h-3.5 w-3.5',
                  isSelected ? 'text-violet-600' : 'text-muted-foreground'
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'font-medium text-sm truncate',
                    isSelected ? 'text-violet-700 dark:text-violet-300' : ''
                  )}
                >
                  {conversation.title || '新对话'}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatTime(conversation.createdAt)}
                </span>
              </div>
              {conversation.preview && (
                <p className="text-xs text-muted-foreground truncate mt-1">
                  {conversation.preview}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      {!isEditing && (
        <div
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 p-1 rounded-lg bg-background/95 backdrop-blur border shadow-sm',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit(conversation);
            }}
            className="h-6 w-6 p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conversation.id);
            }}
            className="h-6 w-6 p-1.5 rounded-md hover:bg-muted text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default function ConversationSidebar({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  loading,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const lowerQuery = searchQuery.toLowerCase();
    return conversations.filter((c) =>
      (c.title || '').toLowerCase().includes(lowerQuery)
    );
  }, [conversations, searchQuery]);

  const groupedConversations = useMemo(() => {
    // 获取今天的开始时间（00:00:00）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTs = todayStart.getTime();

    // 获取昨天的开始时间
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayStartTs = yesterdayStart.getTime();

    // 获取前天的开始时间（用于判断 older）
    const dayBeforeYesterdayStart = new Date(todayStart);
    dayBeforeYesterdayStart.setDate(dayBeforeYesterdayStart.getDate() - 2);
    const dayBeforeYesterdayStartTs = dayBeforeYesterdayStart.getTime();

    return {
      today: filteredConversations.filter(
        (c) => c.createdAt && new Date(c.createdAt).getTime() >= todayStartTs
      ),
      yesterday: filteredConversations.filter(
        (c) => c.createdAt && new Date(c.createdAt).getTime() >= yesterdayStartTs && new Date(c.createdAt).getTime() < todayStartTs
      ),
      older: filteredConversations.filter(
        (c) => c.createdAt && new Date(c.createdAt).getTime() < dayBeforeYesterdayStartTs
      ),
    };
  }, [filteredConversations]);

  const handleStartEdit = (c: Conversation) => {
    setEditingId(c.id);
    setEditingTitle(c.title || '');
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
        <div className="space-y-1 px-2">
          {items.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              currentId={currentId}
              editingId={editingId}
              editingTitle={editingTitle}
              onSelect={onSelect}
              onStartEdit={handleStartEdit}
              onEditingTitleChange={setEditingTitle}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onDelete={setDeleteId}
            />
          ))}
        </div>
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
        {loading ? (
          <CardContent className="flex-1 overflow-auto p-2 space-y-2">
            <div className="space-y-3 px-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        ) : (
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
        )}
      </Card>

      {/* 删除确认 Dialog */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
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
