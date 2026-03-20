'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, X, FileIcon } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';

interface DocumentViewerProps {
  projectId: string;
}

export default function DocumentViewer({ projectId }: DocumentViewerProps) {
  const { currentProject } = useProjectStore();
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; type: string; createdAt: string }>>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [projectId]);

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

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) {
      return <FileText className="h-5 w-5" />;
    }
    return <FileIcon className="h-5 w-5" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Documents</h2>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
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
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {getFileIcon(doc.type)}
                    {doc.name}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="cursor-pointer">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-48 border rounded-lg bg-muted/20 flex items-center justify-center mb-3">
                  <div className="text-center">
                    {getFileIcon(doc.type)}
                    <p className="text-xs text-muted-foreground mt-2">Document preview</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
