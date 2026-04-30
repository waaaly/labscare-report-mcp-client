import { create } from 'zustand';

export interface FileAttachment {
  name: string;
  type: 'image' | 'json' | 'md' | 'file';
  content?: string;
  url?: string;
  size?: number;
  preview?: string;
}

export interface Message {
  id?: string;
  conversationId?: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  contentType?: string;
  messageType?: string | null;
  toolName?: string | null;
  toolInput?: Record<string, unknown> | null;
  toolOutput?: Record<string, unknown> | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  attachments?: FileAttachment[];
  metadata?: Record<string, unknown>;
  sequence?: number;
  createdAt?: string;
  isStreaming?: boolean;
  timestamp?: number;
  files?: FileAttachment[];
}

export interface Conversation {
  id: string;
  title?: string;
  model?: string;
  labId?: string | null;
  projectId?: string | null;
  reportId?: string | null;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalTokens?: number;
  messageCount?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  messages?: Message[];
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
      set({ conversations: result.data });
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
      set({ currentMessages: result.data.messages || [] });
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
      set((state) => ({
        conversations: [result.data, ...state.conversations],
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
