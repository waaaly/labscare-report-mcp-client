'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/store/project-store';
import { useLabStore } from '@/store/lab-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
  const { currentProject, loadProject, documents, schemas, scripts } = useProjectStore();
  const { currentLab } = useLabStore();
  const [activeTab, setActiveTab] = useState('documents');

  useEffect(() => {
    if (projectId && currentLab?.id) {
      loadProject(projectId, currentLab.id);
    }
  }, [projectId, currentLab?.id, loadProject]);
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
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
          <Button>
            <Play className="mr-2 h-4 w-4" />
            Run Script
          </Button>
        </div>
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
