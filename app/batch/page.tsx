'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Play,
  FileText,
  Upload,
  X,
  PauseCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Buffer } from 'buffer';

// ===== 类型定义 =====

interface FileAttachment {
  name: string;
  type: 'image' | 'json' | 'md';
  content: string;
  preview?: string;
}

interface TaskInput {
  id: string;
  prompt: string;
  files?: FileAttachment[];
  status?: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

interface BatchTask {
  batchId: string;
  taskId: string;
  taskIndex: number;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  prompt: string;
  files?: FileAttachment[];
  createdAt?: number;
  completedAt?: number;
  error?: string;
}

interface TaskStatus {
  taskId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

// ===== 主页面 =====

export default function BatchTasksPage() {
  const router = useRouter();

  const [tasks, setTasks] = useState<TaskInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeBatch, setActiveBatch] = useState<{ 
    batchId: string; 
    taskIds: string[];
    status?: 'waiting' | 'active' | 'completed' | 'failed';
    completedTasks?: number;
    failedTasks?: number;
  } | null>(null);

  // ===== 从 localStorage 获取历史 =====

  const STORAGE_KEY = 'batch-tasks-history:v1';

  useEffect(() => {
    const loadTasks = () => {
      if (typeof window === 'undefined') return;

      try {
        const history = localStorage.getItem(STORAGE_KEY);
        if (history) {
          const parsed = JSON.parse(history);
          setTasks(parsed);
        } else {
          const newTasks: TaskInput[] = [];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newTasks));
          setTasks(newTasks);
        }
      } catch (error) {
        console.error('加载历史任务失败:', error);
      }
    };

    loadTasks();
  }, []);

  // ===== 保存历史到 localStorage =====

  const saveTasks = useCallback((tasksToSave: TaskInput[]) => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksToSave));
    } catch (error) {
      console.error('保存历史任务失败:', error);
    }
  }, []);

  // ===== 任务管理 =====

  const addTask = useCallback(() => {
    const newTask: TaskInput = {
      id: Date.now().toString(36),
      prompt: '',
    };
    setTasks(prev => [...prev, newTask]);
  }, []);

  const updateTask = useCallback((taskId: string, field: string, value: any) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, [field]: value } : task
    ));
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  }, []);

  const clearAllTasks = useCallback(() => {
    setTasks([]);
    }, []);

  // ===== 文件处理 =====

  const handleTaskFilesChange = useCallback((taskId: string, files: File[]) => {
    const processFiles = async () => {
      const attachments: FileAttachment[] = [];
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const buffer = await file.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          attachments.push({
            name: file.name,
            type: 'image',
            content: `data:${file.type};base64,${base64}`,
            preview: `data:${file.type};base64,${base64}`,
          });
        } else if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
          const text = await file.text();
          try {
            const parsed = JSON.parse(text);
            attachments.push({
              name: file.name,
              type: 'json',
              content: JSON.stringify(parsed, null, 2),
            });
          } catch {
            attachments.push({
              name: file.name,
              type: 'json',
              content: text,
            });
          }
        } else if (file.type === 'text/markdown' || file.name.toLowerCase().endsWith('.md')) {
          const text = await file.text();
          attachments.push({
            name: file.name,
            type: 'md',
            content: text,
          });
        }
      }
      return attachments;
    };

    processFiles().then(attachments => {
      updateTask(taskId, 'files', attachments);
    });
  }, [updateTask]);

  const removeTaskFile = useCallback((taskId: string) => {
    updateTask(taskId, 'files', []);
  }, [updateTask]);

  // ===== 批量任务提交 =====

  const submitBatch = async () => {
    const validTasks = tasks.filter(task => task.prompt.trim());

    if (validTasks.length === 0) {
      alert('请至少填写一个任务的提示词');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/llm/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: validTasks.map(task => ({
            prompt: task.prompt,
            files: task.files,
          })),
        }),
      });

      const data = await response.json();

      if (data.batchId) {
        setActiveBatch({
          batchId: data.batchId,
          taskIds: data.taskIds,
        });

        // 清空当前任务列表
        setTasks([]);
      } else {
        alert('提交失败: ' + JSON.stringify(data));
      }
    } catch (error) {
      console.error('提交失败:', error);
      alert('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== 文件类型图标 =====

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Upload className="h-4 w-4 text-blue-500" />;
      case 'json':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'md':
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return null;
    }
  };

  // ===== 状态相关 =====

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting':
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'active':
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'cancelled':
        return <PauseCircle className="h-5 w-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting':
        return '等待中';
      case 'pending':
        return '等待中';
      case 'active':
        return '处理中';
      case 'running':
        return '处理中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      case 'cancelled':
        return '已取消';
      default:
        return '未知';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'active':
      case 'running':
        return 'text-blue-600 bg-blue-50';
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'cancelled':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'waiting':
      case 'pending':
        return 'bg-yellow-50 border-yellow-200';
      case 'active':
      case 'running':
        return 'bg-blue-50 border-blue-200';
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      case 'cancelled':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">批量任务管理</h1>
          <p className="text-sm text-gray-600">
            创建批量报表生成任务，实时监控执行进度和结果
          </p>
        </div>
      </div>

      {/* 主内容 */}
      <div className="container mx-auto py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：新建任务 */}
          <Card>
            <CardHeader>
              <CardTitle>创建批量任务</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {tasks.map((task) => (
                <Card key={task.id} className="border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">任务 {tasks.indexOf(task) + 1}</CardTitle>
                      {task.files && task.files.length > 0 && (
                        <Badge>草稿</Badge>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeTask(task.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">提示词</label>
                      <Textarea
                        value={task.prompt}
                        onChange={(e) => updateTask(task.id, 'prompt', e.target.value)}
                        placeholder="请输入报表生成的提示词，例如：为以下患者生成血常规报告..."
                        className="min-h-[120px]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">上传物料</label>
                      <div className="border-2 border-dashed rounded-lg p-4">
                        <input
                          type="file"
                          multiple
                          onChange={(e) => handleTaskFilesChange(task.id, Array.from(e.target.files || []))}
                          className="w-full"
                          accept="image/*,.json,.md"
                        />
                        {task.files && task.files.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {task.files.map((file, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between p-2 bg-muted rounded-md"
                              >
                                <div className="flex items-center gap-2">
                                  {getFileIcon(file.type)}
                                  <span className="text-sm font-medium">{file.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({file.type.toUpperCase()})
                                  </span>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeTaskFile(task.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="outline" onClick={clearAllTasks}>
                  清空
                </Button>
                <Button onClick={addTask}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加任务
                </Button>
                <Button
                  onClick={submitBatch}
                  disabled={isSubmitting || tasks.length === 0 || tasks.every(t => !t.prompt.trim())}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isSubmitting ? '提交中...' : '提交批量任务'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 中间：历史任务列表 */}
          <Card>
            <CardHeader>
              <CardTitle>历史任务</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeBatch ? (
                <>
                  {/* 当前活跃的批量任务 */}
                  <div className="mb-4 p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      {getStatusIcon(activeBatch?.status || 'waiting')}
                      <div>
                        <div className="text-sm text-muted-foreground">
                            {(activeBatch?.taskIds?.length || 0)} 个任务
                          </div>
                        <div className={`font-semibold ${getStatusColor(activeBatch?.status || 'waiting')}`}>
                          {getStatusText(activeBatch?.status || 'waiting')}
                        </div>
                      </div>
                      <Badge className="bg-blue-500 text-white">
                        进行中
                      </Badge>
                    </div>
                    {((activeBatch.completedTasks || 0) > 0 || (activeBatch.failedTasks || 0) > 0) && (
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600">
                          ✓ {activeBatch.completedTasks || 0} 完成
                        </span>
                        {(activeBatch.failedTasks || 0) > 0 && (
                          <span className="text-red-600">
                            ✗ {activeBatch.failedTasks || 0} 失败
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 任务列表 */}
                  <div className="space-y-2">
                    {tasks.map((task, index) => {
                      const displayPrompt = task.prompt.length > 50 ? task.prompt.slice(0, 50) + '...' : task.prompt;

                      return (
                        <div
                          key={task.id}
                          className={`p-4 rounded-lg border transition-all cursor-pointer hover:bg-accent ${
                            task.status === 'active' ? 'border-blue-500 bg-blue-50' : 'border-border'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              {getStatusIcon(task.status || 'waiting')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-medium text-sm">
                                  任务 {index + 1}
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.status || 'waiting')}`}>
                                  {getStatusText(task.status || 'waiting')}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>

                          {/* 提示词 */}
                          <div className="mb-3">
                            <span className="text-sm text-gray-700">
                              {displayPrompt}
                            </span>
                          </div>

                          {/* 进度条 */}
                          {task.status === 'active' && task.progress !== undefined && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">进度</span>
                                <span className="font-semibold">{task.progress}%</span>
                              </div>
                              <Progress value={task.progress} className="h-1.5" />
                            </div>
                          )}

                          {/* 错误信息 */}
                          {task.status === 'failed' && task.error && (
                            <div className="mb-3 p-3 bg-red-50 text-red-800 rounded-md text-sm">
                              <span className="text-sm font-medium">错误：</span>
                              <span className="text-sm ml-1">{task.error}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p>暂无批量任务</p>
                  <p className="text-sm text-gray-foreground">
                    请先创建批量任务
                  </p>
                  <Button>
                    <Upload className="h-5 w-5 mr-2" />
                    创建批量任务
                  </Button>
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
              <div>
                <div className="text-center py-6">
                  <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p>请先创建批量任务</p>
                  <p className="text-sm text-gray-foreground">
                    在左侧创建任务并提交后，可以在这里查看执行进度和结果
                  </p>
                  <Button size="lg" className="mt-4">
                    <Upload className="h-5 w-5 mr-2" />
                    去创建任务
                  </Button>
                </div>
              </div>

              {/* 快捷操作 */}
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  <p>说明：</p>
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>点击左侧任务列表中的任务查看详情</li>
                  <li>实时获取 LLM 流式输出，就像对话页面一样</li>
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
