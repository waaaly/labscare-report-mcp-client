'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ConversationSidebar from '@/components/conversation/ConversationSidebar';
import ChatArea from '@/components/conversation/ChatArea';
import AgentToolPanel from '@/components/conversation/AgentToolPanel';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export default function LLMConversationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [conversations, setConversations] = useState<{ id: string; title: string; createdAt: number }[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef("");
  const frameRef = useRef<number | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  const addLog = useCallback((line: string) => {
    const t = new Date().toLocaleTimeString();
    setLogs(prev => {
      const next = [...prev, `${t} ${line}`];
      return next.slice(-200);
    });
  }, []);

  const LS_CONV_LIST = 'conversation:list:v1';
  const LS_CUR_ID = 'conversation:currentId:v1';
  const msgKey = useCallback((id: string) => `conversation:${id}:messages:v1`, []);

  useEffect(() => {
    const listRaw = typeof window !== 'undefined' ? localStorage.getItem(LS_CONV_LIST) : null;
    let list: { id: string; title: string; createdAt: number }[] = [];
    if (listRaw) {
      try {
        list = JSON.parse(listRaw);
      } catch { }
    }
    if (!list || list.length === 0) {
      const id = Math.random().toString(36).slice(2);
      list = [{ id, title: 'New Conversation', createdAt: Date.now() }];
      localStorage.setItem(LS_CONV_LIST, JSON.stringify(list));
      localStorage.setItem(LS_CUR_ID, id);
      localStorage.setItem(msgKey(id), JSON.stringify([]));
    }
    setConversations(list);
    const cur = localStorage.getItem(LS_CUR_ID) || list[0].id;
    setCurrentId(cur);
    const msgsRaw = localStorage.getItem(msgKey(cur));
    if (msgsRaw) {
      try {
        setMessages(JSON.parse(msgsRaw));
      } catch {
        setMessages([]);
      }
    }
  }, [msgKey]);

  useEffect(() => {
    if (!currentId) return;
    try {
      localStorage.setItem(msgKey(currentId), JSON.stringify(messages));
    } catch { }
  }, [messages, currentId, msgKey]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CONV_LIST, JSON.stringify(conversations));
      if (currentId) localStorage.setItem(LS_CUR_ID, currentId);
    } catch { }
  }, [conversations, currentId]);

  const createNewConversation = useCallback(() => {
    const id = Math.random().toString(36).slice(2);
    const conv = { id, title: 'New Conversation', createdAt: Date.now() };
    const next = [conv, ...conversations];
    setConversations(next);
    setCurrentId(id);
    setMessages([]);
    setInput('');
    try {
      localStorage.setItem(msgKey(id), JSON.stringify([]));
    } catch { }
  }, [conversations, msgKey]);

  const selectConversation = useCallback((id: string) => {
    if (id === currentId) return;
    try {
      const raw = localStorage.getItem(msgKey(id));
      const nextMsgs = raw ? JSON.parse(raw) : [];
      setMessages(nextMsgs);
    } catch {
      setMessages([]);
    }
    setCurrentId(id);
    setInput('');
  }, [currentId, msgKey]);

  const handleSend = useCallback(async (inputText: string) => {
    // console.log('handleSend', inputText, selectedFiles);
    if (!inputText.trim() && selectedFiles.length === 0) return;

    const userMessage: Message = {
      role: 'user',
      content: inputText.trim(),
    };
    const newMessages = !inputText.trim()
      ? [...messages]
      : [...messages, userMessage];
    setMessages([...newMessages, { role: 'assistant', content: "", isStreaming: true }]);
    if (inputText.trim()) setInput('');
    setIsLoading(true);
    if (inputText.trim()) addLog(inputText.trim());
    if (selectedFiles.length > 0) {
      addLog(`Files: ${selectedFiles.map(f => f.name).join(', ')}`);
    }

    try {
      let response: Response;
      const formData = new FormData();
      formData.append('prompt', input.trim());
      formData.append('contextJson', JSON.stringify({ conversationId: currentId, messagesCount: newMessages.length }));
      formData.append('messagesJson', JSON.stringify(newMessages));
      if (selectedFiles.length > 0) {
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });
      }
      response = await fetch('/api/llm', {
        method: 'POST',
        body: formData,
      });


      if (!response.ok) {
        throw new Error('API request failed');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      bufferRef.current = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const bytes = value;
        const SLICE = 50;
        if (bytes && bytes.byteLength > SLICE) {
          let i = 0;
          const total = Math.ceil(bytes.byteLength / SLICE);
          while (i < bytes.byteLength) {
            const startTime = performance.now();
            while (i < bytes.byteLength && performance.now() - startTime < 16) {
              const sub = bytes.subarray(i, Math.min(i + SLICE, bytes.byteLength));
              i += SLICE;
              const piece = decoder.decode(sub, { stream: true });
              bufferRef.current += piece;
              addLog(`Chunk part ${Math.ceil(i / SLICE)}/${total} ${sub.byteLength}B`);
            }
            if (!frameRef.current) {
              frameRef.current = requestAnimationFrame(() => {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1].content = bufferRef.current;
                  return updated;
                });
                scrollToBottom(false);
                frameRef.current = null;
              });
            }
            await new Promise(requestAnimationFrame);
          }
        } else {
          const chunk = decoder.decode(bytes, { stream: true });
          bufferRef.current += chunk;
          addLog(`Chunk ${bytes?.byteLength ?? 0}B`);
          if (!frameRef.current) {
            frameRef.current = requestAnimationFrame(() => {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].content = bufferRef.current;
                return updated;
              });
              scrollToBottom(false);
              frameRef.current = null;
            });
          }
        }

      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].isStreaming = false;
        return updated;
      });
      scrollToBottom(true);
      addLog('Completed');

      if (conversations.length > 0 && currentId) {
        const hasTitle = conversations.find(c => c.id === currentId)?.title && conversations.find(c => c.id === currentId)?.title !== 'New Conversation';
        if (!hasTitle) {
          const preview = (userMessage.content || '[Attachment]').slice(0, 30);
          setConversations(prev => prev.map(c => (c.id === currentId ? { ...c, title: preview || 'Conversation' } : c)));
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = 'Sorry, I encountered an error. Please try again.';
        updated[updated.length - 1].isStreaming = false;
        return updated;
      });
      addLog('Error');
    } finally {
      setIsLoading(false);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (selectedFiles.length > 0) {
        // 清理已发送文件引用
        // 仅清空选中文件状态，实际文件释放由子组件负责 revokeObjectURL
        // 避免再次复用旧文件
        // eslint-disable-next-line react-hooks/exhaustive-deps
        setSelectedFiles([]);
      }
    }
  }, [input, messages, scrollToBottom, addLog, conversations, currentId, selectedFiles]);

  const handleSendFiles = useCallback((files: File[]) => {
    setSelectedFiles(files);
    if (files?.length) {
      addLog(`Files: ${files.map(f => f.name).join(', ')}`);
    }
  }, [addLog]);

  return (
    <div className="flex gap-4 h-[calc(100vh-var(--header-h,10rem))] overflow-hidden bg-background">
      <div className="w-[260px] h-full border-r flex-shrink-0">
        <ConversationSidebar
          conversations={conversations}
          currentId={currentId}
          onSelect={selectConversation}
          onNew={createNewConversation}
        />
      </div>
      <div className="flex-1 h-full flex flex-col min-w-0">
        <ChatArea
          title={conversations.find(c => c.id === currentId)?.title || 'Chat'}
          messages={messages}
          isLoading={isLoading}
          input={input}
          onSend={handleSend}
          messagesEndRef={messagesEndRef}
          onSendFiles={handleSendFiles}
        />
      </div>
      <div className="w-[320px] h-full border-l flex-shrink-0">
        <AgentToolPanel logs={logs} />
      </div>
    </div>
  );
}
