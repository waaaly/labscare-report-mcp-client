'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, X, FileIcon, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { callMcpTool } from '@/lib/mcp/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Document } from '@/types/index';


interface DocumentViewerProps {
  projectId: string;
}

export default function DocumentViewer({ projectId }: DocumentViewerProps) {
  const { currentProject } = useProjectStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [displayedLogs, setDisplayedLogs] = useState<string[]>([]);
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressLogsRef = useRef<string[]>([]);
  const displayedLogsRef = useRef<string[]>([]);

  useEffect(() => {
    fetchDocuments();
  }, [projectId]);

  useEffect(() => {
    progressLogsRef.current = progressLogs;
  }, [progressLogs]);

  useEffect(() => {
    displayedLogsRef.current = displayedLogs;
  }, [displayedLogs]);

  useEffect(() => {
    if (progressLogs.length === 0) {
      setDisplayedLogs([]);
      setCurrentLogIndex(0);
      setCurrentCharIndex(0);
      return;
    }

    if (currentLogIndex >= progressLogs.length) {
      return;
    }

    const currentLog = progressLogs[currentLogIndex];
    timerRef.current = setTimeout(() => {
      if (currentCharIndex < currentLog.length) {
        const newDisplayed = [...displayedLogsRef.current];
        if (newDisplayed[currentLogIndex] === undefined) {
          newDisplayed[currentLogIndex] = '';
        }
        newDisplayed[currentLogIndex] = currentLog.slice(0, currentCharIndex + 1);
        setDisplayedLogs(newDisplayed);
        setCurrentCharIndex(prev => prev + 1);
      } else {
        setCurrentLogIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }
    }, 10);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentLogIndex, currentCharIndex, progressLogs.length]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayedLogs, currentLogIndex]);

  const fetchDocuments = async () => {
    if (!currentProject?.labId) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/labs/${currentProject.labId}/projects/${projectId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
        fetchDocuments();
      } else {
        const data = await response.json();
        setUploadError(data.error || 'Failed to upload document');
      }
    } catch (err) {
      setUploadError('An error occurred while uploading document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcessDocument = async () => {
    if (!selectedDocumentId) {
      toast.error('Please select a document first');
      return;
    }

    const selectedDoc = documents.find(d => d.id === selectedDocumentId);
    if (!selectedDoc) {
      toast.error('Document not found');
      return;
    }

    setProgressLogs([]);
    setDisplayedLogs([]);
    setCurrentLogIndex(0);
    setCurrentCharIndex(0);
    setIsProcessDialogOpen(true);
    setIsProcessing(true);
    try {
      const result =
        await callMcpTool(
          'parse_labscare_docx',
          {
            docx_path: selectedDoc?.url || '',
            table_desc: ''
          },
          {
            timeout: 120_000,
            onLog: (level, message) => {
              console.log(`[${level}]`, message);
              // 推送到前端状态
              setProgressLogs(prev => [...prev, message]);
            }
          }
        );
      toast.success('Document processed successfully');
      console.log('MCP Tool result:', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process document';
      toast.error(errorMessage);
      console.error('MCP Tool error:', error);
      setProgressLogs(prev => [...prev, `❌ Error: ${errorMessage}`]);
    } finally {
      setIsProcessing(false);
      setIsProcessDialogOpen(false);
    }
  };

  const handleDocumentClick = (docId: string) => {
    setSelectedDocumentId(docId === selectedDocumentId ? null : docId);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) {
      return <FileText className="h-8 w-8 text-primary" />;
    }
    return <FileIcon className="h-8 w-8 text-muted-foreground" />;
  };

  const selectedDocument = documents.find(d => d.id === selectedDocumentId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Documents</h2>
        <div className="flex gap-2">
          {selectedDocumentId && (
            <Button
              onClick={handleProcessDocument}
              disabled={isProcessing}
              className="cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Process Document
                </>
              )}
            </Button>
          )}
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="cursor-pointer">
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
                  <div className="p-3 rounded-lg bg-accent">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {uploadError}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || !selectedFile}
                    className="flex-1 cursor-pointer"
                  >
                    {isUploading ? 'Uploading...' : 'Upload'}
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

          <Dialog open={isProcessDialogOpen} onOpenChange={(open) => {
            if (!open && !isProcessing) {
              setIsProcessDialogOpen(false);
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing Document...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Processing Complete
                    </>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto font-mono text-sm">
                  {progressLogs.length === 0 ? (
                    <span className="text-muted-foreground">Waiting for logs...</span>
                  ) : (
                    displayedLogs.map((log, index) => (
                      <div key={index} className="mb-1 whitespace-pre-wrap">
                        {log}
                        {index === currentLogIndex - 1 && isProcessing && (
                          <span className="animate-pulse">▋</span>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
              {!isProcessing && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={() => setIsProcessDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-muted-foreground">Loading documents...</div>
          </CardContent>
        </Card>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Documents Uploaded</h3>
            <p className="text-muted-foreground text-center mb-4">
              Upload your first PDF, DOC, or DOCX document to start the extraction process
            </p>
            <Dialog open={false} onOpenChange={(open) => open && setIsUploadDialogOpen(true)}>
              <DialogTrigger asChild>
                <Button className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const isSelected = doc.id === selectedDocumentId;
            return (
              <Card
                key={doc.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-lg",
                  isSelected
                    ? "ring-2 ring-primary bg-primary/5 shadow-md"
                    : "hover:shadow-md"
                )}
                onClick={() => handleDocumentClick(doc.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {getFileIcon(doc.type)}
                      <span className="truncate max-w-[150px]" title={doc.name}>
                        {doc.name}
                      </span>
                    </CardTitle>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "h-32 border-2 rounded-lg flex items-center justify-center mb-3 transition-colors",
                    isSelected
                      ? "border-primary/30 bg-primary/5"
                      : "border-dashed border-muted-foreground/20 bg-muted/20"
                  )}>
                    <div className="text-center">
                      {getFileIcon(doc.type)}
                      <p className="text-xs text-muted-foreground mt-2">
                        {isSelected ? 'Selected' : 'Click to select'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card
            className="cursor-pointer hover:shadow-lg border-dashed border-2 hover:border-primary/50 transition-all duration-200"
            onClick={() => setIsUploadDialogOpen(true)}
          >
            <CardContent className="flex flex-col items-center justify-center h-full min-h-[180px]">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Upload Document</p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                PDF, DOC, DOCX
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedDocument && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">
            Selected: {selectedDocument.name}
          </span>
        </div>
      )}
    </div>
  );
}
