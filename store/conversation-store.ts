import { create } from 'zustand';

export interface FileAttachment {
  name: string;
  type: 'image' | 'json' | 'md';
  content: string;
  preview?: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  messageType?: 'thought' | 'tool_call' | 'status' | 'content';
  tool?: string;
  files?: FileAttachment[];
  timestamp?: number;
  branchId?: string;
  parentId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  model?: string;
  labId?: string;
  projectId?: string;
  reportId?: string;
  createdAt: number;
  updatedAt?: number;
  preview?: string;
}

interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  currentMessages: Message[];
  isLoading: boolean;
  error: string | null;

  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  setCurrentMessages: (messages: Message[]) => void;
  updateMessages: (updater: (prev: Message[]) => Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createConversation: (title?: string, model?: string) => Promise<string>;
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  currentMessages: [],
  isLoading: false,
  error: null,

  setConversations: (conversations) => set({ conversations }),

  setCurrentConversationId: (id) => set({ currentConversationId: id }),

  setCurrentMessages: (messages) => set({ currentMessages: messages }),

  updateMessages: (updater) =>
    set((state) => ({
      currentMessages: updater(state.currentMessages),
    })),

  addMessage: (message) =>
    set((state) => ({
      currentMessages: [...state.currentMessages, message],
    })),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.currentMessages];
      const lastIndex = messages.length - 1;
      if (lastIndex >= 0) {
        messages[lastIndex] = { ...messages[lastIndex], content };
      }
      return { currentMessages: messages };
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  loadConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/conversations');
      if (!response.ok) throw new Error('Failed to load conversations');
      const result = await response.json();
      const conversations = result.data.map((conv: any) => ({
        id: conv.id,
        title: conv.title,
        model: conv.model,
        labId: conv.labId,
        projectId: conv.projectId,
        reportId: conv.reportId,
        createdAt: new Date(conv.createdAt).getTime(),
        updatedAt: conv.updatedAt ? new Date(conv.updatedAt).getTime() : undefined,
      }));
      set({ conversations });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load conversations' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadConversation: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/conversations/${id}?messages=true`);
      if (!response.ok) throw new Error('Failed to load conversation');
      const result = await response.json();
      const messages = result.data.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messageType: msg.messageType,
        tool: msg.tool,
        timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : undefined,
        files: msg.attachments?.map((att: any) => ({
          name: att.name,
          type: att.type,
          content: att.content,
        })),
      }));
      set({ currentMessages: messages });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load conversation' });
    } finally {
      set({ isLoading: false });
    }
  },

  createConversation: async (title = '新对话', model) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, model }),
      });
      if (!response.ok) throw new Error('Failed to create conversation');
      const result = await response.json();
      const newConversation: Conversation = {
        id: result.data.id,
        title,
        model,
        createdAt: Date.now(),
      };
      set((state) => ({
        conversations: [newConversation, ...state.conversations],
        currentConversationId: result.data.id,
        currentMessages: [],
      }));
      return result.data.id;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create conversation' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateConversation: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update conversation');
      set((state) => ({
        conversations: state.conversations.map((conv) =>
          conv.id === id ? { ...conv, ...updates } : conv
        ),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update conversation' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteConversation: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete conversation');
      set((state) => ({
        conversations: state.conversations.filter((conv) => conv.id !== id),
        currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
        currentMessages: state.currentConversationId === id ? [] : state.currentMessages,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete conversation' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));
