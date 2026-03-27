'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function LLMConversationPage() {
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
  }>>([]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    // 1. 先把用户消息加入列表，并给 AI 预留一个空消息位
    const userMessage = {
      role: 'user' as const,
      content: input.trim(),
    };
    const newMessages = [...messages, userMessage];
    setMessages([...newMessages, { role: 'assistant' as const, content: "" }]);
    setInput('');
    setIsLoading(true);

    try {
      // 调用 API
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // 2. 获取读取器
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      // 3. 循环读取流块
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码当前数据块（chunk）
        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;

        // 4. 实时更新最后一条消息（打字机效果核心）
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = assistantText;
          return updated;
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // 更新最后一条消息为错误信息
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = 'Sorry, I encountered an error. Please try again.';
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, messages,]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LLM Conversation</h1>
          <p className="text-muted-foreground">
            Chat with AI models
          </p>
        </div>
      </div>

      <Card className="h-[800px] flex flex-col">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown >
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-4 rounded-lg bg-muted flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1"
              rows={3}
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}