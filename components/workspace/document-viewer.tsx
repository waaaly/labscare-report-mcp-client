'use client';

import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText, FileIcon, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { callMcpTool } from '@/lib/mcp/client';
import { Document, Page, pdfjs } from 'react-pdf';
console.log(pdfjs.version);
// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker.min.mjs`;

export interface DocumentViewerHandle {
  processDocument: () => Promise<void>;
}

interface DocumentViewerProps {
  projectId: string;
  selectedDocumentId: string | null;
}

const DocumentViewer = forwardRef<DocumentViewerHandle, DocumentViewerProps>(
  ({ projectId, selectedDocumentId }, ref) => {
    const { documents } = useProjectStore();
    const [isLoading, setIsLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const selectedDocument = documents.find(d => d.id === selectedDocumentId);
    const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressLogs, setProgressLogs] = useState<string[]>([]);
    const [displayedLogs, setDisplayedLogs] = useState<string[]>([]);
    const [currentLogIndex, setCurrentLogIndex] = useState(0);
    const [currentCharIndex, setCurrentCharIndex] = useState(0);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const progressLogsRef = useRef<string[]>([]);
    const displayedLogsRef = useRef<string[]>([]);

    useImperativeHandle(ref, () => ({
      processDocument: handleProcessDocument,
    }));

  useEffect(() => {
    if (selectedDocument?.pdf) {
      loadPreview("http://"+selectedDocument.pdf);
    } else {
      setPreviewUrl(null);
      setPreviewError(null);
    }
  }, [selectedDocument]);

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
      console.log(selectedDoc)
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

  const loadPreview = async (url: string) => {
    setIsLoading(true);
    setPreviewError(null);
    try {
      if (url.endsWith('.pdf')) {
        setPreviewUrl(url);
        setPageNumber(1); // Reset page number when loading a new PDF
      } else {
        setPreviewUrl(url);
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
      setPreviewError('Failed to load document preview');
    } finally {
      setIsLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages: np }: { numPages: number }) => {
    setNumPages(np);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) {
      return <FileText className="h-16 w-16 text-cyan-600" />;
    }
    return <FileIcon className="h-16 w-16 text-gray-400" />;
  };

  const renderEmptyState = () => (
    <Card className="border-2 border-dashed border-gray-300">
      <CardContent className="flex flex-col items-center justify-center py-24">
        <FileText className="h-24 w-24 text-gray-300 mb-6" />
        <h3 className="text-2xl font-semibold text-gray-700 mb-3">No Document Selected</h3>
        <p className="text-gray-500 text-center max-w-md mb-6">
          Select a document from the left sidebar to view its preview and start the extraction process
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Upload className="h-4 w-4" />
          <span>Upload a PDF, DOC, or DOCX file to get started</span>
        </div>
      </CardContent>
    </Card>
  );

  const renderPreview = () => {
    if (isLoading) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-16 w-16 text-cyan-500 animate-spin mb-4" />
            <p className="text-gray-600">Loading document preview...</p>
          </CardContent>
        </Card>
      );
    }

    if (previewError) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center justify-center py-24">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-xl font-semibold text-red-700 mb-2">Preview Error</h3>
            <p className="text-red-600 text-center max-w-md">{previewError}</p>
          </CardContent>
        </Card>
      );
    }

    if (!selectedDocument) {
      return renderEmptyState();
    }

    const isPdf = selectedDocument.pdf ?true :false

    return (
      <div className="space-y-4">
      <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Document Information</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">File Type</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedDocument.type.split('/')[1]?.toUpperCase() || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Uploaded Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selectedDocument.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Document ID</p>
                <p className="text-sm font-medium text-gray-900">{selectedDocument.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <p className="text-sm font-medium text-emerald-600">Ready for Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-gray-200 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getFileIcon(selectedDocument.type)}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedDocument.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedDocument.createdAt).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedDocument.pdf) {
                    window.open("http://"+selectedDocument.pdf, '_blank');
                  }
                }}
                className="cursor-pointer"
              >
                Open in New Tab
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              {isPdf ? (
                <div className="w-full h-[600px] overflow-auto">
                  <Document
                    file={previewUrl || ''}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="w-full"
                  >
                    <Page
                      pageNumber={pageNumber}
                      className="mx-auto"
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                  <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                      disabled={pageNumber === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {pageNumber} of {numPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
                      disabled={pageNumber === numPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24">
                  {getFileIcon(selectedDocument.type)}
                  <p className="text-gray-600 mt-4 mb-2">Document Preview</p>
                  <p className="text-sm text-gray-500 text-center max-w-md">
                    This document type is supported for extraction. Click "Open in New Tab" to view the full document.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        
      </div>
    );
  };

  return (
    <div className="h-full">
      {selectedDocument ? renderPreview() : renderEmptyState()}
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
  );
});

DocumentViewer.displayName = 'DocumentViewer';

export default DocumentViewer;
