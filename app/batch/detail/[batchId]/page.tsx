'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Play,
  Trash2,
  X,
  RefreshCw,
  Clock,
  Loader2,
  PauseCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ===== 类型定义 =====

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  messageType?: 'thought' | 'tool_call' | 'status' | 'content';
  files?: FileAttachment[];
  tool?: string;
}

interface StreamMessage {
  type: 'content' | 'thought' | 'tool_call' | 'status' | 'metrics' | 'done' | 'error' | 'task_start' | 'task_end' | 'batch_end' | 'ping' | 'batch_status';
  text?: string;
  tool?: string;
  jobId?: string;
  taskIndex?: number;
  completedTasks?: number;
  failedTasks?: number;
  [key: string]: any;
}

interface TaskStatus {
  taskId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

interface FileAttachment {
  name: string;
  type: 'image' | 'json' | 'md';
  content: string;
  preview?: string;
}

// ===== 任务详情页面 =====

interface PageParams {
  params: { batchId: string };
}

export default function BatchDetailPage({ params }: PageParams) {
  const router = useRouter();
  const { batchId } = params;

  const [isConnected, setIsConnected] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskStatus | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ===== 状态获取 =====

  useEffect(() => {
    fetchBatchStatus();

    // 轮询批量任务状态
    const interval = setInterval(() => {
      fetchBatchStatus();
    }, 3000);

    pollIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [batchId]);

  const fetchBatchStatus = async () => {
    try {
      const response = await fetch(`/api/batch/${batchId}`);
      if (response.ok) {
        const status = await response.json();

        // 更新任务状态
        if (status.tasks) {
          status.tasks.forEach((task: any) => {
            if (task.taskId === selectedTaskId && task.status !== 'cancelled') {
              setSelectedTask({
                taskId: task.taskId,
                status: task.status as TaskStatus['status'],
                error: task.error,
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('获取批量任务状态失败:', error);
    }
  };

  // ===== SSE 订阅 =====

  useEffect(() => {
    if (!batchId) return;

    // 清理之前的订阅
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // 订阅批量任务 Stream
    const es = new EventSource(`/api/stream/batch?batchId=${batchId}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setCurrentStatus('已连接到实时流');
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StreamMessage;

        switch (data.type) {
          case 'batch_status':
            // 更新任务列表
            break;

          case 'task_start':
            setCurrentStatus(`任务 ${(data.taskIndex || 0) + 1} 开始执行`);
            if (data.jobId === selectedTaskId) {
              setSelectedTask({
                taskId: data.jobId!,
                status: 'active',
              });
            }
            break;

          case 'content':
          case 'thought':
            setCurrentStatus('接收流式数据...');
            if (data.jobId === selectedTaskId) {
              addMessage({
                role: 'assistant',
                content: data.text || '',
                messageType: data.type,
                isStreaming: true,
              });
            }
            break;

          case 'done':
            setIsLoading(false);
            setCurrentStatus('任务完成');
            if (data.jobId === selectedTaskId) {
              setSelectedTask({
                taskId: data.jobId!,
                status: 'completed',
              });
              }
            // 标记消息为非流式
            setMessages(prev => prev.map(msg =>
              msg.role === 'assistant' && msg.isStreaming
                ? { ...msg, isStreaming: false }
                : msg
            ));
            break;

          case 'error':
            setIsLoading(false);
            setCurrentStatus('任务失败');
            if (data.jobId === selectedTaskId) {
              setSelectedTask({
                taskId: data.jobId!,
                status: 'failed',
                error: data.text,
              });
            }
            addMessage({
              role: 'assistant',
              content: data.text || '处理失败',
              messageType: 'status',
            });
            break;

          case 'batch_end':
            setIsLoading(false);
            setCurrentStatus('所有任务完成');
            break;

          case 'ping':
            // 心跳，保持连接
            break;
        }
      } catch (error) {
        console.error('SSE 消息解析错误:', error);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      setCurrentStatus('连接断开，尝试重连...');
      console.error('[SSE] 连接错误');
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [batchId, selectedTaskId]);

  // ===== 辅助函数 =====

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const selectTask = (taskId: string, taskStatus: TaskStatus) => {
    setSelectedTaskId(taskId);
    setSelectedTask(taskStatus);
    setMessages([]);
    setIsLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'text-yellow-600 bg-yellow-50';
      case 'active':
        return 'text-blue-600 bg-blue-50';
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting':
        return '等待中';
      case 'active':
        return '处理中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Clock className="h-4 w-4" />;
      case 'active':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // ===== 返回批量任务列表 =====

  const handleBack = () => {
    router.push('/batch');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm hover:text-blue-600"
          >
            <RefreshCw className="h-4 w-4" />
            返回任务列表
          </button>
          <h1 className="text-xl font-semibold">批量任务详情</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">批次ID: </span>
            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{batchId.slice(0, 20)}...</code>
          </div>
          {isConnected ? (
            <span className="flex items-center gap-2 text-green-600 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              已连接
            </span>
          ) : (
            <span className="flex items-center gap-2 text-yellow-600 text-sm">
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              连接中...
            </span>
          )}
        </div>
      </div>

      <div className="container mx-auto py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：任务列表 */}
          <Card>
            <CardHeader>
              <CardTitle>任务列表</CardTitle>
            </CardHeader>
            <CardContent>
              {/* TODO: 从 API 获取批量任务列表 */}
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <p>任务列表加载中...</p>
                <p className="text-sm">
                  点击下方"新建任务"按钮创建批量任务
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 中间：任务详情 */}
          <Card>
            <CardHeader>
              <CardTitle>
                任务详情
                {selectedTask && (
                  <span className={`ml-3 text-sm font-normal ${getStatusColor(selectedTask.status)}`}>
                    {getStatusText(selectedTask.status)}
                  </span>
                )}
              </CardTitle>
              {selectedTask && (
                <div className="flex items-center gap-2 ml-auto">
                  {getStatusIcon(selectedTask.status)}
                  <span className="text-sm text-gray-600">
                    {selectedTask.progress !== undefined && `进度: ${selectedTask.progress}%`}
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="min-h-[600px]">
              {selectedTaskId ? (
                <>
                  {/* 当前任务 ID */}
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <span className="text-sm text-gray-600">当前任务 ID：</span>
                    <code className="ml-2 bg-background px-2 py-1 rounded text-xs font-mono">
                      {selectedTaskId}
                    </code>
                  </div>

                  {/* 状态消息 */}
                  {currentStatus && (
                    <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">
                      {currentStatus}
                    </div>
                  )}

                  {/* 消息列表 */}
                  <div className="space-y-4">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg ${msg.messageType === 'thought' ? 'bg-purple-50' : 'bg-muted'}`}
                      >
                        {msg.role === 'user' ? (
                          <div className="flex items-start gap-2">
                            <div className="font-semibold">用户</div>
                            <div className="text-sm text-gray-700">
                              {msg.content}
                              {msg.messageType === 'content' && msg.files && (
                                <div className="mt-2 text-xs text-gray-500">
                                  [文件: {msg.files.length}]
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            {msg.messageType === 'thought' && (
                              <div className="flex items-center gap-2 mb-2">
                                <RefreshCw className="h-4 w-4 text-purple-500" />
                                <span className="font-medium">思考</span>
                              </div>
                            )}
                            {msg.messageType === 'tool_call' && (
                              <div className="flex items-center gap-2 mb-2">
                                <Play className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">
                                  调用: {msg.tool}
                                </span>
                              </div>
                            )}
                            <div className="text-gray-800 whitespace-pre-wrap">
                              {msg.content}
                              {msg.isStreaming && <span className="inline-flex items-center">
                                <span className="animate-pulse">●</span>
                              </span>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 加载中 */}
                  {isLoading && messages.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Loader2 className="h-8 w-8 mx-auto animate-spin" />
                      <p>正在生成...</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-16 w-16 mx-auto mb-4" />
                  <p>请从左侧选择一个任务</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 右侧：控制面板 */}
          <Card>
            <CardHeader>
              <CardTitle>控制面板</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 任务选择器 - TODO: 从 API 获取 */}
              <div className="text-center py-8 text-gray-500 text-sm">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <p>任务列表加载中...</p>
              </div>

              {/* 快捷操作 */}
              <div className="space-y-2">
                <Button variant="outline" onClick={handleBack} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  返回任务列表
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm('确定要清除当前任务的所有消息吗？')) {
                      setMessages([]);
                    setIsLoading(false);
                    }
                  }}
                  disabled={!selectedTaskId || messages.length === 0}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  清除消息
                </Button>
              </div>

              {/* 连接状态 */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">SSE 连接状态</span>
                  {isConnected ? (
                    <Badge className="bg-green-500 text-white">已连接</Badge>
                  ) : (
                    <Badge className="bg-yellow-500 text-white">未连接</Badge>
                  )}
                </div>
                {currentStatus && (
                  <div className="text-sm text-gray-500">
                    {currentStatus}
                  </div>
                )}
              </div>

              {/* 说明 */}
              <div className="text-sm text-gray-500">
                <p className="mb-2">说明：</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>点击左侧任务列表中的任务查看详情</li>
                  <li>实时获取 LLM 流式输出</li>
                  <li>消息流式显示，就像对话页面一样</li>
                  <li>支持思考、工具调用、最终结果</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
