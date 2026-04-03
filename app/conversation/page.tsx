'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Buffer } from 'buffer';
import ConversationSidebar from '@/components/conversation/ConversationSidebar';
import ChatArea from '@/components/conversation/ChatArea';
import AgentToolPanel from '@/components/conversation/AgentToolPanel';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  messageType?: 'thought' | 'tool_call' | 'status' | 'content';
  files?: FileAttachment[];
}

interface FileAttachment {
  name: string;
  type: 'image' | 'json' | 'md';
  content: string;
  preview?: string;
}

/**
 * TODO：
 * ### 第一阶段（核心功能）
1. ✅ 停止生成功能
2. ✅ 消息重新生成
3. ✅ 消息复制按钮
4. ✅ 代码高亮和复制
5. ✅ 对话删除和重命名
6. ✅ 文件删除（发送前）
### 第二阶段（体验优化）
1. ✅ Markdown 完整渲染
2. ✅ 快捷键支持
3. ✅ 消息时间戳
4. ✅ 拖拽上传文件
5. ✅ 图片放大查看
6. ✅ 工具调用可视化
### 第三阶段（高级功能）
1. ✅ 消息编辑和重新生成
2. ✅ 对话导出
3. ✅ 模型切换
4. ✅ 消息分支
5. ✅ 对话搜索
 * @returns 
 */
export default function LLMConversationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [conversations, setConversations] = useState<{ id: string; title: string; createdAt: number }[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    console.log('handleSend', inputText, selectedFiles);
    if (!inputText.trim() && selectedFiles.length === 0) return;

    // 处理文件附件
    const fileAttachments: FileAttachment[] = [];
    for (const file of selectedFiles) {
      try {
        if (file.type.startsWith('image/')) {
          const buffer = await file.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          fileAttachments.push({
            name: file.name,
            type: 'image',
            content: `data:${file.type};base64,${base64}`
          });
        } else if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
          const text = await file.text();
          let prettyText = text;
          try {
            const parsed = JSON.parse(text);
            prettyText = JSON.stringify(parsed, null, 2);
          } catch {}
          fileAttachments.push({
            name: file.name,
            type: 'json',
            content: prettyText
          });
        } else if (file.type === 'text/markdown' || file.name.toLowerCase().endsWith('.md')) {
          const text = await file.text();
          fileAttachments.push({
            name: file.name,
            type: 'md',
            content: text
          });
        }
      } catch (error) {
        console.error('Error processing file:', file.name, error);
      }
    }

    const userMessage: Message = {
      role: 'user',
      content: inputText.trim(),
      files: fileAttachments.length > 0 ? fileAttachments : undefined
    };

    // 只有当有文本内容或文件时才添加用户消息
    const shouldAddMessage = inputText.trim() || fileAttachments.length > 0;
    const newMessages = shouldAddMessage
      ? [...messages, userMessage]
      : [...messages];

    setMessages(newMessages);
    if (inputText.trim()) setInput('');
    setIsLoading(true);
    if (inputText.trim()) addLog(inputText.trim());
    if (selectedFiles.length > 0) {
      addLog(`Files: ${selectedFiles.map(f => f.name).join(', ')}`);
    }

    console.log('文件附件处理完成:', fileAttachments);
    console.log('用户消息:', userMessage);
    console.log('新消息列表:', newMessages);

    try {
      let response: Response;
      const formData = new FormData();
      formData.append('prompt', input.trim());
      formData.append('contextJson', JSON.stringify({ conversationId: currentId, messagesCount: newMessages.length }));
      const standardMessages = newMessages
        .filter(msg => !msg.isStreaming && msg.content)
        .map(msg => ({ role: msg.role, content: msg.content }));
      formData.append('messagesJson', JSON.stringify(standardMessages));
     
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
      let sseBuffer = "";
      console.log('[Client] 开始读取流式响应');

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[Client] 流式响应结束');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log('[Client] 收到数据块，大小:', chunk.length, 'bytes');
        sseBuffer += chunk;

        // 按行分割 SSE 消息
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || ''; // 保留未完成的行
        console.log('[Client] 处理 SSE 行数:', lines.length);
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // 移除 'data: ' 前缀
            if (data) {
              console.log('[Client] 收到原始SSE数据:', data);
              setIsLoading(false);
              try {
                const json = JSON.parse(data);
                console.log('[Client] 解析JSON成功，类型:', json.type, '内容:', json.text?.substring(0, 30) || json.tool || json.ttft || 'N/A');
                if (json.type === 'content' && json.text) {
                  setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    let newMessages: Message[];
                    if (lastMsg?.messageType === 'content' || (lastMsg?.role === 'assistant' && !lastMsg?.messageType)) {
                      newMessages = [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + json.text, messageType: 'content', isStreaming: true }];
                    } else {
                      newMessages = [...prev, { role: 'assistant', content: json.text, messageType: 'content', isStreaming: true }];
                    }
                    return newMessages;
                  });
                } else if (json.type === 'thought' && json.text) {
                  setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.messageType === 'thought') {
                      return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + json.text }];
                    } else {
                      return [...prev, { role: 'assistant', content: json.text, messageType: 'thought', isStreaming: true }];
                    }
                  });
                  console.log(`[Client] 处理thought消息，内容: "${json.text.substring(0, 30)}..."`);
                  addLog(`Thought: ${json.text.slice(0, 50)}...`);
                } else if (json.type === 'tool_call' && json.message) {
                  setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.messageType === 'tool_call') {
                      return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + json.message }];
                    } else {
                      return [...prev, { role: 'assistant', content: json.message, messageType: 'tool_call', isStreaming: true }];
                    }
                  });
                  console.log(`[Client] 处理tool_call消息，工具: ${json.tool}`);
                  addLog(`Tool Call: ${json.tool}`);
                } else if (json.type === 'status' && json.text) {
                  console.log(`[Client] 处理status消息，内容: "${json.text}"`);
                  addLog(`Status: ${json.text}`);
                  // 使用独立状态立即显示 status，不添加到消息历史
                  setCurrentStatus(json.text);
                } else {
                  console.log(`[Client] 收到未处理的JSON类型:`, json.type, '完整数据:', JSON.stringify(json));
                }
              } catch (e) {
                console.error('Error parsing SSE message:', e);
              }
            }
          }
        }
        
        await new Promise(requestAnimationFrame);
      }

      console.log('[Client] 设置所有消息为非流式状态');
      setMessages(prev => {
        console.log('[Client] 当前消息数:', prev.length);
        console.log('[Client] 检查文件附件:', prev.map(msg => ({ hasFiles: !!msg.files, fileCount: msg.files?.length || 0 })));
        return prev.map(msg => ({
          ...msg,
          isStreaming: false,
          // 确保保留文件附件
          files: msg.files
        }));
      });
      // 清除临时状态
      setCurrentStatus(null);
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
        const errorMsg: Message = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          messageType: 'content',
          isStreaming: false
        };
        return [...prev, errorMsg];
      });
      addLog('Error');
    } finally {
      setIsLoading(false);
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
    console.log('[Client] 处理文件上传:', files);
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
          onFilesChange={handleSendFiles}
          currentStatus={currentStatus}
        />
      </div>
      <div className="w-[320px] h-full border-l flex-shrink-0">
        <AgentToolPanel logs={logs} />
      </div>
    </div>
  );
}
