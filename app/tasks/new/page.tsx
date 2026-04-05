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

// Types
interface Material {
  id: string;
  name: string;
  type: 'pdf' | 'json' | 'image' | 'description';
  size?: number;
  description?: string;
  thumbnail?: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
}

export default function NewBatchTaskPage() {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [taskName, setTaskName] = useState('');
  const [reportType, setReportType] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [advancedParams, setAdvancedParams] = useState({
    temperature: 0.7,
    maxTokens: 4000,
    model: 'claude-sonnet-4.5',
  });

  // Sample report templates
  const reportTemplates: ReportTemplate[] = [
    { id: 'blood-test', name: '血液检测报告', description: '血液生化指标分析报告' },
    { id: 'urinalysis', name: '尿常规报告', description: '尿液分析指标报告' },
    { id: 'comprehensive', name: '综合检测报告', description: '多项目综合分析报告' },
    { id: 'custom', name: '自定义报告', description: '自定义格式的分析报告' },
  ];

  // Sample materials for demo
  useEffect(() => {
    const sampleMaterials: Material[] = [
      { id: '1', name: 'blood_test_report.pdf', type: 'pdf', size: 1024 * 500, description: '血液常规检测报告' },
      { id: '2', name: 'patient_info.json', type: 'json', size: 1024 * 2, description: '患者基本信息' },
      { id: '3', name: 'report_template_desc.txt', type: 'description', size: 1024, description: '报告模板描述文件' },
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

  const getFileIcon = (type: Material['type']) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-6 w-6 text-red-500" />;
      case 'json':
        return <FileJson className="h-6 w-6 text-amber-500" />;
      case 'image':
        return <ImageIcon className="h-6 w-6 text-blue-500" />;
      case 'description':
        return <FileText className="h-6 w-6 text-gray-500" />;
      default:
        return <FileText className="h-6 w-6 text-gray-400" />;
    }
  };

  const getTypeBadge = (type: Material['type']) => {
    switch (type) {
      case 'pdf':
        return <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">PDF</Badge>;
      case 'json':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">JSON</Badge>;
      case 'image':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">图片</Badge>;
      case 'description':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">描述文件</Badge>;
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
    if (!taskName.trim()) {
      toast.error('请输入任务名称');
      return;
    }

    if (selectedMaterials.size === 0) {
      toast.error('请至少选择一个物料');
      return;
    }

    try {
      // Call API to create batch task
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: taskName,
          reportType,
          additionalInstructions,
          materials: getSelectedMaterials(),
          advancedParams,
        }),
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

  const handlePreview = (material: Material) => {
    toast.info(`预览物料: ${material.name}`);
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
        {/* Left Panel - Materials (38%) */}
        <div className="w-[38%] border-r border-gray-200 flex flex-col bg-muted/20">
          <Card className="flex-1 rounded-none border-0 shadow-none m-0">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-lg">
                  已选物料（{selectedMaterials.size} 个）
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedMaterials.size === filteredMaterials.length && filteredMaterials.length > 0}
                    onCheckedChange={handleSelectAll}
                    id="select-all"
                    className="cursor-pointer"
                  />
                  <Label htmlFor="select-all" className="text-sm cursor-pointer">
                    全选
                  </Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索物料..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 cursor-pointer"
                  />
                </div>
                <Button
                  onClick={() => setIsUploadDialogOpen(true)}
                  className="bg-[#0891B2] hover:bg-[#07849F] text-white cursor-pointer"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  上传新物料
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto p-4 pt-0">
              <div className="grid grid-cols-2 gap-3">
                {filteredMaterials.map((material) => {
                  const isSelected = selectedMaterials.has(material.id);
                  return (
                    <Card
                      key={material.id}
                      className={cn(
                        "group hover:shadow-md transition-all duration-200 cursor-pointer border-2",
                        isSelected ? "border-[#0891B2] bg-cyan-50/50" : "border-gray-200"
                      )}
                      onClick={() => handleToggleMaterial(material.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            {getFileIcon(material.type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate" title={material.name}>
                                {material.name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {getTypeBadge(material.type)}
                                <span className="text-xs text-gray-500">
                                  {formatFileSize(material.size)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleMaterial(material.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-pointer"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreview(material);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {material.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 mt-2">
                            {material.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredMaterials.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <FileText className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 mb-2">没有找到物料</p>
                  <p className="text-xs text-gray-400">尝试调整搜索条件或上传新物料</p>
                </div>
              )}
            </CardContent>

            {/* Bottom Summary Bar */}
            {selectedMaterials.size > 0 && (
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600">
                      已选 <strong>{selectedMaterials.size}</strong> 个物料
                    </span>
                    <span className="text-gray-600">
                      总大小 <strong>{formatFileSize(getTotalSize())}</strong>
                    </span>
                  </div>
                  <span className="text-gray-600">
                    预计时长 <strong>{getEstimatedTime()}</strong>
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
              {/* Task Name */}
              <div className="space-y-2">
                <Label htmlFor="task-name" className="text-base font-medium">
                  任务名称 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="task-name"
                  placeholder="输入任务名称，例如：2024年血液检测报告批量分析"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="cursor-pointer"
                />
              </div>

              {/* Report Type */}
              <div className="space-y-2">
                <Label className="text-base font-medium">报告类型</Label>
                <div className="grid grid-cols-2 gap-3">
                  {reportTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 border-2 hover:shadow-md",
                        reportType === template.id
                          ? "border-[#0891B2] bg-cyan-50/50"
                          : "border-gray-200"
                      )}
                      onClick={() => setReportType(template.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-gray-900">{template.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                          </div>
                          {reportType === template.id && (
                            <div className="w-5 h-5 rounded-full bg-[#0891B2] flex items-center justify-center">
                              <X className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Additional Instructions */}
              <div className="space-y-2">
                <Label htmlFor="instructions" className="text-base font-medium">
                  额外 LLM 指令
                </Label>
                <Textarea
                  id="instructions"
                  placeholder="输入额外的处理指令，例如：重点关注异常指标、生成对比分析等（可选）"
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  rows={4}
                  className="resize-none cursor-pointer"
                />
              </div>

              {/* Import from Project */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleImportFromProject}
                  className="flex-1 cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  从已有项目导入物料
                </Button>
              </div>

              {/* Advanced Parameters */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="advanced" className="border-gray-200">
                  <AccordionTrigger className="hover:text-primary">
                    高级参数配置
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="model">模型选择</Label>
                        <Input
                          id="model"
                          value={advancedParams.model}
                          onChange={(e) => setAdvancedParams({...advancedParams, model: e.target.value})}
                          className="cursor-pointer"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="temperature">温度 (0-1)</Label>
                        <Input
                          id="temperature"
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={advancedParams.temperature}
                          onChange={(e) => setAdvancedParams({...advancedParams, temperature: parseFloat(e.target.value)})}
                          className="cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxTokens">最大 Token 数</Label>
                      <Input
                        id="maxTokens"
                        type="number"
                        value={advancedParams.maxTokens}
                        onChange={(e) => setAdvancedParams({...advancedParams, maxTokens: parseInt(e.target.value)})}
                        className="cursor-pointer"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Start Button */}
              <div className="pt-4">
                <Button
                  onClick={handleStartBatch}
                  disabled={!taskName.trim() || selectedMaterials.size === 0}
                  className="w-full h-14 text-lg font-semibold bg-[#0891B2] hover:bg-[#07849F] text-white cursor-pointer disabled:opacity-50"
                >
                  <Rocket className="h-5 w-5 mr-2" />
                  启动批量生成
                </Button>
                <p className="text-center text-xs text-gray-500 mt-2">
                  点击后将创建任务并自动开始处理
                </p>
              </div>
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
