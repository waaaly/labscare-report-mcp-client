'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Buffer } from 'buffer';
import ConversationSidebar from '@/components/conversation/ConversationSidebar';
import ChatArea from '@/components/conversation/ChatArea';
import AgentToolPanel from '@/components/conversation/AgentToolPanel';
import WelcomeCard from '@/components/conversation/WelcomeCard';
import { availableModels } from '@/lib/llm/model-config';
import { useConversationStore, Message, FileAttachment } from '@/store/conversation-store';
import { useStreamStore, StreamEvent } from '@/store/stream-store';
import { StreamController } from '@/lib/llm/stream-controller';

export default function LLMConversationPage() {
  const {
    conversations,
    currentConversationId,
    currentMessages: storeMessages,
    isLoading: convStoreLoading,
    error: storeError,
    setConversations,
    setCurrentConversationId,
    setCurrentMessages,
    updateMessages: storeUpdateMessages,
    addMessage: storeAddMessage,
    updateLastMessage: storeUpdateLastMessage,
    setLoading,
    setError,
    loadConversations,
    loadConversation,
    createConversation,
    updateConversation,
    deleteConversation,
  } = useConversationStore();

  const {
    messages: streamMessages,
    isStreaming,
    currentStatus,
    currentTokenUsage,
    conversationTokenUsage,
    requestCount,
    usageHistory,
    setMessages,
    appendMessage,
    updateMessages,
    handleStreamEvent,
    finishStreaming,
    startStreaming,
    setLastUserMessage,
    getLastUserMessage,
    resetTokenUsage,
  } = useStreamStore(storeMessages);

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
  const [conversationLoading, setConversationIsLoading] = useState(false);
  const [modelContextLimits, setModelContextLimits] = useState<{
    maxInputTokens: number;
    maxOutputTokens: number;
  }>({ maxInputTokens: 0, maxOutputTokens: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev.slice(-49), message]);
    console.log(`[Log] ${message}`);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, []);

  const streamController = useMemo(() => {
    return new StreamController({
      onEvent: handleStreamEvent,
      onComplete: finishStreaming,
      onError: (error) => {
        console.error('Stream error:', error);
        appendMessage({
          role: 'ASSISTANT',
          content: 'Sorry, I encountered an error. Please try again.',
          messageType: 'content',
          isStreaming: false,
          timestamp: Date.now(),
        });
        addLog('Error');
      },
      onLog: addLog,
    });
  }, [handleStreamEvent, finishStreaming, appendMessage, addLog]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!currentConversationId) {
      setSelectedFiles([]);
      resetTokenUsage();
    } else {
    }
  }, [currentConversationId, resetTokenUsage]);

  useEffect(() => {
    if (storeMessages.length === 0 && input.trim() === '') {
      setIsShowWelcome(true);
    } else {
      setIsShowWelcome(false);
    }
  }, [storeMessages, input]);

  useEffect(() => {
    if (currentConversationId) {
      const model = conversations.find(c => c.id === currentConversationId)?.model || currentModel;
      const modelConfig = availableModels.find(m => m.model === model);
      if (modelConfig) {
        setModelContextLimits({
          maxInputTokens: modelConfig.maxInputTokens || 0,
          maxOutputTokens: modelConfig.maxOutputTokens || 0,
        });
      }
    }
  }, [currentConversationId, conversations, currentModel]);

  useEffect(() => {
    setCurrentMessages(streamMessages);
  }, [streamMessages, setCurrentMessages]);

  useEffect(() => {
    if (isStreaming || currentStatus) {
      scrollToBottom(false);
    }
  }, [isStreaming, currentStatus, scrollToBottom]);

  useEffect(() => {
    if (!isStreaming) {
      setMessages(storeMessages);
    }
  }, [storeMessages, isStreaming, setMessages]);

  const createNewConversation = useCallback(async () => {
    await createConversation('New Conversation', currentModel);
    resetTokenUsage();
    setSelectedFiles([]);
    setInput('');
    addLog('Created new conversation');
  }, [createConversation, currentModel, resetTokenUsage, addLog]);

  const selectConversation = useCallback(async (id: string) => {
    setCurrentConversationId(id);

    await loadConversation(id);

    const conv = conversations.find(c => c.id === id);
    if (conv?.model) {
      setCurrentModel(conv.model);
      const modelConfig = availableModels.find(m => m.model === conv.model);
      if (modelConfig) {
        setModelContextLimits({
          maxInputTokens: modelConfig.maxInputTokens || 0,
          maxOutputTokens: modelConfig.maxOutputTokens || 0,
        });
      }
    }

    const loadedMessages = useConversationStore.getState().currentMessages;
    const history: Array<{
      content: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    }> = [];
    for (let i = 0; i + 1 < loadedMessages.length; i += 2) {
      const userMsg = loadedMessages[i];
      const assistantMsg = loadedMessages[i + 1];
      if (userMsg.role !== 'USER' || assistantMsg.role !== 'ASSISTANT') continue;
      if (assistantMsg.inputTokens == null && assistantMsg.outputTokens == null) continue;
      history.push({
        content: userMsg.content.slice(0, 50),
        inputTokens: assistantMsg.inputTokens || 0,
        outputTokens: assistantMsg.outputTokens || 0,
        totalTokens: (assistantMsg.inputTokens || 0) + (assistantMsg.outputTokens || 0),
      });
    }

    resetTokenUsage(
      {
        inputTokens: conv?.totalInputTokens || 0,
        outputTokens: conv?.totalOutputTokens || 0,
        totalTokens: conv?.totalTokens || 0,
      },
      history,
    );
    setInput('');
    setSelectedFiles([]);
    addLog(`Selected conversation: ${id}`);
  }, [conversations, setCurrentConversationId, loadConversation, resetTokenUsage, addLog]);

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
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }, [setInput, setCurrentMessages, setIsShowWelcome]);

  const handleModelChange = useCallback((model: string) => {
    setCurrentModel(model);
    const modelConfig = availableModels.find(m => m.model === model);
    if (modelConfig) {
      setModelContextLimits({
        maxInputTokens: modelConfig.maxInputTokens || 0,
        maxOutputTokens: modelConfig.maxOutputTokens || 0,
      });
    }
    if (currentConversationId) {
      updateConversation(currentConversationId, { model });
    }
    addLog(`Model changed to: ${model}`);
  }, [currentConversationId, updateConversation, addLog]);

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
    if (shouldAddMessage) {
      appendMessage(userMessage);
    }
    if (inputText.trim()) setInput('');
    setConversationIsLoading(true);
    if (inputText.trim()) addLog(inputText.trim());
    if (selectedFiles.length > 0) {
      addLog(`Files: ${selectedFiles.map(f => f.name).join(', ')}`);
    }

    setLastUserMessage(inputText, selectedFiles);
    startStreaming();

    const formData = new FormData();
    formData.append('prompt', inputText.trim());
    formData.append('contextJson', JSON.stringify({
      conversationId: currentConversationId,
      messagesCount: streamMessages.length + 1,
    }));
    formData.append('model', currentModel);
    if (selectedFiles.length > 0) {
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
    }

    try {
      await streamController.start('/api/llm', formData, userMessage, { text: inputText, files: selectedFiles });
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error sending message:', error);
        appendMessage({
          role: 'ASSISTANT',
          content: 'Sorry, I encountered an error. Please try again.',
          messageType: 'content',
          isStreaming: false,
          timestamp: Date.now(),
        });
        addLog('Error');
      }
    } finally {
      setConversationIsLoading(false);
      if (selectedFiles.length > 0) {
        setSelectedFiles([]);
      }

      if (conversations.length > 0 && currentConversationId) {
        const hasTitle = conversations.find(c => c.id === currentConversationId)?.title &&
          conversations.find(c => c.id === currentConversationId)?.title !== 'New Conversation';
        if (!hasTitle) {
          const preview = (userMessage.content || '[Attachment]').slice(0, 30);
          await updateConversation(currentConversationId, { title: preview || 'Conversation' });
        }
      }
    }
  }, [streamMessages, selectedFiles, currentConversationId, currentModel, appendMessage, addLog, conversations, updateConversation, streamController, setLastUserMessage, startStreaming]);

  const handleSendFiles = useCallback((files: File[]) => {
    console.log('[Client] 处理文件上传:', files);
    setSelectedFiles(files);
    if (files?.length) {
      addLog(`Files: ${files.map(f => f.name).join(', ')}`);
    }
  }, [addLog]);

  const handleStop = useCallback(() => {
    streamController.stop();
    setConversationIsLoading(false);
    updateMessages(prev => prev.map((msg) => ({ ...msg, isStreaming: false })));
    addLog('Stopped by user');
  }, [streamController, updateMessages, addLog]);

  const handleRegenerate = useCallback(() => {
    const lastMsg = getLastUserMessage();
    if (lastMsg) {
      const { text, files } = lastMsg;
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
  }, [handleSend, updateMessages, setSelectedFiles, setInput, getLastUserMessage]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const index = streamMessages.findIndex((msg) =>
        msg.content.toLowerCase().includes(query.toLowerCase())
      );
      setHighlightedMessageIndex(index >= 0 ? index : null);
    } else {
      setHighlightedMessageIndex(null);
    }
  }, [streamMessages]);

  const handleExport = useCallback((format: 'markdown' | 'json') => {
    if (!currentConversationId) return;

    const conv = conversations.find(c => c.id === currentConversationId);
    const title = conv?.title || 'conversation';

    let content = '';
    let filename = '';

    if (format === 'markdown') {
      content = streamMessages.map((msg) => {
        const role = msg.role === 'USER' ? '**User**' : '**Assistant**';
        const type = msg.messageType ? ` (${msg.messageType})` : '';
        return `${role}${type}:\n${msg.content}\n`;
      }).join('\n---\n\n');
      filename = `${title}.md`;
    } else {
      content = JSON.stringify(streamMessages, null, 2);
      filename = `${title}.json`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog(`Exported conversation as ${format}`);
  }, [currentConversationId, conversations, streamMessages, addLog]);

  const handleAddBranch = useCallback(() => {
    const newBranchId = `branch-${Date.now()}`;
    setBranches(prev => [...prev, { id: newBranchId, name: `分支 ${prev.length + 1}`, createdAt: Date.now() }]);
    setCurrentBranchId(newBranchId);
    addLog(`Created branch: ${newBranchId}`);
  }, [addLog]);

  const handleBranchSelect = useCallback((branchId: string) => {
    setCurrentBranchId(branchId);
    addLog(`Switched to branch: ${branchId}`);
  }, [addLog]);

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-[280px] h-full flex-shrink-0">
        <ConversationSidebar
          conversations={conversations}
          currentId={currentConversationId ?? ''}
          onSelect={selectConversation}
          onNew={createNewConversation}
          onDelete={handleDeleteConversation}
          onRename={handleRenameConversation}
          loading={convStoreLoading}
        />
      </div>

      <div className="flex-1 h-full flex flex-col min-w-0">
        {isShowWelcome ? (
          <WelcomeCard onQuickAction={action => handleQuickAction(action)} />
        ) : (
          <ChatArea
            messages={streamMessages}
            input={input}
            onSend={handleSend}
            onFilesChange={handleSendFiles}
            isLoading={conversationLoading || isStreaming}
            currentStatus={currentStatus}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            highlightedMessageIndex={highlightedMessageIndex}
            onExport={handleExport}
            onStop={handleStop}
            onRegenerate={handleRegenerate}
            messagesEndRef={messagesEndRef}
            branches={branches}
            currentBranchId={currentBranchId}
          />
        )}
      </div>
      <div className="w-[300px] h-full flex-shrink-0">
        <AgentToolPanel
          currentModel={currentModel}
          onModelChange={handleModelChange}
          availableModels={availableModels.map(m => ({ id: m.model, name: m.name, maxInputTokens: m.maxInputTokens, maxOutputTokens: m.maxOutputTokens }))}
          tokenUsage={currentTokenUsage ?? undefined}
          conversationUsage={conversationTokenUsage}
          requestCount={requestCount}
          usageHistory={usageHistory}
          modelContextLimits={modelContextLimits}
          logs={logs}
          onInsertPrompt={handleInsertPrompt}
        />
      </div>

    </div>
  );
}