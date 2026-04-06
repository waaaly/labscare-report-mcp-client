'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/store/project-store';
import { useLabStore } from '@/store/lab-store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, FileText, Loader2, Sparkles, FileIcon, CheckCircle2, X, Badge, Database } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import DocumentViewer, { DocumentViewerHandle } from '@/components/workspace/document-viewer';
import AnnotationMapping from '@/components/workspace/annotation-mapping';
import SchemaBuilder from '@/components/workspace/schema-builder';
import LimsDataPanel from '@/components/workspace/lims-data-panel';
import ScriptGenerator from '@/components/workspace/script-generator';
import ExecutionDebug from '@/components/workspace/execution-debug';
import Pipeline from '@/components/workspace/pipeline';
import { PipelineStep, Document, PipelineStepStatus, PipelineStatus } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { currentProject, loadProject, setCurrentProject, documents, setDocuments, updateDocumentPipelineStatus, getDocumentPipelineStatus } = useProjectStore();
  const { currentLab } = useLabStore();
  
  const [currentStep, setCurrentStep] = useState<PipelineStep>('document');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isAddReportDialogOpen, setIsAddReportDialogOpen] = useState(false);
  const [newReportName, setNewReportName] = useState('');
  const [reports, setReports] = useState<Array<{id: string, name: string, materials: Array<{id: string, name: string, type: string, content: string}>}>>([]);
  const [isFileUploadDrawerOpen, setIsFileUploadDrawerOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const documentViewerRef = useRef<DocumentViewerHandle>(null);

  useEffect(() => {
    if (projectId && currentLab?.id) {
      loadProject(projectId, currentLab.id);
    }
    return () => {
      setCurrentProject(null);
    };
  }, [projectId, currentLab?.id, loadProject, setCurrentProject]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setUploadError('File size must be less than 10MB');
        setSelectedFile(null);
        return;
      }

      setUploadError('');
      setSelectedFile(file);
    }
  };

  const connectToSSE = (documentId: string) => {
    const eventSource = new EventSource(`/api/sse/doc-upload-progress/${documentId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setUploadProgress(data.progress || 0);
        setUploadMessage(data.message || '');
        
        if (data.status === 'completed' || data.status === 'failed') {
          eventSource.close();
          setTimeout(() => {
            setIsProgressDialogOpen(false);
            if (data.status === 'completed') {
              toast.success('File uploaded successfully');
            } else {
              toast.error('File upload failed');
            }
          }, 1000);
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
    if (!selectedFile) {
      setUploadError('Please select a file');
      return;
    }

    if (!currentProject?.labId) {
      setUploadError('Project lab ID not found');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('files', selectedFile);

      const response = await fetch(`/api/labs/${currentProject.labId}/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const document = data[0];
          setCurrentDocumentId(document.id);
          setIsProgressDialogOpen(true);
          setUploadProgress(0);
          setUploadMessage('Starting upload...');
          
          // 连接SSE获取进度
          connectToSSE(document.id);
          
          // 关闭抽屉
          setIsFileUploadDrawerOpen(false);
          setSelectedFile(null);
          
          // 更新报告物料
          if (selectedReportId) {
            const fileType = selectedFile.name.split('.').pop() || '';
            let materialType = 'other';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType.toLowerCase())) {
              materialType = 'image';
            } else if (fileType.toLowerCase() === 'json') {
              materialType = 'json';
            } else if (fileType.toLowerCase() === 'md') {
              materialType = 'md';
            }

            const newMaterial = {
              id: document.id,
              name: selectedFile.name,
              type: materialType,
              content: materialType === 'image' ? document.url : 'Processing...'
            };

            setReports(reports.map(report => {
              if (report.id === selectedReportId) {
                return {
                  ...report,
                  materials: [...report.materials, newMaterial]
                };
              }
              return report;
            }));
          }
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

  const getPipelineProgress = (status: PipelineStatus) => {
    const steps = Object.values(status);
    return steps.map((s) => {
      if (s === 'completed') return 'bg-emerald-500';
      if (s === 'in_progress') return 'bg-cyan-500';
      return 'bg-gray-200';
    });
  };

  const handleDocumentClick = (docId: string) => {
    setSelectedDocumentId(docId === selectedDocumentId ? null : docId);
    setCurrentStep('document');
  };


  const handleStepClick = (step: PipelineStep) => {
    if (selectedDocumentId) {
      updateDocumentPipelineStatus(selectedDocumentId, currentStep, 'completed');
      updateDocumentPipelineStatus(selectedDocumentId, step, 'in_progress');
    }
    setCurrentStep(step);
    switch(step){
      case 'document':
        return handleProcessDocument();
      case 'mapping':

    }
  };

  const handleProcessDocument = async () => {
    if (documentViewerRef.current) {
      await documentViewerRef.current.processDocument();
    }
  };

  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentProject?.labId) return;

    try {
      const response = await fetch(`/api/labs/${currentProject.labId}/projects/${projectId}/documents/${docId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDocuments(documents.filter(d => d.id !== docId));
        if (selectedDocumentId === docId) {
          setSelectedDocumentId(null);
        }
        toast.success('Document deleted successfully');
      } else {
        toast.error('Failed to delete document');
      }
    } catch (error) {
      toast.error('An error occurred while deleting the document');
    }
  };

  const renderContent = () => {
    switch (currentStep) {
      case 'document':
        return <DocumentViewer ref={documentViewerRef} projectId={projectId} selectedDocumentId={selectedDocumentId} />;
      case 'mapping':
        return <AnnotationMapping projectId={projectId} />;
      case 'lims':
        return <LimsDataPanel projectId={projectId} />;
      case 'schema':
        return <SchemaBuilder projectId={projectId} />;
      case 'script':
        return <ScriptGenerator projectId={projectId} />;
      case 'debug':
        return <ExecutionDebug projectId={projectId} />;
      default:
        return null;
    }
  };

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  const selectedDocument = documents.find(d => d.id === selectedDocumentId);
  const currentPipelineStatus = selectedDocument ? getDocumentPipelineStatus(selectedDocument.id) : undefined;

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

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    if (newReportName.trim()) {
                      const newReport = {
                        id: Date.now().toString(),
                        name: newReportName.trim(),
                        materials: []
                      };
                      setReports([...reports, newReport]);
                      setIsAddReportDialogOpen(false);
                      setNewReportName('');
                    }
                  }}
                  disabled={!newReportName.trim()}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white cursor-pointer"
                >
                  Add
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddReportDialogOpen(false);
                    setNewReportName('');
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
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="border rounded-lg bg-white">
                <div 
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedReportId(selectedReportId === report.id ? null : report.id)}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-600" />
                    <span className="text-sm font-medium">{report.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedReportId(report.id);
                      setIsFileUploadDrawerOpen(true);
                    }}
                    className="cursor-pointer"
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    Upload
                  </Button>
                </div>
                {selectedReportId === report.id && (
                  <div className="px-4 pb-4">
                    <div className="space-y-3">
                      {report.materials.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          No materials uploaded yet
                        </div>
                      ) : (
                        report.materials.map((material) => {
                          if (material.type === "image") {
                            return (
                              <div key={material.id} className="mt-2 rounded-lg overflow-hidden border bg-background">
                                <img
                                  src={material.content}
                                  alt={material.name}
                                  className="max-w-full h-auto max-h-64 object-contain"
                                />
                                <div className="px-3 py-1 text-xs text-muted-foreground bg-muted/50">
                                  {material.name}
                                </div>
                              </div>
                            );
                          }

                          if (material.type === "json") {
                            return (
                              <div key={material.id} className="mt-2 border rounded-lg bg-background">
                                <div className="px-3 pb-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Database className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-medium">{material.name}</span>
                                  </div>
                                  <pre className="text-xs font-mono bg-muted/30 p-2 rounded overflow-auto max-h-64 overflow-y-auto">
                                    {material.content}
                                  </pre>
                                </div>
                              </div>
                            );
                          }

                          if (material.type === "md") {
                            return (
                              <div key={material.id} className="mt-2 border rounded-lg bg-background">
                                <div className="px-3 pb-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileIcon className="w-4 h-4 text-purple-500" />
                                    <span className="text-sm font-medium">{material.name}</span>
                                  </div>
                                  <div className="text-xs bg-muted/30 p-2 rounded overflow-auto max-h-64 overflow-y-auto">
                                    <ReactMarkdown>{material.content}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
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
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,.json,.md"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const maxSize = 10 * 1024 * 1024;
                    if (file.size > maxSize) {
                      setUploadError('File size must be less than 10MB');
                      setSelectedFile(null);
                      return;
                    }
                    setUploadError('');
                    setSelectedFile(file);
                  }
                }}
                disabled={isUploading}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Supported formats: PDF, DOC, DOCX, Images, JSON, MD (Max 10MB)
              </p>
            </div>

            {selectedFile && (
              <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-200">
                <p className="text-sm font-medium text-cyan-900">{selectedFile.name}</p>
                <p className="text-xs text-cyan-700">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
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
                disabled={isUploading || !selectedFile || !selectedReportId}
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
                  setSelectedFile(null);
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Progress</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-cyan-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {uploadMessage}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
