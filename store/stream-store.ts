'use client';

import { useState, useCallback, useRef } from 'react';
import { Message } from './conversation-store';

export interface StreamEvent {
  type: 'content' | 'thought' | 'tool_call' | 'tool_result' | 'status' | 'metrics';
  text?: string;
  message?: string;
  tool?: string;
  token_usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  node?: string;
}

export interface StreamState {
  messages: Message[];
  isStreaming: boolean;
  currentStatus: string | null;
  currentTokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
  conversationTokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  requestCount: number;
  usageHistory: Array<{
    content: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }>;
}

const initialState: StreamState = {
  messages: [],
  isStreaming: false,
  currentStatus: null,
  currentTokenUsage: null,
  conversationTokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  requestCount: 0,
  usageHistory: [],
};

export function useStreamStore(initialMessages: Message[] = []) {
  const [state, setState] = useState<StreamState>({
    ...initialState,
    messages: initialMessages,
  });

  const lastUserMessageRef = useRef<{ text: string; files: File[] } | null>(null);

  const setMessages = useCallback((messages: Message[]) => {
    setState(prev => ({ ...prev, messages }));
  }, []);

  const appendMessage = useCallback((message: Message) => {
    setState(prev => ({ ...prev, messages: [...prev.messages, message] }));
  }, []);

  const updateLastMessage = useCallback((updater: (message: Message) => Message) => {
    setState(prev => {
      if (prev.messages.length === 0) return prev;
      const updated = [...prev.messages];
      updated[updated.length - 1] = updater(updated[updated.length - 1]);
      return { ...prev, messages: updated };
    });
  }, []);

  const updateMessages = useCallback((updater: (messages: Message[]) => Message[]) => {
    setState(prev => ({ ...prev, messages: updater(prev.messages) }));
  }, []);

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    setState(prev => {
      let newMessages = [...prev.messages];
      let newState = { ...prev };

      switch (event.type) {
        case 'content':
          if (event.text) {
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg?.messageType === 'content' || (lastMsg?.role === 'ASSISTANT' && !lastMsg?.messageType)) {
              newMessages = [
                ...newMessages.slice(0, -1),
                { ...lastMsg, content: lastMsg.content + event.text, messageType: 'content', isStreaming: true },
              ];
            } else {
              newMessages = [
                ...newMessages,
                {
                  role: 'ASSISTANT',
                  content: event.text,
                  messageType: 'content',
                  isStreaming: true,
                  timestamp: Date.now(),
                },
              ];
            }
          }
          break;

        case 'thought':
          if (event.text) {
            if (event.node === 'tools') {
              for (let i = newMessages.length - 1; i >= 0; i--) {
                if (newMessages[i].messageType === 'tool_call' && newMessages[i].isStreaming) {
                  newMessages = [...newMessages];
                  newMessages[i] = {
                    ...newMessages[i],
                    content: newMessages[i].content + '\n' + event.text,
                    isStreaming: false,
                  };
                  break;
                }
              }
            } else {
              newMessages = [
                ...newMessages.map(msg =>
                  msg.messageType === 'thought' ? { ...msg, isStreaming: false } : msg
                ),
                {
                  role: 'ASSISTANT',
                  content: event.text,
                  messageType: 'thought',
                  isStreaming: true,
                  timestamp: Date.now(),
                },
              ];
            }
          }
          break;

        case 'tool_call':
          if (event.message && event.tool) {
            newMessages = [
              ...newMessages,
              {
                role: 'ASSISTANT',
                content: event.message,
                messageType: 'tool_call',
                toolName: event.tool,
                isStreaming: true,
                timestamp: Date.now(),
              },
            ];
          }
          break;

        case 'tool_result':
          if (event.text) {
            try {
              const resultData = JSON.parse(event.text);
              const resultContent = resultData.success
                ? `✅ ${resultData.message || '执行成功'}\n\n${JSON.stringify(resultData.data, null, 2)}`
                : `❌ ${resultData.message || '执行失败'}`;
              
              let found = false;
              for (let i = newMessages.length - 1; i >= 0; i--) {
                if (newMessages[i].messageType === 'tool_call' && newMessages[i].isStreaming) {
                  newMessages = [...newMessages];
                  newMessages[i] = {
                    ...newMessages[i],
                    content: newMessages[i].content + '\n\n' + resultContent,
                    isStreaming: false,
                  };
                  found = true;
                  break;
                }
              }
              if (!found) {
                newMessages = [
                  ...newMessages,
                  {
                    role: 'ASSISTANT',
                    content: resultContent,
                    messageType: 'tool_result',
                    isStreaming: false,
                    timestamp: Date.now(),
                  },
                ];
              }
            } catch {
              newMessages = [
                ...newMessages,
                {
                  role: 'ASSISTANT',
                  content: `工具执行结果:\n${event.text}`,
                  messageType: 'tool_result',
                  isStreaming: false,
                  timestamp: Date.now(),
                },
              ];
            }
          }
          break;

        case 'status':
          newState.currentStatus = event.text || null;
          break;

        case 'metrics':
          if (event.token_usage) {
            const usage = event.token_usage;
            newState.currentTokenUsage = usage;
            newState.conversationTokenUsage = {
              inputTokens: prev.conversationTokenUsage.inputTokens + (usage.inputTokens || 0),
              outputTokens: prev.conversationTokenUsage.outputTokens + (usage.outputTokens || 0),
              totalTokens: prev.conversationTokenUsage.totalTokens + (usage.totalTokens || 0),
            };
            newState.requestCount = prev.requestCount + 1;
            newState.usageHistory = [
              ...prev.usageHistory,
              {
                content: lastUserMessageRef.current?.text || '',
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0,
                totalTokens: usage.totalTokens || 0,
              },
            ];
          }
          break;
      }

      return { ...newState, messages: newMessages };
    });
  }, []);

  const finishStreaming = useCallback(() => {
    setState(prev => ({
      ...prev,
      isStreaming: false,
      messages: prev.messages.map(msg => ({ ...msg, isStreaming: false })),
      currentStatus: null,
    }));
  }, []);

  const startStreaming = useCallback(() => {
    setState(prev => ({ ...prev, isStreaming: true }));
  }, []);

  const setLastUserMessage = useCallback((text: string, files: File[]) => {
    lastUserMessageRef.current = { text, files };
  }, []);

  const getLastUserMessage = useCallback(() => {
    return lastUserMessageRef.current;
  }, []);

  const resetTokenUsage = useCallback(
    (
      initialUsage?: { inputTokens: number; outputTokens: number; totalTokens: number },
      history?: Array<{
        content: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      }>,
    ) => {
      setState(prev => ({
        ...prev,
        conversationTokenUsage: initialUsage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        currentTokenUsage: null,
        requestCount: history?.length || 0,
        usageHistory: history || [],
      }));
    },
    [],
  );

  const setConversationTokenUsage = useCallback(
    (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => {
      setState(prev => ({ ...prev, conversationTokenUsage: usage }));
    },
    [],
  );

  return {
    ...state,
    setMessages,
    appendMessage,
    updateLastMessage,
    updateMessages,
    handleStreamEvent,
    finishStreaming,
    startStreaming,
    setLastUserMessage,
    getLastUserMessage,
    resetTokenUsage,
    setConversationTokenUsage,
  };
}