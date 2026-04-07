'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Upload,
  FileText,
  FileJson,
  Image as ImageIcon,
  Rocket,
  Search,
  X,
  Eye,
  FolderOpen,
  Loader2,
  Copy
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLabStore } from '@/store/lab-store';

// Types
interface Material {
  id: string;
  name: string;
  type: 'pdf' | 'json' | 'image' | 'markdown';
  size?: number;
  description?: string;
  thumbnail?: string;
  url?: string;
  content?: any;
  storagePath?: string;
}

interface Document {
  id: string;
  name: string;
  url: string;
  content: any;
  size?: number;
  type: string;
  status: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
}

interface Task {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

interface Report {
  id: string;
  name: string;
  createdAt: string;
  project: Project;
  documents: Document[];
  task?: Task;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
}

export default function NewBatchTaskPage() {
  const router = useRouter();
  const { currentLab } = useLabStore();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Reports state
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Task config for each report
  interface TaskConfig {
    taskName: string;
    additionalInstructions: string;
    documentUrls: string[];
    advancedParams: {
      temperature: number;
      maxTokens: number;
      model: string;
    };
  }

  const [taskConfigs, setTaskConfigs] = useState<Record<string, TaskConfig>>({});

  // Initialize task config when reports are selected
  useEffect(() => {
    const newConfigs = { ...taskConfigs };
    
    selectedReports.forEach(reportId => {
      if (!newConfigs[reportId]) {
        const report = reports.find(r => r.id === reportId);
        const documentUrls = report?.documents.map(doc => doc.url).filter(Boolean) || [];
        newConfigs[reportId] = {
          taskName: report?.name || '',
          additionalInstructions: '',
          documentUrls,
          advancedParams: {
            temperature: 0.7,
            maxTokens: 4000,
            model: 'claude-sonnet-4.5',
          },
        };
      }
    });
    
    Object.keys(newConfigs).forEach(reportId => {
      if (!selectedReports.has(reportId)) {
        delete newConfigs[reportId];
      }
    });
    
    setTaskConfigs(newConfigs);
  }, [selectedReports, reports]);

  // Fetch reports from API
  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/labs/${currentLab?.id}/reports`);
        if (response.ok) {
          const data = await response.json();
          setReports(data);
        } else {
          toast.error('获取报告列表失败');
        }
      } catch (error) {
        console.error('Error fetching reports:', error);
        toast.error('获取报告时发生错误');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, []);

  // Sample materials for demo
  useEffect(() => {
    const sampleMaterials: Material[] = [
      { id: '1', name: 'blood_test_report.pdf', type: 'pdf', size: 1024 * 500, description: '血液常规检测报告' },
      { id: '2', name: 'patient_info.json', type: 'json', size: 1024 * 2, description: '患者基本信息' },
      { id: '3', name: 'report_template_desc.txt', type: 'markdown', size: 1024, description: '报告模板描述文件' },
      { id: '4', name: 'lab_result_sample.pdf', type: 'pdf', size: 1024 * 800, description: '实验室检测结果示例' },
      { id: '5', name: 'result_schema.json', type: 'json', size: 1024 * 3, description: '结果数据结构定义' },
    ];
    setMaterials(sampleMaterials);
  }, []);

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleToggleMaterial = (materialId: string) => {
    const newSelected = new Set(selectedMaterials);
    if (newSelected.has(materialId)) {
      newSelected.delete(materialId);
    } else {
      newSelected.add(materialId);
    }
    setSelectedMaterials(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMaterials(new Set(filteredMaterials.map(m => m.id)));
    } else {
      setSelectedMaterials(new Set());
    }
  };

  const handleToggleReport = (reportId: string) => {
    const newSelected = new Set(selectedReports);
    if (newSelected.has(reportId)) {
      newSelected.delete(reportId);
    } else {
      newSelected.add(reportId);
    }
    setSelectedReports(newSelected);
  };

  const handleSelectAllReports = (checked: boolean) => {
    if (checked) {
      setSelectedReports(new Set(reports.map(r => r.id)));
    } else {
      setSelectedReports(new Set());
    }
  };

  const getFileIcon = (type: Document['type']) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-6 w-6 text-red-500" />;
      case 'json':
      case 'application/json':
        return <FileJson className="h-6 w-6 text-amber-500" />;
      case 'image':
      case 'image/png':
        return <ImageIcon className="h-6 w-6 text-blue-500" />;
      case 'markdown':
      case 'application/octet-stream':
        return <FileText className="h-6 w-6 text-gray-500" />;
      default:
        return <FileText className="h-6 w-6 text-gray-400" />;
    }
  };

  const getTypeBadge = (type: Document['type']) => {
    switch (type) {
      case 'pdf':
        return <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">PDF</Badge>;
      case 'json':
      case 'application/json':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">JSON</Badge>;
      case 'image':
      case 'image/png':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">图片</Badge>;
      case 'markdown':
      case 'application/octet-stream':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">Markdown</Badge>;
      default:
        return <Badge>未知</Badge>;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getSelectedMaterials = () => materials.filter(m => selectedMaterials.has(m.id));
  const getTotalSize = () => {
    return getSelectedMaterials().reduce((acc, m) => acc + (m.size || 0), 0);
  };
  const getEstimatedTime = () => {
    const count = selectedMaterials.size;
    return count * 2 + ' 分钟';
  };

  const handleUpload = async () => {
    setIsUploading(true);
    // Simulate upload
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success('物料上传成功');
    setIsUploadDialogOpen(false);
    setIsUploading(false);
  };

  const handleImportFromProject = () => {
    toast.info('从项目导入物料功能即将上线');
  };

  const handleStartBatch = async () => {
    if (selectedReports.size === 0) {
      toast.error('请至少选择一个报告');
      return;
    }

    const invalidConfigs = Object.entries(taskConfigs).filter(
      ([_, config]) => !config.taskName.trim()
    );
    if (invalidConfigs.length > 0) {
      toast.error('请为所有选中的报告填写任务名称');
      return;
    }

    try {
      const tasks = reports
        .filter(r => selectedReports.has(r.id))
        .map(report => ({
          reportId: report.id,
          reportName: report.name,
          labId: currentLab?.id,
          ...taskConfigs[report.id],
        }));

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('批量任务已创建');
        router.push('/tasks');
      } else {
        const error = await response.json();
        toast.error(error.message || '创建任务失败');
      }
    } catch (error) {
      toast.error('创建任务时发生错误');
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('已复制到剪贴板');
  };

  const handlePreview = (document: Document) => {
    toast.info(`预览文档: ${document.name}`);
  };

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
            <nav className="text-sm text-muted-foreground mb-1">
              <Link href="/tasks" className="hover:text-primary cursor-pointer">
                任务管理
              </Link>
              {' → '}
              <span className="text-foreground">新建批量任务</span>
            </nav>
            <h1 className="text-2xl font-bold tracking-tight">新建批量任务</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Reports (38%) */}
        <div className="w-[38%] border-r border-gray-200 flex flex-col bg-muted/20">
          <Card className="flex-1 rounded-none border-0 shadow-none m-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-lg">
                  已选报告（{selectedReports.size} 个）
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedReports.size === reports.length && reports.length > 0}
                    onCheckedChange={handleSelectAllReports}
                    id="select-all-reports"
                    className="cursor-pointer"
                  />
                  <Label htmlFor="select-all-reports" className="text-sm cursor-pointer">
                    全选
                  </Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索报告..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 cursor-pointer"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto p-4 pt-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="h-6 w-6 animate-spin text-[#0891B2]" />
                </div>
              ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <FileText className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 mb-2">没有找到报告</p>
                  <p className="text-xs text-gray-400">该实验室下暂无报告数据</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => {
                    const isSelected = selectedReports.has(report.id);
                    return (
                      <Card
                        key={report.id}
                        className={cn(
                          "group hover:shadow-md transition-all duration-200 cursor-pointer border-2",
                          isSelected ? "border-[#0891B2] bg-cyan-50/50" : "border-gray-200"
                        )}
                        onClick={() => handleToggleReport(report.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm font-medium text-gray-900 truncate" title={report.name}>
                                  {report.name}
                                </p>
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                                  {report.project.name}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500 mb-3">
                                创建时间: {new Date(report.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleReport(report.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-pointer"
                            />
                          </div>
                          {report.documents.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-gray-700 mb-2">文档:</p>
                              <div className="grid grid-cols-3 gap-2">
                                {report.documents.map((document) => (
                                  <Card
                                    key={document.id}
                                    className={cn(
                                      "group hover:shadow-md transition-all duration-200 cursor-pointer border-2",
                                      isSelected ? "border-[#0891B2] bg-cyan-50/50" : "border-gray-200"
                                    )}
                                  >
                                    <CardContent className="p-3">
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                          {getFileIcon(document.type)}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate" title={document.name}>
                                              {document.name}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                              {getTypeBadge(document.type)}
                                              <span className="text-xs text-gray-500">
                                                {formatFileSize(document.size)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handlePreview(document);
                                            }}
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}
                          {report.documents.length === 0 && <p className="text-xs text-gray-500 mt-1">该报告暂无文档</p>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>

            {/* Bottom Summary Bar */}
            {selectedReports.size > 0 && (
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    已选 <strong>{selectedReports.size}</strong> 个报告
                  </span>
                  <span className="text-gray-600">
                    预计时长 <strong>{selectedReports.size * 2} 分钟</strong>
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Panel - Configuration (62%) */}
        <div className="flex-1 flex flex-col bg-muted/20 overflow-auto">
          <Card className="flex-1 rounded-none border-0 shadow-none m-0">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl">配置批量任务</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {selectedReports.size === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-16 w-16 text-gray-300 mb-4" />
                  <p className="text-base text-gray-500 mb-2">请先在左侧勾选报告</p>
                  <p className="text-sm text-gray-400">选择报告后可为此配置任务参数</p>
                </div>
              ) : (
                <>
                  {reports.filter(r => selectedReports.has(r.id)).map((report) => {
                    const config = taskConfigs[report.id];
                    if (!config) return null;
                    
                    return (
                      <Card key={report.id} className="border border-gray-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-medium">{report.name}</CardTitle>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                              {report.documents.length} 文档
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              任务名称 <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              placeholder="输入任务名称"
                              value={config.taskName}
                              onChange={(e) => setTaskConfigs({
                                ...taskConfigs,
                                [report.id]: { ...config, taskName: e.target.value }
                              })}
                              className="cursor-pointer"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">LLM 指令</Label>
                            <Textarea
                              placeholder="输入额外的处理指令（可选）"
                              value={config.additionalInstructions}
                              onChange={(e) => setTaskConfigs({
                                ...taskConfigs,
                                [report.id]: { ...config, additionalInstructions: e.target.value }
                              })}
                              rows={3}
                              className="resize-none cursor-pointer"
                            />
                          </div>

                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value={`advanced-${report.id}`} className="border-gray-200">
                              <AccordionTrigger className="text-sm hover:text-primary">
                                高级参数配置
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3 pt-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">模型选择</Label>
                                    <Input
                                      value={config.advancedParams.model}
                                      onChange={(e) => setTaskConfigs({
                                        ...taskConfigs,
                                        [report.id]: {
                                          ...config,
                                          advancedParams: { ...config.advancedParams, model: e.target.value }
                                        }
                                      })}
                                      className="cursor-pointer text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">温度 (0-1)</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      max="1"
                                      value={config.advancedParams.temperature}
                                      onChange={(e) => setTaskConfigs({
                                        ...taskConfigs,
                                        [report.id]: {
                                          ...config,
                                          advancedParams: { ...config.advancedParams, temperature: parseFloat(e.target.value) }
                                        }
                                      })}
                                      className="cursor-pointer text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">最大 Token 数</Label>
                                  <Input
                                    type="number"
                                    value={config.advancedParams.maxTokens}
                                    onChange={(e) => setTaskConfigs({
                                      ...taskConfigs,
                                      [report.id]: {
                                        ...config,
                                        advancedParams: { ...config.advancedParams, maxTokens: parseInt(e.target.value) }
                                      }
                                    })}
                                    className="cursor-pointer text-sm"
                                  />
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </CardContent>
                      </Card>
                    );
                  })}

                  <div className="pt-4">
                    <Button
                      onClick={handleStartBatch}
                      disabled={selectedReports.size === 0}
                      className="w-full h-14 text-lg font-semibold bg-[#0891B2] hover:bg-[#07849F] text-white cursor-pointer disabled:opacity-50"
                    >
                      <Rocket className="h-5 w-5 mr-2" />
                      启动批量生成
                    </Button>
                    <p className="text-center text-xs text-gray-500 mt-2">
                      点击后将创建 {selectedReports.size} 个任务并自动开始处理
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上传新物料</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#0891B2] transition-colors cursor-pointer">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                点击或拖拽文件到此处上传
              </p>
              <p className="text-xs text-gray-500">
                支持 PDF、JSON、图片等格式（最大 50MB）
              </p>
            </div>

            {isUploading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-[#0891B2]" />
                <span className="ml-2 text-sm text-gray-600">上传中...</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1 bg-[#0891B2] hover:bg-[#07849F] text-white cursor-pointer"
              >
                {isUploading ? '上传中...' : '确认上传'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsUploadDialogOpen(false)}
                disabled={isUploading}
                className="flex-1 cursor-pointer"
              >
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
