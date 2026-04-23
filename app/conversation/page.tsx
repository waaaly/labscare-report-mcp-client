'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Buffer } from 'buffer';
import ConversationSidebar from '@/components/conversation/ConversationSidebar';
import ChatArea from '@/components/conversation/ChatArea';
import AgentToolPanel from '@/components/conversation/AgentToolPanel';
import WelcomeCard from '@/components/conversation/WelcomeCard';
import { availableModels } from '@/lib/llm/model-config';


interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  messageType?: 'thought' | 'tool_call' | 'status' | 'content';
  files?: FileAttachment[];
  timestamp?: number;
  branchId?: string; // 分支 ID，用于标识消息所属的分支
  parentId?: string; // 父消息 ID，用于构建分支结构
}

interface FileAttachment {
  name: string;
  type: 'image' | 'json' | 'md';
  content: string;
  preview?: string;
}

export default function LLMConversationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [conversations, setConversations] = useState<{ id: string; title: string; createdAt: number; preview?: string }[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isShowWelcome, setIsShowWelcome] = useState(true);
  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedMessageIndex, setHighlightedMessageIndex] = useState<number | null>(null);

  // 模型切换状态
  const [currentModel, setCurrentModel] = useState<string>('gpt-5.3-codex');

  // 分支管理状态
  const [currentBranchId, setCurrentBranchId] = useState<string>('main');
  const [branches, setBranches] = useState<{ id: string; name: string; createdAt: number }[]>([
    { id: 'main', name: '主分支', createdAt: Date.now() }
  ]);

  // Token 统计状态
  const [currentTokenUsage, setCurrentTokenUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null>(null);
  const [conversationTokenUsage, setConversationTokenUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }>({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  const [requestCount, setRequestCount] = useState(0);

  // 停止生成：AbortController ref
  const abortControllerRef = useRef<AbortController | null>(null);

  // 重新生成：保存最后一次用户消息
  const lastUserMessageRef = useRef<{ text: string; files: File[] } | null>(null);

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
    let list: { id: string; title: string; createdAt: number; preview?: string }[] = [];
    if (listRaw) {
      try {
        list = JSON.parse(listRaw);
      } catch { }
    }
    if (!list || list.length === 0) {
      const id = Math.random().toString(36).slice(2);
      list = [{ id, title: '新对话', createdAt: Date.now() }];
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
        const parsedMsgs = JSON.parse(msgsRaw);
        setMessages(parsedMsgs);
        // 从消息中提取第一条用户消息作为preview
        if (parsedMsgs.length > 0) {
          const firstUserMsg = parsedMsgs.find((m: Message) => m.role === 'user' && m.content);
          if (firstUserMsg) {
            setConversations(prev => prev.map(c =>
              c.id === cur ? { ...c, preview: firstUserMsg.content.slice(0, 50) } : c
            ));
          }
        }
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
    const conv = { id, title: '新对话', createdAt: Date.now() };
    const next = [conv, ...conversations];
    setConversations(next);
    setCurrentId(id);
    setMessages([]);
    setInput('');
    setIsShowWelcome(true);
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
      // 从消息中提取第一条用户消息作为preview
      if (nextMsgs.length > 0) {
        const firstUserMsg = nextMsgs.find((m: Message) => m.role === 'user' && m.content);
        if (firstUserMsg) {
          setConversations(prev => prev.map(c =>
            c.id === id ? { ...c, preview: firstUserMsg.content.slice(0, 50) } : c
          ));
        }
      }
    } catch {
      setMessages([]);
    }
    setCurrentId(id);
    setInput('');
  }, [currentId, msgKey]);

  // 快捷操作处理
  const handleQuickAction = useCallback((action: string) => {
    const prompts: Record<string, string> = {
      '编写代码': '请帮我编写一段代码，描述你想要实现的功能：',
      '文档处理': '请帮我处理文档，你可以上传文件或描述需要完成的任务：',
      '问题解答': '请描述你的问题，我会尽力帮你解答：',
      '数据分析': '请提供需要分析的数据或描述数据来源：',
    };
    setInput(prompts[action] || '');
    setIsShowWelcome(false);
  }, []);

  // 插入 prompt 到输入框
  const handleInsertPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    addLog(`Inserted prompt: ${prompt.slice(0, 50)}...`);
  }, [addLog]);

  // 删除对话
  const handleDeleteConversation = useCallback((id: string) => {
    // 如果删除的是当前对话，切换到第一个
    if (id === currentId) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        selectConversation(remaining[0].id);
      } else {
        // 创建新对话
        createNewConversation();
      }
    }
    // 从列表移除
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      localStorage.setItem(LS_CONV_LIST, JSON.stringify(next));
      return next;
    });
    // 删除消息
    localStorage.removeItem(msgKey(id));
    addLog(`Deleted conversation: ${id}`);
  }, [currentId, conversations, msgKey, LS_CONV_LIST, selectConversation, createNewConversation, addLog]);

  // 重命名对话
  const handleRenameConversation = useCallback((id: string, newTitle: string) => {
    setConversations(prev => {
      const next = prev.map(c => c.id === id ? { ...c, title: newTitle } : c);
      localStorage.setItem(LS_CONV_LIST, JSON.stringify(next));
      return next;
    });
    addLog(`Renamed conversation: ${id} -> ${newTitle}`);
  }, [LS_CONV_LIST, addLog]);

  const handleSend = useCallback(async (inputText: string) => {
    console.log('handleSend', inputText, selectedFiles);
    if (!inputText.trim() && selectedFiles.length === 0) return;

    // 保存用户消息供重新生成使用
    lastUserMessageRef.current = { text: inputText, files: selectedFiles };

    // 创建 AbortController 用于停止生成
    abortControllerRef.current = new AbortController();

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
          } catch { }
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
      files: fileAttachments.length > 0 ? fileAttachments : undefined,
      timestamp: Date.now(),
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
      formData.append('contextJson', JSON.stringify({ 
        conversationId: currentId, 
        messagesCount: newMessages.length,
      }));
      const standardMessages = newMessages
        .filter(msg => !msg.isStreaming && msg.content)
        .map(msg => ({ role: msg.role, content: msg.content }));
      formData.append('messagesJson', JSON.stringify(standardMessages));
      formData.append('model', currentModel);
      if (selectedFiles.length > 0) {
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });
      }
      response = await fetch('/api/llm', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
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
                      newMessages = [...prev, { role: 'assistant', content: json.text, messageType: 'content', isStreaming: true, timestamp: Date.now() }];
                    }
                    return newMessages;
                  });
                } else if (json.type === 'thought' && json.text) {
                  setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.messageType === 'thought') {
                      return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + json.text }];
                    } else {
                      return [...prev, { role: 'assistant', content: json.text, messageType: 'thought', isStreaming: true, timestamp: Date.now() }];
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
                      return [...prev, { role: 'assistant', content: json.message, messageType: 'tool_call', isStreaming: true, timestamp: Date.now() }];
                    }
                  });
                  console.log(`[Client] 处理tool_call消息，工具: ${json.tool}`);
                  addLog(`Tool Call: ${json.tool}`);
                } else if (json.type === 'status' && json.text) {
                  console.log(`[Client] 处理status消息，内容: "${json.text}"`);
                  addLog(`Status: ${json.text}`);
                  // 使用独立状态立即显示 status，不添加到消息历史
                  setCurrentStatus(json.text);
                } else if (json.type === 'metrics' && json.token_usage) {
                  // 处理 token 使用量统计
                  const usage = json.token_usage;
                  console.log('[Client] 处理 token 使用量:', usage);
                  setCurrentTokenUsage(usage);
                  // 累加到对话统计
                  setConversationTokenUsage(prev => ({
                    inputTokens: prev.inputTokens + (usage.inputTokens || 0),
                    outputTokens: prev.outputTokens + (usage.outputTokens || 0),
                    totalTokens: prev.totalTokens + (usage.totalTokens || 0),
                  }));
                  setRequestCount(prev => prev + 1);
                  addLog(`Token: ${usage.totalTokens} (输入:${usage.inputTokens} 输出:${usage.outputTokens})`);
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
    } catch (error: any) {
      // 检查是否是用户主动停止
      if (error?.name === 'AbortError') {
        console.log('[Client] 请求已被用户停止');
        addLog('Stopped');
        // 保持当前消息状态不变
      } else {
        console.error('Error sending message:', error);
        setMessages(prev => {
          const errorMsg: Message = {
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            messageType: 'content',
            isStreaming: false,
            timestamp: Date.now(),
          };
          return [...prev, errorMsg];
        });
        addLog('Error');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      if (selectedFiles.length > 0) {
        // 清理已发送文件引用
        // 仅清空选中文件状态，实际文件释放由子组件负责 revokeObjectURL
        // 避免再次复用旧文件
        // eslint-disable-next-line react-hooks/exhaustive-deps
        setSelectedFiles([]);
      }
    }
  }, [input, messages, scrollToBottom, addLog, conversations, currentId, selectedFiles,currentModel]);

  const handleSendFiles = useCallback((files: File[]) => {
    console.log('[Client] 处理文件上传:', files);
    setSelectedFiles(files);
    if (files?.length) {
      addLog(`Files: ${files.map(f => f.name).join(', ')}`);
    }
  }, [addLog]);

  // 停止生成
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('[Client] 已发送停止信号');
      addLog('Stopped by user');
    }
    setIsLoading(false);
    // 将流式消息标记为已完成
    setMessages(prev => prev.map(msg => ({
      ...msg,
      isStreaming: false
    })));
  }, [addLog]);

  // 重新生成
  const handleRegenerate = useCallback(() => {
    if (lastUserMessageRef.current) {
      const { text, files } = lastUserMessageRef.current;
      // 清空最后一条 AI 回复（如果有）
      setMessages(prev => {
        const newMessages = [...prev];
        // 移除最后一条 assistant 消息
        while (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
          newMessages.pop();
        }
        return newMessages;
      });
      // 重新发送
      setSelectedFiles(files);
      // 调用 handleSend
      if (text.trim()) {
        setInput(text);
        // 延迟一点确保状态更新
        setTimeout(() => {
          handleSend(text);
        }, 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSend, setMessages, setSelectedFiles, setInput]);

  // 搜索处理
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      // 查找第一个匹配的消息
      const index = messages.findIndex(m =>
        m.content.toLowerCase().includes(query.toLowerCase())
      );
      setHighlightedMessageIndex(index >= 0 ? index : null);
    } else {
      setHighlightedMessageIndex(null);
    }
  }, [messages]);

  // 模型切换处理
  const handleModelChange = useCallback((modelValue: string) => {
    setCurrentModel(modelValue);
    console.log(modelValue)
    addLog(`Switched model to: ${modelValue}`);
  }, [addLog]);

  // 创建分支
  const handleCreateBranch = useCallback((messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message) return;

    const branchId = `branch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newBranch = {
      id: branchId,
      name: `分支 ${branches.length + 1}`,
      createdAt: Date.now()
    };

    // 创建新分支
    setBranches(prev => [...prev, newBranch]);
    setCurrentBranchId(branchId);

    // 复制当前消息及其之前的所有消息到新分支
    const messagesUpToSelected = messages.slice(0, messageIndex + 1);
    const newMessages = messagesUpToSelected.map(msg => ({
      ...msg,
      branchId: branchId
    }));

    setMessages(newMessages);
    addLog(`Created branch ${branchId} from message ${messageIndex}`);
  }, [messages, branches, addLog]);

  // 切换分支
  const handleSwitchBranch = useCallback((branchId: string) => {
    setCurrentBranchId(branchId);
    // 这里可以添加加载对应分支消息的逻辑
    addLog(`Switched to branch ${branchId}`);
  }, [addLog]);

  // 导出对话
  const handleExport = useCallback((format: 'markdown' | 'json') => {
    const convTitle = conversations.find(c => c.id === currentId)?.title || 'conversation';
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'markdown') {
      // 转换为 Markdown 格式
      const lines = [`# ${convTitle}\n\n`];
      messages.forEach((msg, idx) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
        lines.push(`## ${role} (${time})\n\n`);
        lines.push(`${msg.content}\n\n`);
        if (msg.files && msg.files.length > 0) {
          msg.files.forEach(f => {
            if (f.type === 'image') {
              lines.push(`![${f.name}](${f.name})\n\n`);
            } else {
              lines.push(`**${f.name}**:\n\`\`\`\n${f.content}\n\`\`\`\n\n`);
            }
          });
        }
      });
      content = lines.join('');
      filename = `${convTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.md`;
      mimeType = 'text/markdown';
    } else {
      // 转换为 JSON 格式
      const exportData = {
        title: convTitle,
        exportedAt: new Date().toISOString(),
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          messageType: msg.messageType,
          files: msg.files?.map(f => ({
            name: f.name,
            type: f.type,
            content: f.type === 'image' ? '[Image Data]' : f.content,
          })),
        })),
      };
      content = JSON.stringify(exportData, null, 2);
      filename = `${convTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.json`;
      mimeType = 'application/json';
    }

    // 下载文件
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog(`Exported conversation as ${format.toUpperCase()}`);
  }, [messages, conversations, currentId, addLog]);

  return (
    <div className="flex gap-4 h-[calc(100vh-var(--header-h,10rem))] overflow-hidden bg-background">
      {/* 左侧对话列表 */}
      <div className="w-[280px] h-full flex-shrink-0">
        <ConversationSidebar
          conversations={conversations}
          currentId={currentId}
          onSelect={selectConversation}
          onNew={createNewConversation}
          onDelete={handleDeleteConversation}
          onRename={handleRenameConversation}
        />
      </div>

      {/* 中间对话区域 */}
      <div className="flex-1 h-full flex flex-col min-w-0">
        { isShowWelcome ? (
          <WelcomeCard onQuickAction={handleQuickAction} />
        ) : (
          <ChatArea
            title={conversations.find(c => c.id === currentId)?.title || '对话'}
            messages={messages}
            isLoading={isLoading}
            input={input}
            onSend={handleSend}
            onStop={handleStop}
            onRegenerate={handleRegenerate}
            messagesEndRef={messagesEndRef}
            onFilesChange={handleSendFiles}
            currentStatus={currentStatus}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            highlightedMessageIndex={highlightedMessageIndex}
            onExport={handleExport}
          />
        )}
      </div>

      {/* 右侧高级功能面板 */}
      <div className="w-[300px] h-full flex-shrink-0">
        <AgentToolPanel 
          logs={logs}
          onInsertPrompt={handleInsertPrompt}
          currentModel={currentModel}
          onModelChange={handleModelChange}
          tokenUsage={currentTokenUsage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 }}
          conversationUsage={conversationTokenUsage}
          requestCount={requestCount}
          availableModels={availableModels.map(model => ({
            id: `${model.model}`,
            name: model.name,
            description: `${model.model}`
          }))}
        />
      </div>
    </div>
  );
}
