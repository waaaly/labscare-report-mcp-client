'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, MessageSquare, Trash2, Pencil, Check, X } from 'lucide-react';

type Conversation = {
  id: string;
  title: string;
  createdAt: number;
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

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Conversations</CardTitle>
          <Button size="sm" variant="secondary" onClick={onNew} className="gap-1">
            <Plus className="h-4 w-4" />
            New
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <div className="divide-y">
            {conversations.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No conversations</div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-2 p-3 transition-colors ${
                    c.id === currentId ? 'bg-muted' : 'hover:bg-muted/60'
                  }`}
                >
                  <button
                    onClick={() => !editingId && onSelect(c.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                    disabled={editingId !== null}
                  >
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      {editingId === c.id ? (
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 text-sm"
                          autoFocus
                        />
                      ) : (
                        <>
                          <div className="truncate font-medium">{c.title || 'Untitled'}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleString()}
                          </div>
                        </>
                      )}
                    </div>
                  </button>

                  {/* 操作按钮 - 仅在非编辑状态显示 */}
                  {editingId !== c.id && (
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(c);
                        }}
                        aria-label="Rename conversation"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(c.id);
                        }}
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* 编辑状态按钮 */}
                  {editingId === c.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit();
                        }}
                        aria-label="Save"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        aria-label="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

