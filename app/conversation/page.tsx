'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Buffer } from 'buffer';
import ConversationSidebar from '@/components/conversation/ConversationSidebar';
import ChatArea from '@/components/conversation/ChatArea';
import AgentToolPanel from '@/components/conversation/AgentToolPanel';
import WelcomeCard from '@/components/conversation/WelcomeCard';
import { availableModels } from '@/lib/llm/model-config';
import { useConversationStore, Message, FileAttachment } from '@/store/conversation-store';

export default function LLMConversationPage() {
  const {
    conversations,
    currentConversationId,
    currentMessages,
    isLoading: storeLoading,
    error: storeError,
    setConversations,
    setCurrentConversationId,
    setCurrentMessages,
    updateMessages,
    addMessage,
    updateLastMessage,
    setLoading,
    setError,
    loadConversations,
    loadConversation,
    createConversation,
    updateConversation,
    deleteConversation,
  } = useConversationStore();

  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isShowWelcome, setIsShowWelcome] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedMessageIndex, setHighlightedMessageIndex] = useState<number | null>(null);
  const [currentModel, setCurrentModel] = useState<string>(availableModels[0].model);
  const [currentBranchId, setCurrentBranchId] = useState<string>('main');
  const [branches, setBranches] = useState<{ id: string; name: string; createdAt: number }[]>([
    { id: 'main', name: '主分支', createdAt: Date.now() }
  ]);
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
  const [showUploadBackground, setShowUploadBackground] = useState(false);
  const [usageHistory, setUsageHistory] = useState<Array<{
    content: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }>>([]);
  const [modelContextLimits, setModelContextLimits] = useState<{
    maxInputTokens: number;
    maxOutputTokens: number;
  }>({ maxInputTokens: 0, maxOutputTokens: 0 });

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<{ text: string; files: File[] } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [currentMessages, scrollToBottom]);

  const addLog = useCallback((line: string) => {
    const t = new Date().toLocaleTimeString();
    setLogs(prev => {
      const next = [...prev, `${t} ${line}`];
      return next.slice(-200);
    });
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const createNewConversation = useCallback(async () => {
    try {
      const id = await createConversation('新对话', currentModel);
      setCurrentMessages([]);
      setInput('');
      setIsShowWelcome(true);
      setUsageHistory([]);
      setCurrentTokenUsage(null);
      setConversationTokenUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
      setRequestCount(0);
      setCurrentStatus(null);
      setIsLoading(false);
      setLogs([]);
      setSelectedFiles([]);
      setShowUploadBackground(false);
      setCurrentBranchId('main');
      setBranches([{ id: 'main', name: '主分支', createdAt: Date.now() }]);

      // Reset model context limits for new conversation
      const modelConfig = availableModels.find(m => m.model === currentModel);
      if (modelConfig) {
        setModelContextLimits({
          maxInputTokens: modelConfig.maxInputTokens,
          maxOutputTokens: modelConfig.maxOutputTokens,
        });
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }, [createConversation, currentModel, setCurrentMessages]);

  const selectConversation = useCallback(async (id: string) => {
    if (id === currentConversationId) return;
    setCurrentConversationId(id);
    await loadConversation(id);
    setInput('');
    setIsShowWelcome(false);
    setUsageHistory(() => {
      if (!currentMessages) return [];
      const history: Array<{
        content: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      }> = [];
      for (let i = 0; i < currentMessages.length; i++) {
        const message = currentMessages[i];
        if (message.role.toLowerCase() === 'user') {
          const nextMessage = i + 1 < currentMessages.length ? currentMessages[i + 1] : null;
          const hasAssistantReply = nextMessage && nextMessage.role.toLowerCase() === 'assistant';
          history.push({
            content: message.content,
            inputTokens: hasAssistantReply ? (nextMessage.inputTokens || 0) : 0,
            outputTokens: hasAssistantReply ? (nextMessage.outputTokens || 0) : 0,
            totalTokens: hasAssistantReply ? ((nextMessage.inputTokens || 0) + (nextMessage.outputTokens || 0)) : 0,
          });
        }
      }
      return history;
    });
    // Load model context limits for the conversation's model
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {

      setConversationTokenUsage({
        inputTokens: conversation.totalInputTokens || 0,
        outputTokens: conversation.totalOutputTokens || 0,
        totalTokens: conversation.totalTokens || 0,
      })
      if (conversation.model) {
        const modelConfig = availableModels.find(m => m.model === conversation.model);
        if (modelConfig) {
          setModelContextLimits({
            maxInputTokens: modelConfig.maxInputTokens,
            maxOutputTokens: modelConfig.maxOutputTokens,
          });
          setCurrentModel(conversation.model);
        }
      }
    }

  }, [currentConversationId, setModelContextLimits, setUsageHistory, setConversationTokenUsage, setCurrentModel, setCurrentConversationId, loadConversation, conversations]);

  const handleQuickAction = useCallback(async (action: string) => {
    try {
      setCurrentMessages([]);
      setInput('');

      const prompts: Record<string, string> = {
        '批量导入报告物料': '选择目录上传，该目录按以下结构：上传目录名称->测试用例文件夹名称->报告名称文件夹->报告物料文件',
        '文档处理': '请帮我处理文档，你可以上传文件或描述需要完成的任务：',
        '问题解答': '请描述你的问题，我会尽力帮你解答：',
        '数据分析': '请提供需要分析的数据或描述数据来源：',
      };
      setInput(prompts[action] || '');
      setIsShowWelcome(false);
      if (action === '批量导入报告物料') {
        setShowUploadBackground(true);
      } else {
        setShowUploadBackground(false);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }, [createConversation, currentModel, setCurrentMessages]);

  const handleInsertPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    addLog(`Inserted prompt: ${prompt.slice(0, 50)}...`);
  }, [addLog]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await deleteConversation(id);
      if (id === currentConversationId) {
        const remaining = conversations.filter(c => c.id !== id);
        if (remaining.length > 0) {
          await selectConversation(remaining[0].id);
        } else {
          await createNewConversation();
        }
      }
      addLog(`Deleted conversation: ${id}`);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, [currentConversationId, conversations, deleteConversation, selectConversation, createNewConversation, addLog]);

  const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
    try {
      await updateConversation(id, { title: newTitle });
      addLog(`Renamed conversation: ${id} -> ${newTitle}`);
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  }, [updateConversation, addLog]);

  const handleSend = useCallback(async (inputText: string) => {
    console.log('handleSend', inputText, selectedFiles);
    if (!inputText.trim() && selectedFiles.length === 0) return;

    lastUserMessageRef.current = { text: inputText, files: selectedFiles };
    abortControllerRef.current = new AbortController();

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
      role: 'USER',
      content: inputText.trim(),
      files: fileAttachments.length > 0 ? fileAttachments : undefined,
      timestamp: Date.now(),
    };

    const shouldAddMessage = inputText.trim() || fileAttachments.length > 0;
    const newMessages = shouldAddMessage
      ? [...currentMessages, userMessage]
      : [...currentMessages];

    setCurrentMessages(newMessages);
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
      formData.append('prompt', inputText.trim());
      formData.append('contextJson', JSON.stringify({
        conversationId: currentConversationId,
        messagesCount: newMessages.length,
      }));
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

        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';
        console.log('[Client] 处理 SSE 行数:', lines.length);

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data) {
              console.log('[Client] 收到原始SSE数据:', data);
              setIsLoading(false);
              try {
                const json = JSON.parse(data);
                console.log('[Client] 解析JSON成功，类型:', json.type, '内容:', json.text?.substring(0, 30) || json.tool || json.ttft || 'N/A');
                if (json.type === 'content' && json.text) {
                  updateMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    let newMessages: Message[];
                    if (lastMsg?.messageType === 'content' || (lastMsg?.role === 'ASSISTANT' && !lastMsg?.messageType)) {
                      newMessages = [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + json.text, messageType: 'content', isStreaming: true }];
                    } else {
                      newMessages = [...prev, { role: 'ASSISTANT', content: json.text, messageType: 'content', isStreaming: true, timestamp: Date.now() }];
                    }
                    return newMessages;
                  });
                } else if (json.type === 'thought' && json.text) {
                  if (json.node === 'tools') {
                    updateMessages((prev) => {
                      for (let i = prev.length - 1; i >= 0; i--) {
                        if (prev[i].messageType === 'tool_call' && prev[i].isStreaming) {
                          const updated = [...prev];
                          updated[i] = { ...updated[i], content: updated[i].content + '\n' + json.text, isStreaming: false };
                          return updated;
                        }
                      }
                      return [...prev, { role: 'ASSISTANT', content: json.text, messageType: 'thought', isStreaming: false, timestamp: Date.now() }];
                    });
                  } else {
                    updateMessages((prev) => [
                      ...prev.map(msg => msg.messageType === 'thought' ? { ...msg, isStreaming: false } : msg),
                      { role: 'ASSISTANT', content: json.text, messageType: 'thought', isStreaming: true, timestamp: Date.now() },
                    ]);
                  }
                  console.log(`[Client] 处理thought消息，内容: "${json.text.substring(0, 30)}..."`);
                  addLog(`Thought: ${json.text.slice(0, 50)}...`);
                } else if (json.type === 'tool_call' && json.message) {
                  updateMessages((prev) => [
                    ...prev,
                    { role: 'ASSISTANT', content: json.message, messageType: 'tool_call', toolName: json.tool, isStreaming: true, timestamp: Date.now() },
                  ]);
                  console.log(`[Client] 处理tool_call消息，工具: ${json.tool}`);
                  addLog(`Tool Call: ${json.tool}`);
                } else if (json.type === 'status' && json.text) {
                  console.log(`[Client] 处理status消息，内容: "${json.text}"`);
                  addLog(`Status: ${json.text}`);
                  setCurrentStatus(json.text);
                } else if (json.type === 'metrics' && json.token_usage) {
                  const usage = json.token_usage;
                  console.log('[Client] 处理 token 使用量:', usage);
                  setCurrentTokenUsage(usage);
                  setConversationTokenUsage(prev => ({
                    inputTokens: prev.inputTokens + (usage.inputTokens || 0),
                    outputTokens: prev.outputTokens + (usage.outputTokens || 0),
                    totalTokens: prev.totalTokens + (usage.totalTokens || 0),
                  }));
                  setRequestCount(prev => prev + 1);
                  setUsageHistory(prev => [
                    ...prev,
                    {
                      content: lastUserMessageRef.current?.text || '',
                      inputTokens: usage.inputTokens || 0,
                      outputTokens: usage.outputTokens || 0,
                      totalTokens: usage.totalTokens || 0,
                    },
                  ]);
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
      updateMessages((prev) => {
        console.log('[Client] 当前消息数:', prev.length);
        console.log('[Client] 检查文件附件:', prev.map((msg) => ({ hasFiles: !!msg.files, fileCount: msg.files?.length || 0 })));
        return prev.map((msg) => ({
          ...msg,
          isStreaming: false,
          files: msg.files
        }));
      });
      setCurrentStatus(null);
      scrollToBottom(true);
      addLog('Completed');

      if (conversations.length > 0 && currentConversationId) {
        const hasTitle = conversations.find(c => c.id === currentConversationId)?.title && conversations.find(c => c.id === currentConversationId)?.title !== 'New Conversation';
        if (!hasTitle) {
          const preview = (userMessage.content || '[Attachment]').slice(0, 30);
          await updateConversation(currentConversationId, { title: preview || 'Conversation' });
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log('[Client] 请求已被用户停止');
        addLog('Stopped');
      } else {
        console.error('Error sending message:', error);
        updateMessages((prev) => {
          const errorMsg: Message = {
            role: 'ASSISTANT',
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
        setSelectedFiles([]);
      }
    }
  }, [input, currentMessages, scrollToBottom, addLog, conversations, currentConversationId, selectedFiles, currentModel, updateConversation]);

  const handleSendFiles = useCallback((files: File[]) => {
    console.log('[Client] 处理文件上传:', files);
    setSelectedFiles(files);
    if (files?.length) {
      addLog(`Files: ${files.map(f => f.name).join(', ')}`);
    }
  }, [addLog]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('[Client] 已发送停止信号');
      addLog('Stopped by user');
    }
    setIsLoading(false);
    updateMessages((prev) => prev.map((msg) => ({
      ...msg,
      isStreaming: false
    })));
  }, [addLog, updateMessages]);

  const handleRegenerate = useCallback(() => {
    if (lastUserMessageRef.current) {
      const { text, files } = lastUserMessageRef.current;
      updateMessages((prev) => {
        const newMessages = [...prev];
        while (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'ASSISTANT') {
          newMessages.pop();
        }
        return newMessages;
      });
      setSelectedFiles(files);
      if (text.trim()) {
        setInput(text);
        setTimeout(() => {
          handleSend(text);
        }, 0);
      }
    }
  }, [handleSend, updateMessages, setSelectedFiles, setInput]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const index = currentMessages.findIndex(m =>
        m.content.toLowerCase().includes(query.toLowerCase())
      );
      setHighlightedMessageIndex(index >= 0 ? index : null);
    } else {
      setHighlightedMessageIndex(null);
    }
  }, [currentMessages]);

  const handleModelChange = useCallback((modelValue: string) => {
    setCurrentModel(modelValue);
    console.log(modelValue);
    addLog(`Switched model to: ${modelValue}`);

    // Update model context limits when model changes
    const modelConfig = availableModels.find(m => m.model === modelValue);
    if (modelConfig) {
      setModelContextLimits({
        maxInputTokens: modelConfig.maxInputTokens,
        maxOutputTokens: modelConfig.maxOutputTokens,
      });
    }
  }, [addLog]);

  const handleCreateBranch = useCallback((messageIndex: number) => {
    const message = currentMessages[messageIndex];
    if (!message) return;

    const branchId = `branch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newBranch = {
      id: branchId,
      name: `分支 ${branches.length + 1}`,
      createdAt: Date.now()
    };

    setBranches(prev => [...prev, newBranch]);
    setCurrentBranchId(branchId);

    const messagesUpToSelected = currentMessages.slice(0, messageIndex + 1);
    const newMessages = messagesUpToSelected.map(msg => ({
      ...msg,
      branchId: branchId
    }));

    setCurrentMessages(newMessages);
    addLog(`Created branch ${branchId} from message ${messageIndex}`);
  }, [currentMessages, branches, addLog, setCurrentMessages]);

  const handleSwitchBranch = useCallback((branchId: string) => {
    setCurrentBranchId(branchId);
    addLog(`Switched to branch ${branchId}`);
  }, [addLog]);

  const handleExport = useCallback((format: 'markdown' | 'json') => {
    const convTitle = conversations.find(c => c.id === currentConversationId)?.title || 'conversation';
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'markdown') {
      const lines = [`# ${convTitle}\n\n`];
      currentMessages.forEach((msg, idx) => {
        const role = msg.role === 'USER' ? 'User' : 'Assistant';
        const time = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : '';
        lines.push(`## ${role} (${time})\n\n`);
        lines.push(`${msg.content}\n\n`);
        if (msg.attachments && msg.attachments.length > 0) {
          msg.attachments.forEach(f => {
            if (f.type === 'image') {
              lines.push(`![${f.name}](${f.name})\n\n`);
            } else {
              lines.push(`**${f.name}**:\n\`\`\`\n${f.content || ''}\n\`\`\`\n\n`);
            }
          });
        }
      });
      content = lines.join('');
      filename = `${convTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.md`;
      mimeType = 'text/markdown';
    } else {
      const exportData = {
        title: convTitle,
        exportedAt: new Date().toISOString(),
        messages: currentMessages.map(msg => ({
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
  }, [currentMessages, conversations, currentConversationId, addLog]);

  return (
    <div className="flex gap-4 h-[calc(100vh-var(--header-h,10rem))] overflow-hidden bg-background">
      <div className="w-[280px] h-full flex-shrink-0">
        <ConversationSidebar
          conversations={conversations}
          currentId={currentConversationId || ''}
          onSelect={selectConversation}
          onNew={createNewConversation}
          onDelete={handleDeleteConversation}
          onRename={handleRenameConversation}
          loading={conversations.length === 0 && storeLoading}
        />
      </div>

      <div className="flex-1 h-full flex flex-col min-w-0">
        {(isShowWelcome && currentMessages.length === 0) ? (
          <WelcomeCard onQuickAction={handleQuickAction} />
        ) : (
          <ChatArea
            title={conversations.find(c => c.id === currentConversationId)?.title || '对话'}
            messages={currentMessages}
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
            showUploadBackground={showUploadBackground}
          />
        )}
      </div>

      <div className="w-[300px] h-full flex-shrink-0">
        <AgentToolPanel
          logs={logs}
          onInsertPrompt={handleInsertPrompt}
          currentModel={currentModel}
          onModelChange={handleModelChange}
          tokenUsage={currentTokenUsage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 }}
          conversationUsage={conversationTokenUsage}
          requestCount={requestCount}
          usageHistory={usageHistory}
          availableModels={availableModels.map(model => ({
            id: `${model.model}`,
            name: model.name,
            description: `${model.model}`,
            maxInputTokens: model.maxInputTokens,
            maxOutputTokens: model.maxOutputTokens,
          }))}
          modelContextLimits={modelContextLimits}
        />
      </div>
    </div>
  );
}
