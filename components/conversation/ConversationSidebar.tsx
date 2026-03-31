'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare } from 'lucide-react';

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
};

export default function ConversationSidebar({
  conversations,
  currentId,
  onSelect,
  onNew,
}: Props) {
  return (
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
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                  c.id === currentId ? 'bg-muted' : 'hover:bg-muted/60'
                }`}
                aria-selected={c.id === currentId}
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.title || 'Untitled'}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

