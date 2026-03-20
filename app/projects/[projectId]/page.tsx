'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/store/project-store';
import { useLabStore } from '@/store/lab-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, FileText, Database, FileCode, Play } from 'lucide-react';
import Link from 'next/link';
import DocumentViewer from '@/components/workspace/document-viewer';
import AnnotationMapping from '@/components/workspace/annotation-mapping';
import SchemaBuilder from '@/components/workspace/schema-builder';
import LimsDataPanel from '@/components/workspace/lims-data-panel';
import ScriptGenerator from '@/components/workspace/script-generator';
import ExecutionDebug from '@/components/workspace/execution-debug';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { currentProject, loadProject, setCurrentProject, schemas, scripts } = useProjectStore();
  const { currentLab } = useLabStore();
  const [activeTab, setActiveTab] = useState('documents');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (projectId && currentLab?.id) {
      loadProject(projectId, currentLab.id);
    }
    return () => {
      setCurrentProject(null);
    }
  }, [projectId, currentLab?.id, loadProject]);

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
          loadProject(projectId, currentLab.id);
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


  console.log(currentProject)
  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{currentProject.name}</h1>
            <p className="text-muted-foreground">
              {currentProject.description || 'No description'}
            </p>
          </div>
        </div>
        {/* <div className="flex gap-2">
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload Document11
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
          <Button>
            <Play className="mr-2 h-4 w-4" />
            Run Script
          </Button>
        </div> */}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="mapping">
            <FileText className="mr-2 h-4 w-4" />
            Mapping
          </TabsTrigger>
          <TabsTrigger value="schema">
            <Database className="mr-2 h-4 w-4" />
            Schema
          </TabsTrigger>
          <TabsTrigger value="lims">
            <Database className="mr-2 h-4 w-4" />
            LIMS Data
          </TabsTrigger>
          <TabsTrigger value="script">
            <FileCode className="mr-2 h-4 w-4" />
            Script
          </TabsTrigger>
          <TabsTrigger value="debug">
            <Play className="mr-2 h-4 w-4" />
            Debug
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <DocumentViewer projectId={projectId} />
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <AnnotationMapping projectId={projectId} />
        </TabsContent>

        <TabsContent value="schema" className="space-y-4">
          <SchemaBuilder projectId={projectId} />
        </TabsContent>

        <TabsContent value="lims" className="space-y-4">
          <LimsDataPanel projectId={projectId} />
        </TabsContent>

        <TabsContent value="script" className="space-y-4">
          <ScriptGenerator projectId={projectId} />
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          <ExecutionDebug projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
