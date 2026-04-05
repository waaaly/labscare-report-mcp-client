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
type MessageType = 'thought' | 'tool' | 'progress' | 'error' | 'info';

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

  // Sample task data
  const sampleTask: TaskDetail = {
    id: taskId,
    name: '2024年血液检测报告批量分析',
    status: 'running',
    progress: 67,
    materials: [
      { id: '1', name: 'blood_test_report.pdf', type: 'pdf', size: 1024 * 500, description: '血液常规检测报告' },
      { id: '2', name: 'patient_info.json', type: 'json', size: 1024 * 2, description: '患者基本信息' },
      { id: '3', name: 'report_template_desc.txt', type: 'description', size: 1024, description: '报告模板描述文件' },
    ],
    createdAt: new Date(Date.now() - 7200000),
    logs: [
      {
        id: '1',
        timestamp: new Date(Date.now() - 7100000),
        type: 'info',
        content: '任务已创建，开始处理物料',
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 7000000),
        type: 'thought',
        content: '正在分析第一个物料：blood_test_report.pdf\n这是一个血液检测报告，需要提取白细胞、红细胞、血小板等关键指标。',
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 6800000),
        type: 'tool',
        content: '调用 OCR 工具解析 PDF 文件\n文件：blood_test_report.pdf\n页数：3 页',
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 6500000),
        type: 'progress',
        content: '已完成 1/3 个物料的处理 (33%)',
        metadata: { current: 1, total: 3 },
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 6000000),
        type: 'thought',
        content: '正在分析第二个物料：patient_info.json\n发现患者年龄：45岁，性别：女性。\n需要结合血液检测结果生成个性化分析报告。',
      },
      {
        id: '6',
        timestamp: new Date(Date.now() - 5500000),
        type: 'tool',
        content: '调用数据提取工具\n从 JSON 文件中提取患者基础信息',
      },
      {
        id: '7',
        timestamp: new Date(Date.now() - 5000000),
        type: 'progress',
        content: '已完成 2/3 个物料的处理 (67%)',
        metadata: { current: 2, total: 3 },
      },
      {
        id: '8',
        timestamp: new Date(Date.now() - 4500000),
        type: 'thought',
        content: '正在分析第三个物料：report_template_desc.txt\n模板要求生成包含指标表格、异常高亮和建议的三段式报告。',
      },
    ],
  };

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
      // In production, fetch from API
      // const response = await fetch(`/api/tasks/${taskId}`);
      // const data = await response.json();
      // setTask(data);
      // setLogs(data.logs || []);

      // Use sample data for now
      await new Promise(resolve => setTimeout(resolve, 500));
      setTask(sampleTask);
      setLogs(sampleTask.logs);
    } catch (error) {
      toast.error('加载任务详情失败');
    } finally {
      setIsLoading(false);
    }
  };

  const connectToStream = () => {
    if (typeof window === 'undefined') return;

    try {
      const eventSource = new EventSource(`/api/tasks/${taskId}/stream`);
      setIsConnected(true);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'log') {
            setLogs(prev => [...prev, data.message]);
          } else if (data.type === 'progress') {
            setTask(prev => prev ? { ...prev, progress: data.progress } : null);
          } else if (data.type === 'status') {
            setTask(prev => prev ? { ...prev, status: data.status } : null);
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    } catch (error) {
      console.error('Failed to connect to stream:', error);
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
