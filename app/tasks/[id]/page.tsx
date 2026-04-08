'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Copy,
  RefreshCw,
  Eye,
  FileText,
  FileJson,
  X,
  RotateCcw,
  Download,
  DownloadCloud,
  Clock,
  FileIcon,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Brain,
  Zap,
  AlertTriangle,
  Calendar,
  Activity,
  Loader2,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Types
type TaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';
type MessageType = 'thought' | 'tool' | 'progress' | 'error' | 'info' | 'content';

interface Message {
  id: string;
  timestamp: Date;
  type: MessageType;
  content: string;
  metadata?: Record<string, any>;
}

interface Material {
  id: string;
  name: string;
  type: 'pdf' | 'json' | 'image' | 'description';
  size?: number;
  description?: string;
}

interface TaskDetail {
  id: string;
  name: string;
  status: TaskStatus;
  progress: number;
  materials: Material[];
  createdAt: Date;
  completedAt?: Date;
  duration?: number;
  logs: Message[];
  result?: string;
}

export default function TaskDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const taskId = params.id as string;
  const defaultTab = searchParams.get('tab') || 'logs';

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [logs, setLogs] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadTaskDetail();

    // Connect to SSE stream
    connectToStream();

    return () => {
      // Clean up SSE connection
      setIsConnected(false);
    };
  }, [taskId]);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    if (scrollRef.current && activeTab === 'logs') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, activeTab]);

  const loadTaskDetail = async () => {
    setIsLoading(true);
    try {
      // 从 API 获取任务详情
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch task detail');
      }
      const data = await response.json();
      // 转换数据格式
      const formattedTask = {
        id: data.id,
        name: data.name,
        status: data.status === 'waiting' ? 'running' : data.status,
        progress: data.progress,
        materials: data.materials.map((material: any) => ({
          id: material.id,
          name: material.name,
          type: material.type,
          size: material.size,
          description: material.description,
        })),
        createdAt: new Date(data.createdAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        duration: data.duration,
        result: data.result,
        logs: [], // 日志通过 SSE 实时获取
      };
      setTask(formattedTask);
      setLogs([]); // 清空日志，通过 SSE 重新获取
    } catch (error) {
      toast.error('加载任务详情失败');
    } finally {
      setIsLoading(false);
    }
  };

  const connectToStream = () => {
    if (typeof window === 'undefined') return;

    try {
      // 可选：支持断线重连时从上次 lastId 继续读取（后面可扩展）
      const eventSource = new EventSource(`/api/tasks/${taskId}/stream`);

      setIsConnected(true);
      console.log(`[SSE] 已连接到任务流: ${taskId}`);

      eventSource.onopen = () => {
        console.log(`[SSE] 连接已建立`);
      };

      // ==================== 核心修改部分 ====================
      // 监听所有事件，包括带 event 字段的消息
      eventSource.addEventListener('message', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received message event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse message event:', e, event.data);
        }
      });

      // 监听带特定 event 字段的消息
      eventSource.addEventListener('connected', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Connected event:', data);
        } catch (e) {
          console.error('Failed to parse connected event:', e, event.data);
        }
      });

      // 监听所有其他事件类型
      eventSource.addEventListener('thought', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received thought event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse thought event:', e, event.data);
        }
      });

      eventSource.addEventListener('reasoning', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received reasoning event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse reasoning event:', e, event.data);
        }
      });

      eventSource.addEventListener('content', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received content event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse content event:', e, event.data);
        }
      });

      eventSource.addEventListener('tool_call', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received tool_call event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse tool_call event:', e, event.data);
        }
      });

      eventSource.addEventListener('status', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received status event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse status event:', e, event.data);
        }
      });

      eventSource.addEventListener('metrics', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received metrics event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse metrics event:', e, event.data);
        }
      });

      eventSource.addEventListener('completed', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received completed event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse completed event:', e, event.data);
        }
      });

      eventSource.addEventListener('finished', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received finished event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse finished event:', e, event.data);
        }
      });

      eventSource.addEventListener('failed', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received failed event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse failed event:', e, event.data);
        }
      });

      eventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received error event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse error event:', e, event.data);
        }
      });

      eventSource.addEventListener('progress', (event: MessageEvent) => {
        try {
          const chunk = JSON.parse(event.data);
          console.log('Received progress event:', chunk);
          processChunk(chunk);
        } catch (e) {
          console.error('Failed to parse progress event:', e, event.data);
        }
      });

      // 处理消息的通用函数
      const processChunk = (chunk: any) => {
        switch (chunk.type) {
          // 思考过程 / 推理内容
          case 'thought':
          case 'reasoning':
            setLogs(prev => [...prev, {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              type: 'thought',
              content: chunk.text || chunk.message || '',
              metadata: { node: chunk.node },
            }]);
            break;

          // 最终输出内容（通常是生成的脚本、报告等）
          case 'content':
            setLogs(prev => [...prev, {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              type: 'content',
              content: chunk.text || '',
              metadata: chunk,
            }]);
            break;

          case 'tool_call':
            // 工具调用
            setLogs(prev => [...prev, {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              type: 'tool',
              content: chunk.message || `调用工具: ${chunk.tool}`,
              metadata: { tool: chunk.tool },
            }]);
            break;

          case 'status':
            // 状态更新
            setTask(prev => prev ? {
              ...prev,
              status: chunk.status || prev.status
            } : null);
            break;

          case 'progress':
            // 进度更新
            setTask(prev => prev ? {
              ...prev,
              progress: chunk.progress || prev.progress
            } : null);
            setLogs(prev => [...prev, {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              type: 'progress',
              content: `进度更新: ${chunk.progress}%`,
              metadata: { progress: chunk.progress },
            }]);
            break;

          case 'metrics':
            // 性能指标（首次 token 时间、总耗时等）
            if (chunk.total_duration) {
              setTask(prev => prev ? { ...prev, duration: chunk.total_duration } : null);
            }
            break;

          case 'completed':
          case 'finished':
            setTask(prev => prev ? { ...prev, status: 'completed', progress: 100 } : null);
            console.log(`[SSE] 任务已完成`);
            // 可选择在这里关闭连接
            // eventSource.close();
            break;

          case 'failed':
            setTask(prev => prev ? { ...prev, status: 'failed' } : null);
            console.error(`[SSE] 任务失败:`, chunk);
            break;

          case 'error':
            console.error(`[SSE] 服务端错误:`, chunk.message);
            break;

          default:
            // 兜底处理未知类型
            console.warn(`[SSE] 未知消息类型:`, chunk.type, chunk);
            setLogs(prev => [...prev, {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              type: 'info',
              content: JSON.stringify(chunk),
            }]);
        }
      };

      // ==================== 错误处理 ====================
      eventSource.onerror = (err) => {
        console.warn(`[SSE] 连接出错`, err);
        setIsConnected(false);

        // 可选：自动重连逻辑（推荐实现）
        setTimeout(() => {
          if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
            console.log(`[SSE] 尝试重连...`);
            connectToStream();   // 重新调用连接函数
          }
        }, 2000);
      };

      // 返回清理函数
      return () => {
        console.log(`[SSE] 正在关闭连接`);
        eventSource.close();
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setIsConnected(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTaskDetail();
    setIsRefreshing(false);
    toast.success('已刷新');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(taskId);
    toast.success('已复制任务 ID');
  };

  const handleCancel = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('任务已取消');
        await loadTaskDetail();
      }
    } catch (error) {
      toast.error('取消任务失败');
    }
  };

  const handleRetry = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/retry`, { method: 'POST' });
      if (response.ok) {
        toast.success('任务已重新开始');
        await loadTaskDetail();
      }
    } catch (error) {
      toast.error('重试任务失败');
    }
  };

  const handleDownloadResult = () => {
    if (!task?.result) return;
    const blob = new Blob([task.result], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-${taskId}-result.js`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('结果已下载');
  };

  const handleCopyResult = () => {
    if (!task?.result) return;
    navigator.clipboard.writeText(task.result);
    toast.success('结果已复制到剪贴板');
  };

  const getMessageIcon = (type: MessageType) => {
    switch (type) {
      case 'thought':
        return <Brain className="h-4 w-4 text-cyan-400" />;
      case 'tool':
        return <Calendar className="h-4 w-4 text-green-400" />;
      case 'progress':
        return <Zap className="h-4 w-4 text-yellow-400" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'info':
        return <Activity className="h-4 w-4 text-blue-400" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getMessageBubbleClass = (type: MessageType) => {
    switch (type) {
      case 'thought':
        return 'bg-cyan-950/50 border-cyan-800/50';
      case 'tool':
        return 'bg-green-950/50 border-green-800/50';
      case 'progress':
        return 'bg-yellow-950/50 border-yellow-800/50';
      case 'error':
        return 'bg-red-950/50 border-red-800/50';
      case 'info':
        return 'bg-blue-950/50 border-blue-800/50';
      default:
        return 'bg-gray-800 border-gray-700';
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'running':
        return (
          <Badge className="bg-[#0891B2] text-white hover:bg-[#07849F]">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            进行中
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            已完成
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500 text-white hover:bg-red-600">
            <XCircle className="h-3 w-3 mr-1" />
            失败
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-gray-500 text-white hover:bg-gray-600">
            <X className="h-3 w-3 mr-1" />
            已取消
          </Badge>
        );
    }
  };

  const getMaterialIcon = (type: Material['type']) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'json':
        return <FileJson className="h-5 w-5 text-amber-500" />;
      case 'image':
        return <FileIcon className="h-5 w-5 text-blue-500" />;
      case 'description':
        return <FileText className="h-5 w-5 text-gray-500" />;
      default:
        return <FileIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (isLoading || !task) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-[#0891B2]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tasks">
            <Button variant="ghost" size="icon" className="cursor-pointer">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{task.name}</h1>
              {getStatusBadge(task.status)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span>ID: {task.id}</span>
              <button
                onClick={handleCopyId}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <Copy className="h-3 w-3" />
              </button>
              <span className="text-gray-300">•</span>
              <span>创建于 {task.createdAt.toLocaleString('zh-CN')}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="cursor-pointer"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            刷新
          </Button>
          {task.status === 'running' && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              className="cursor-pointer"
            >
              <X className="h-4 w-4 mr-2" />
              取消任务
            </Button>
          )}
          {task.status === 'failed' && (
            <Button
              onClick={handleRetry}
              className="bg-green-600 hover:bg-green-700 text-white cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              重试
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-6 py-4 bg-muted/20 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">总进度</p>
                  <p className="text-2xl font-bold text-[#0891B2]">{task.progress}%</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#0891B2]/10 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-[#0891B2]" />
                </div>
              </div>
              <Progress value={task.progress} className="mt-3" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">已用时间</p>
                  <p className="text-2xl font-bold">{formatDuration(task.duration)}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">物料数量</p>
                  <p className="text-2xl font-bold">{task.materials.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <FileIcon className="h-6 w-6 text-purple-500" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                总大小 {formatFileSize(task.materials.reduce((acc, m) => acc + (m.size || 0), 0))}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">日志消息</p>
                  <p className="text-2xl font-bold">{logs.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                {isConnected ? (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    实时连接中
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-gray-400 rounded-full" />
                    已断开
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tabs Content */}
        <div className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="logs" className="cursor-pointer">
                <Activity className="h-4 w-4 mr-2" />
                实时日志
              </TabsTrigger>
              <TabsTrigger value="overview" className="cursor-pointer">
                <FileIcon className="h-4 w-4 mr-2" />
                概览
              </TabsTrigger>
              <TabsTrigger value="result" className="cursor-pointer">
                <DownloadCloud className="h-4 w-4 mr-2" />
                生成结果
              </TabsTrigger>
              <TabsTrigger value="materials" className="cursor-pointer">
                <FileText className="h-4 w-4 mr-2" />
                物料信息
              </TabsTrigger>
            </TabsList>

            {/* Real-time Logs Tab */}
            <TabsContent value="logs" className="h-[calc(100%-60px)] overflow-hidden">
              <Card className="h-full">
                <CardContent className="p-0 h-full">
                  <ScrollArea className="h-full bg-zinc-950">
                    <div ref={scrollRef} className="p-4 space-y-3 min-h-full">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className={cn(
                            "rounded-lg border p-3 transition-all duration-200",
                            getMessageBubbleClass(log.type)
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getMessageIcon(log.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-gray-400 font-mono">
                                  {log.timestamp.toLocaleTimeString('zh-CN')}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {log.type}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                                {log.content}
                              </p>
                              {log.metadata && (
                                <div className="mt-2 p-2 rounded bg-zinc-900 border border-zinc-800">
                                  <pre className="text-xs text-gray-400 font-mono overflow-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Typing indicator for running tasks */}
                      {task.status === 'running' && (
                        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-[#0891B2]" />
                          <span>正在处理中...</span>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Overview Tab */}
            <TabsContent value="overview" className="h-[calc(100%-60px)] overflow-auto">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>任务信息</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm text-gray-500">任务 ID</dt>
                        <dd className="mt-1 font-mono text-sm">{task.id}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">状态</dt>
                        <dd className="mt-1">{getStatusBadge(task.status)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">创建时间</dt>
                        <dd className="mt-1 text-sm">{task.createdAt.toLocaleString('zh-CN')}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">完成时间</dt>
                        <dd className="mt-1 text-sm">
                          {task.completedAt ? task.completedAt.toLocaleString('zh-CN') : '-'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">执行时长</dt>
                        <dd className="mt-1 text-sm">{formatDuration(task.duration)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">总物料数</dt>
                        <dd className="mt-1 text-sm">{task.materials.length}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>物料列表</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {task.materials.map((material) => (
                        <div
                          key={material.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          {getMaterialIcon(material.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{material.name}</p>
                            <p className="text-xs text-gray-500">
                              {material.description} • {formatFileSize(material.size)}
                            </p>
                          </div>
                          <Badge variant="secondary">{material.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Result Tab */}
            <TabsContent value="result" className="h-[calc(100%-60px)] overflow-auto">
              {task.status === 'completed' && task.result ? (
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>生成的脚本</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyResult}
                          className="cursor-pointer"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          复制
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadResult}
                          className="cursor-pointer"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          下载
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 h-[calc(100%-80px)]">
                    <ScrollArea className="h-full">
                      <div className="p-4">
                        <SyntaxHighlighter
                          language="javascript"
                          style={oneDark}
                          customStyle={{ margin: 0, borderRadius: '8px' }}
                        >
                          {task.result}
                        </SyntaxHighlighter>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <DownloadCloud className="h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {task.status === 'running' ? '任务进行中...' : '任务未完成'}
                    </h3>
                    <p className="text-gray-500 text-center">
                      {task.status === 'running'
                        ? '任务完成后将显示生成的脚本'
                        : '请重试或查看日志了解失败原因'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Materials Tab */}
            <TabsContent value="materials" className="h-[calc(100%-60px)] overflow-auto">
              <div className="grid grid-cols-2 gap-4">
                {task.materials.map((material) => (
                  <Card key={material.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {getMaterialIcon(material.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={material.name}>
                            {material.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {material.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary">{material.type}</Badge>
                            <span className="text-xs text-gray-500">
                              {formatFileSize(material.size)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Timeline */}
        <div className="w-80 border-l border-gray-200 bg-white p-4 overflow-auto">
          <h3 className="font-semibold text-sm mb-4">时间线</h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-[#0891B2] text-white flex items-center justify-center text-xs font-medium">
                  1
                </div>
                <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
              </div>
              <div className="flex-1 pb-4">
                <p className="text-sm font-medium">任务创建</p>
                <p className="text-xs text-gray-500">{task.createdAt.toLocaleTimeString('zh-CN')}</p>
              </div>
            </div>

            {task.status !== 'cancelled' && task.status !== 'failed' && (
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                    task.status === 'running' ? "bg-[#0891B2] text-white animate-pulse" : "bg-gray-200 text-gray-600"
                  )}>
                    2
                  </div>
                  <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-medium">物料解析</p>
                  <p className="text-xs text-gray-500">
                    {task.status === 'running' ? '进行中...' : '已完成'}
                  </p>
                </div>
              </div>
            )}

            {task.status === 'completed' && (
              <>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-medium">
                      3
                    </div>
                    <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">脚本生成</p>
                    <p className="text-xs text-gray-500">{task.completedAt?.toLocaleTimeString('zh-CN')}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-medium">
                      4
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">任务完成</p>
                    <p className="text-xs text-gray-500">{task.completedAt?.toLocaleTimeString('zh-CN')}</p>
                  </div>
                </div>
              </>
            )}

            {task.status === 'failed' && (
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-medium">
                    X
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-600">任务失败</p>
                  <p className="text-xs text-gray-500">请查看日志了解详情</p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-sm mb-3">快捷操作</h3>
            <div className="space-y-2">
              {task.status === 'running' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start cursor-pointer"
                  onClick={handleCancel}
                >
                  <X className="h-4 w-4 mr-2" />
                  取消任务
                </Button>
              )}
              {task.status === 'failed' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start cursor-pointer"
                  onClick={handleRetry}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  重试任务
                </Button>
              )}
              {task.status === 'completed' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start cursor-pointer"
                  onClick={handleDownloadResult}
                >
                  <Download className="h-4 w-4 mr-2" />
                  下载结果
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start cursor-pointer"
                onClick={() => setActiveTab('logs')}
              >
                <Activity className="h-4 w-4 mr-2" />
                查看日志
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
