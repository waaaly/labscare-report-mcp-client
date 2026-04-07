'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/store/project-store';
import { useLabStore } from '@/store/lab-store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, FileText, Loader2, Sparkles, FileIcon, CheckCircle2, XCircle, X, Badge, Database } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type DocumentProgress = {
  progress: number;
  fileName: string;
  message: string;
  status: string;
}

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { currentProject, loadProject, setCurrentProject,
    reports, loadReports, addReport } = useProjectStore();
  const { currentLab } = useLabStore();


  const [isAddReportDialogOpen, setIsAddReportDialogOpen] = useState(false);
  const [newReportName, setNewReportName] = useState('');
  const [newReportDescription, setNewReportDescription] = useState('');
  const [isFileUploadDrawerOpen, setIsFileUploadDrawerOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (projectId && currentLab?.id) {
      loadProject(projectId, currentLab.id);
      loadReports(projectId, currentLab.id);
    }
    return () => {
      setCurrentProject(null);
    };
  }, [projectId, currentLab?.id, loadProject, setCurrentProject, loadReports]);

  const [documentProgress, setDocumentProgress] = useState<Record<string, DocumentProgress>>({});
  const [completedDocuments, setCompletedDocuments] = useState<number>(0);
  const totalDocumentsRef = useRef<number>(0);

  const connectToSSE = (documentId: string) => {
    const eventSource = new EventSource(`/api/sse/doc-upload-progress/${documentId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setDocumentProgress(prev => ({
          ...prev,
          [documentId]: {
            progress: data.progress || 0,
            fileName: data.fileName || '',
            message: data.message || '',
            status: data.status || 'processing',
          }
        }));

        if (data.status === 'completed' || data.status === 'failed') {
          eventSource.close();
          setCompletedDocuments(prev => {
            const newCompleted = prev + 1;
            
            // 检查是否所有文档都已完成
            if (newCompleted === totalDocumentsRef.current) {
              setTimeout(() => {
                setIsProgressDialogOpen(false);
                setDocumentProgress({});
                setCompletedDocuments(0);
                totalDocumentsRef.current = 0;

                // 显示成功/失败消息
                const allCompleted = Object.values(documentProgress).every(doc => doc.status === 'completed');
                if (allCompleted) {
                  toast.success(`${newCompleted} files uploaded successfully`);
                } else {
                  toast.error('Some files failed to upload');
                }

                // 重新获取报告列表以更新文档信息
                if (selectedReportId && currentLab?.id) {
                  loadReports(projectId, currentLab.id);
                }
              }, 500);
            }
            
            return newCompleted;
          });
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return eventSource;
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one file');
      return;
    }

    if (!currentProject?.labId) {
      setUploadError('Project lab ID not found');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      // 准备表单数据，包含所有选中的文件
      const formData = new FormData();

      // 获取当前选中的报告
      const selectedReport = reports.find(report => report.id === selectedReportId);
      const reportName = selectedReport?.name || '';

      // 添加 reportId 到表单数据
      if (selectedReportId) {
        formData.append('reportId', selectedReportId);
      }

      selectedFiles.forEach(file => {
        // 创建新的File对象，添加报告名称作为前缀
        const prefixedFileName = reportName ? `${reportName}-${file.name}` : file.name;
        const prefixedFile = new File([file], prefixedFileName, { type: file.type });
        formData.append('files', prefixedFile);
      });

      const response = await fetch(`/api/labs/${currentProject.labId}/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          // 记录总文件数
          totalDocumentsRef.current = data.length;
          setCompletedDocuments(0);

          // 初始化进度状态
          const initialProgress: Record<string, DocumentProgress> = {};
          data.forEach((doc: any) => {
            initialProgress[doc.id] = {
              progress: 0,
              fileName: doc.fileName || '',
              message: 'Starting upload...',
              status: 'processing'
            };
          });
          setDocumentProgress(initialProgress);

          // 打开进度对话框
          setIsProgressDialogOpen(true);

          // 为每个文档连接SSE获取进度
          data.forEach((doc: any) => {
            connectToSSE(doc.id);
          });

          // 关闭抽屉
          setIsFileUploadDrawerOpen(false);
          setSelectedFiles([]);


        }
      } else {
        const data = await response.json();
        setUploadError(data.error || 'Failed to upload document');
      }
    } catch (err) {
      setUploadError('An error occurred while uploading the document');
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) {
      return <FileText className="h-5 w-5 text-cyan-600" />;
    }
    return <FileIcon className="h-5 w-5 text-gray-400" />;
  };

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-screen bg-[#f3e8ff]">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="icon" className="cursor-pointer">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{currentProject.name}</h1>
            <p className="text-sm text-gray-500">
              {currentProject.description || 'Automated extraction of blood test results from PDF reports'}
            </p>
          </div>
        </div>
        <Dialog open={isAddReportDialogOpen} onOpenChange={setIsAddReportDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              Add Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="report-name">Report Name</Label>
                <Input
                  id="report-name"
                  type="text"
                  value={newReportName}
                  onChange={(e) => setNewReportName(e.target.value)}
                  placeholder="Enter report name"
                  className="cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-description">Description (Optional)</Label>
                <textarea
                  id="report-description"
                  value={newReportDescription}
                  onChange={(e) => setNewReportDescription(e.target.value)}
                  placeholder="Enter report description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={async () => {
                    if (newReportName.trim() && currentLab?.id) {
                      try {
                        const response = await fetch(`/api/labs/${currentLab.id}/projects/${projectId}/reports`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            name: newReportName.trim(),
                            description: newReportDescription.trim(),
                          }),
                        });
                        if (response.ok) {
                          const newReport = await response.json();
                          addReport(newReport);
                          setIsAddReportDialogOpen(false);
                          setNewReportName('');
                          setNewReportDescription('');
                          toast.success('Report added successfully');
                        } else {
                          const error = await response.json();
                          toast.error(error.error || 'Failed to add report');
                        }
                      } catch (error) {
                        console.error('Failed to add report:', error);
                        toast.error('An error occurred while adding the report');
                      }
                    }
                  }}
                  disabled={!newReportName.trim()}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white cursor-pointer"
                >
                  Add Report
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddReportDialogOpen(false);
                    setNewReportName('');
                    setNewReportDescription('');
                  }}
                  className="flex-1 cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <FileText className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-2">No reports added</p>
            <p className="text-xs text-gray-400">Add your first report to start</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {reports.map((report) => (
              <AccordionItem key={report.id} value={report.id} className="border rounded-lg bg-white px-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cyan-600" />
                      <div className="text-left">
                        <span className="text-sm font-medium">{report.name}</span>
                        {report.description && (
                          <p className="text-xs text-gray-500 mt-1">{report.description}</p>
                        )}
                        {report?.task ? (
                          <p className="text-xs text-gray-500 mt-1">
                            Task: {report.task.name} - {report.task.status}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-1">暂无相关任务</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {report?.task?.status && (
                        <Badge className="text-xs">{report?.task?.status}</Badge>
                      )}
                      <span
                        role="button"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 bg-ghost hover:bg-muted cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReportId(report.id);
                          setIsFileUploadDrawerOpen(true);
                        }}
                      >
                        <Upload className="mr-1 h-3 w-3" />
                        Upload
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 h-full overflow-y-auto">
                  <div className="space-y-4">
                    {report.documents && report.documents.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Documents</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {report.documents.map((doc) => {
                            const fileExtension = doc.name.split('.').pop()?.toLowerCase();
                            let fileType = 'other';
                            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '')) {
                              fileType = 'image';
                            } else if (fileExtension === 'json') {
                              fileType = 'json';
                            } else if (fileExtension === 'md') {
                              fileType = 'md';
                            }

                            if (fileType === 'image') {
                              return (
                                <div key={doc.id} className="w-full aspect-square rounded-lg overflow-hidden border bg-background">
                                  <img
                                    src={process.env.MINIO_PUBLIC_HOST + doc.url || ''}
                                    alt={doc.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              );
                            }

                            if (fileType === 'json') {
                              return (
                                <div key={doc.id} className="w-full aspect-square border rounded-lg bg-background overflow-hidden">
                                  <div className="p-2 h-full flex flex-col">
                                    <div className="flex items-center gap-1 mb-1">
                                      <Database className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                      <span className="text-xs font-medium truncate">{doc.name}</span>
                                    </div>
                                    <pre className="text-xs font-mono bg-muted/30 p-1 rounded flex-1 overflow-hidden text-ellipsis">
                                      {doc.content ? JSON.stringify(doc.content, null, 2) : 'No content'}
                                    </pre>
                                  </div>
                                </div>
                              );
                            }

                            if (fileType === 'md') {
                              return (
                                <div key={doc.id} className="w-full aspect-square border rounded-lg bg-background overflow-hidden">
                                  <div className="p-2 h-full flex flex-col">
                                    <div className="flex items-center gap-1 mb-1">
                                      <FileIcon className="w-3 h-3 text-purple-500 flex-shrink-0" />
                                      <span className="text-xs font-medium truncate">{doc.name}</span>
                                    </div>
                                    <div className="text-xs bg-muted/30 p-1 rounded flex-1 overflow-hidden">
                                      <ReactMarkdown>{doc.content || ''}</ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={doc.id} className="w-full aspect-square flex flex-col justify-between p-2 border rounded-md">
                                <div className="flex items-center gap-2">
                                  {getFileIcon(doc.type || 'other')}
                                  <span className="text-xs truncate flex-1">{doc.name}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                                  <Badge className="text-xs">{doc.status}</Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-500 h-[120px] flex items-center justify-center">
                        No documents uploaded yet
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      <Drawer open={isFileUploadDrawerOpen} onOpenChange={setIsFileUploadDrawerOpen}>
        <DrawerContent className="sm:max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>Upload File</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select File</Label>
              <Input
                id="file-upload"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,.json,.md,.markdown"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    console.log('Selected files:', files);
                    const maxSize = 10 * 1024 * 1024;

                    // 检查每个文件的大小
                    const invalidFile = files.find(file => file.size > maxSize);
                    if (invalidFile) {
                      setUploadError('All files must be less than 10MB');
                      setSelectedFiles([]);
                      return;
                    }

                    setUploadError('');
                    setSelectedFiles(files);
                  }
                }}
                disabled={isUploading}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Supported formats: PDF, DOC, DOCX, Images, JSON, MD (Max 10MB)
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-200">
                <p className="text-sm font-medium text-cyan-900 mb-2">Selected files ({selectedFiles.length}):</p>
                <div className="space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-cyan-800 truncate">{file.name}</span>
                      <span className="text-xs text-cyan-600">
                        {(file.size / 1024).toFixed(2)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {uploadError}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleUpload}
                disabled={isUploading || selectedFiles.length === 0 || !selectedReportId}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsFileUploadDrawerOpen(false);
                  setSelectedFiles([]);
                  setUploadError('');
                }}
                disabled={isUploading}
                className="flex-1 cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#134E4A]">Upload Progress</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {Object.entries(documentProgress).map(([docId, progress]) => (
              <div key={docId} className="space-y-3 p-4 rounded-lg bg-[#F0FDFA] border border-[#2DD4BF]/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${progress.status === 'completed' ? 'bg-green-100 text-green-600' :
                      progress.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-[#2DD4BF]/20 text-[#0D9488]'
                      }`}>
                      {progress.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : progress.status === 'failed' ? (
                        <XCircle className="h-5 w-5" />
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#134E4A]">{progress.fileName || 'Processing file'}</div>
                      <div className="text-xs text-[#134E4A]/70">{progress.message}</div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-[#134E4A]">{progress.progress}%</div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${progress.status === 'completed' ? 'bg-green-500' :
                      progress.status === 'failed' ? 'bg-red-500' : 'bg-[#0D9488]'
                      }`}
                    style={{ width: `${progress.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button
              onClick={() => setIsProgressDialogOpen(false)}
              disabled={Object.values(documentProgress).some(p => p.status === 'processing')}
              className="bg-[#0D9488] hover:bg-[#0D9488]/90 text-white"
            >
              {Object.values(documentProgress).some(p => p.status === 'processing') ? 'Processing...' : 'Close'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
