'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/store/project-store';
import { useLabStore } from '@/store/lab-store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, FileText, Loader2, Sparkles, FileIcon, CheckCircle2, X, Badge } from 'lucide-react';
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
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
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
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setUploadError('Only PDF, DOC, and DOCX files are allowed');
        setSelectedFile(null);
        return;
      }

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
      formData.append('file', selectedFile);

      const response = await fetch(`/api/labs/${currentProject.labId}/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setIsUploadDialogOpen(false);
        setSelectedFile(null);
        if (currentLab?.id) {
          await loadProject(projectId, currentLab.id);
        }
        toast.success('Document uploaded successfully');
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
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="file">Select File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, DOC, DOCX (Max 10MB)
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
                  disabled={isUploading || !selectedFile}
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
                    setIsUploadDialogOpen(false);
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
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-4 text-center">
                <FileText className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-2">No documents uploaded</p>
                <p className="text-xs text-gray-400">Upload your first document to start</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {documents.map((doc) => {
                  const isSelected = doc.id === selectedDocumentId;
                  const pipelineStatus = getDocumentPipelineStatus(doc.id) || {
                    document: 'completed',
                    mapping: 'pending',
                    lims: 'pending',
                    schema: 'pending',
                    script: 'pending',
                    debug: 'pending',
                  };
                  const progressColors = getPipelineProgress(pipelineStatus);

                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleDocumentClick(doc.id)}
                      className={cn(
                        "p-3 rounded-lg border-2 cursor-pointer transition-all duration-200",
                        isSelected
                          ? "border-cyan-500 bg-cyan-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-cyan-300 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getFileIcon(doc.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate" title={doc.name}>
                              {doc.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 cursor-pointer hover:bg-red-50 hover:text-red-600"
                          onClick={(e) => handleDeleteDocument(doc.id, e)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="flex gap-1 h-1.5">
                        {progressColors.map((color, i) => (
                          <div
                            key={i}
                            className={cn("flex-1 rounded-full", color)}
                          />
                        ))}
                      </div>

                      <div className="flex gap-1 mt-2 flex-wrap">
                        {doc.hasIndependentPipeline && (
                          <Badge type="secondary" className="text-xs bg-cyan-100 text-cyan-700 border-cyan-200">
                            独立Pipeline
                          </Badge>
                        )}
                        {doc.hasUniqueSchemaAndScript && (
                          <Badge  type="secondary" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                            独有Schema & JS脚本
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Pipeline
            currentStep={currentStep}
            onStepClick={handleStepClick}
            pipelineStatus={currentPipelineStatus}
          />
          <div className="flex-1 overflow-auto p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
