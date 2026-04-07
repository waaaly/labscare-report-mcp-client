'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  RefreshCw,
  Search,
  Copy,
  Eye,
  X,
  RotateCcw,
  FileText,
  FileJson,
  Image as ImageIcon,
  MoreVertical,
  Loader2,
  CheckCircle2,
  XCircle,
  PlayCircle,
  ArrowUpDown
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Types
type TaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';
type TaskFilter = 'all' | 'running' | 'completed' | 'failed';

interface MaterialInfo {
  type: 'pdf' | 'json' | 'image' | 'other';
  count: number;
}

interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  progress: number;
  materials: MaterialInfo[];
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    // Auto-refresh running tasks
    // const interval = setInterval(() => {
    //   if (tasks.some(t => t.status === 'running')) {
    //     loadTasks();
    //   }
    // }, 5000);
    // return () => clearInterval(interval);
  }, [tasks]);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      // 从 API 获取任务列表
      const statusParam = filter !== 'all' ? filter : undefined;
      const url = new URL('/api/tasks', window.location.origin);
      if (statusParam) {
        url.searchParams.append('status', statusParam);
      }
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      const data = await response.json();
      // 转换数据格式
      const formattedTasks = data.map((task: any) => ({
        id: task.id,
        name: task.name,
        status: task.status === 'waiting' ? 'running' : task.status,
        progress: task.progress,
        materials: task.materials.reduce((acc: any[], material: any) => {
          const existing = acc.find(m => m.type === material.type);
          if (existing) {
            existing.count++;
          } else {
            acc.push({ type: material.type, count: 1 });
          }
          return acc;
        }, []),
        createdAt: new Date(task.createdAt),
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        error: task.error,
      }));
      setTasks(formattedTasks);
    } catch (error) {
      toast.error('加载任务列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTasks();
    setIsRefreshing(false);
    toast.success('已刷新任务列表');
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('已复制任务 ID');
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('任务已取消');
        await loadTasks();
      } else {
        toast.error('取消任务失败');
      }
    } catch (error) {
      toast.error('取消任务时发生错误');
    }
  };

  const handleRetryTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/retry`, { method: 'POST' });
      if (response.ok) {
        toast.success('任务已重新开始');
        await loadTasks();
      } else {
        toast.error('重试任务失败');
      }
    } catch (error) {
      toast.error('重试任务时发生错误');
    }
  };

  const handleBatchCancel = async () => {
    try {
      const response = await fetch('/api/tasks/batch-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: Array.from(selectedTasks) }),
      });
      if (response.ok) {
        toast.success(`已取消 ${selectedTasks.size} 个任务`);
        setSelectedTasks(new Set());
        await loadTasks();
      } else {
        toast.error('批量取消失败');
      }
    } catch (error) {
      toast.error('批量取消时发生错误');
    }
  };

  const handleBatchRetry = async () => {
    try {
      const response = await fetch('/api/tasks/batch-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: Array.from(selectedTasks) }),
      });
      if (response.ok) {
        toast.success(`已重试 ${selectedTasks.size} 个任务`);
        setSelectedTasks(new Set());
        await loadTasks();
      } else {
        toast.error('批量重试失败');
      }
    } catch (error) {
      toast.error('批量重试时发生错误');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
    } else {
      setSelectedTasks(new Set());
    }
  };

  const handleToggleSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    return `${diffDays} 天前`;
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-3 w-3 text-red-500" />;
      case 'json':
        return <FileJson className="h-3 w-3 text-amber-500" />;
      case 'image':
        return <ImageIcon className="h-3 w-3 text-blue-500" />;
      default:
        return <FileText className="h-3 w-3 text-gray-400" />;
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

  const getTotalMaterialCount = (materials: MaterialInfo[]) => {
    return materials.reduce((acc, m) => acc + m.count, 0);
  };

  const getFilteredTasks = () => {
    let filtered = [...tasks];

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(t => t.status === filter);
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      switch (dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setDate(now.getDate() - 30);
          break;
      }
      filtered = filtered.filter(t => t.createdAt >= cutoffDate);
    }

    return filtered;
  };

  const filteredTasks = getFilteredTasks();
  const canBatchCancel = selectedTasks.size > 0 && Array.from(selectedTasks).some(
    id => tasks.find(t => t.id === id)?.status === 'running'
  );
  const canBatchRetry = selectedTasks.size > 0 && Array.from(selectedTasks).some(
    id => tasks.find(t => t.id === id)?.status === 'failed'
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">任务管理</h1>
          <p className="text-sm text-muted-foreground">
            管理和监控您的批量任务
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="cursor-pointer"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            刷新
          </Button>
          <Link href="/tasks/new">
            <Button className="bg-[#0891B2] hover:bg-[#07849F] text-white cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />
              新建批量任务
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Status Filters */}
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
            {(['all', 'running', 'completed', 'failed'] as TaskFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer",
                  filter === f
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                {f === 'all' && '全部'}
                {f === 'running' && '进行中'}
                {f === 'completed' && '已完成'}
                {f === 'failed' && '失败'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜索任务..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 cursor-pointer"
            />
          </div>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white cursor-pointer hover:border-gray-300"
          >
            <option value="all">全部时间</option>
            <option value="today">今天</option>
            <option value="week">最近7天</option>
            <option value="month">最近30天</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#0891B2]" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <FileText className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">还没有任务</h3>
                <p className="text-gray-500 text-center mb-6">
                  快去创建您的第一个批量任务吧
                </p>
                <Link href="/tasks/new">
                  <Button className="bg-[#0891B2] hover:bg-[#07849F] text-white cursor-pointer">
                    <Plus className="h-4 w-4 mr-2" />
                    新建批量任务
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {/* Batch Actions */}
                {selectedTasks.size > 0 && (
                  <div className="px-6 py-3 bg-[#0891B2]/10 border-b border-[#0891B2]/20 flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      已选择 <strong>{selectedTasks.size}</strong> 个任务
                    </span>
                    <div className="flex items-center gap-2">
                      {canBatchCancel && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBatchCancel}
                          className="cursor-pointer"
                        >
                          <X className="h-4 w-4 mr-1" />
                          批量取消
                        </Button>
                      )}
                      {canBatchRetry && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBatchRetry}
                          className="cursor-pointer"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          批量重试
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTasks(new Set())}
                        className="cursor-pointer"
                      >
                        取消选择
                      </Button>
                    </div>
                  </div>
                )}

                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="cursor-pointer"
                          />
                        </TableHead>
                        <TableHead className="w-32">任务 ID</TableHead>
                        <TableHead>任务名称</TableHead>
                        <TableHead className="w-40">物料文件</TableHead>
                        <TableHead className="w-32">状态</TableHead>
                        <TableHead className="w-48">进度</TableHead>
                        <TableHead className="w-40">创建时间</TableHead>
                        <TableHead className="w-48">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedTasks.has(task.id)}
                              onChange={() => handleToggleSelection(task.id)}
                              className="cursor-pointer"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-gray-600">
                                {task.id}
                              </span>
                              <button
                                onClick={() => handleCopyId(task.id)}
                                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/tasks/${task.id}`}
                              className="text-sm font-medium text-[#0891B2] hover:text-[#07849F] cursor-pointer"
                            >
                              {task.name}
                            </Link>
                            {task.error && (
                              <p className="text-xs text-red-600 mt-0.5">{task.error}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {task.materials.slice(0, 3).map((m, i) => (
                                <div key={i} className="flex items-center">
                                  {getMaterialIcon(m.type)}
                                  <span className="text-xs text-gray-600 ml-0.5">
                                    {m.count}
                                  </span>
                                </div>
                              ))}
                              {task.materials.length > 3 && (
                                <span className="text-xs text-gray-500 ml-1">
                                  +{getTotalMaterialCount(task.materials) - task.materials.slice(0, 3).reduce((acc, m) => acc + m.count, 0)}
                                </span>
                              )}
                              <Badge variant="secondary" className="ml-2">
                                {getTotalMaterialCount(task.materials)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(task.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={task.progress} className="flex-1 h-2" />
                              <span className="text-xs text-gray-600 min-w-[40px]">
                                {task.progress}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {getRelativeTime(task.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Link href={`/tasks/${task.id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="cursor-pointer"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              {task.status === 'running' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelTask(task.id)}
                                  className="cursor-pointer hover:text-red-600"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                              {task.status === 'failed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRetryTask(task.id)}
                                  className="cursor-pointer hover:text-green-600"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleCopyId(task.id)} className="cursor-pointer">
                                    <Copy className="h-4 w-4 mr-2" />
                                    复制 ID
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {task.status === 'completed' && (
                                    <DropdownMenuItem onClick={() => router.push(`/tasks/${task.id}?tab=result`)} className="cursor-pointer">
                                      <FileJson className="h-4 w-4 mr-2" />
                                      查看结果
                                    </DropdownMenuItem>
                                  )}
                                  {task.status === 'failed' && (
                                    <DropdownMenuItem onClick={() => handleRetryTask(task.id)} className="cursor-pointer">
                                      <RotateCcw className="h-4 w-4 mr-2" />
                                      重试任务
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
