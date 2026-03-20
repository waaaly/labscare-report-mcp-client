'use client';

import { useEffect } from 'react';
import { useLabStore } from '@/store/lab-store';
import { useProjectStore } from '@/store/project-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderKanban, FileText, Database, Plus, Clock, TrendingUp, FlaskConical } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { currentLab, isLoading: labLoading } = useLabStore();
  const { projects, loadProjects, isLoading: projectsLoading } = useProjectStore();

  useEffect(() => {
    if (currentLab) {
      loadProjects(currentLab.id);
    }
  }, [currentLab, loadProjects]);

  const totalProjects = projects.length;
  const totalDocuments = projects.reduce((sum, p) => sum + (p.documents?.length ?? 0), 0);
  const totalSchemas = projects.reduce((sum, p) => sum + (p.schemas?.length ?? 0), 0);
  const totalScripts = projects.reduce((sum, p) => sum + (p.scripts?.length ?? 0), 0);

  if (labLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!currentLab) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <FlaskConical className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">No Lab Selected</h2>
        <p className="text-muted-foreground">Please select or create a lab to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to {currentLab.name} • Version {currentLab.version}
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 inline" />
              Active projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              <Clock className="mr-1 h-3 w-3 inline" />
              Uploaded documents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schemas</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSchemas}</div>
            <p className="text-xs text-muted-foreground">
              <Database className="mr-1 h-3 w-3 inline" />
              Defined schemas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scripts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalScripts}</div>
            <p className="text-xs text-muted-foreground">
              <FileText className="mr-1 h-3 w-3 inline" />
              Generated scripts
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
            <CardDescription>Your most recent projects</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No projects yet. Create your first project to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {projects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{project.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {project.description || 'No description'}
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{project.documents?.length ?? 0} docs</div>
                        <div>{project.schemas?.length ?? 0} schemas</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Knowledge Base</CardTitle>
            <CardDescription>Current lab knowledge base status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Field Mappings</span>
                <span className="text-sm text-muted-foreground">
                  {Object.keys(currentLab.fieldMappings || {}).length} defined
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Extraction Rules</span>
                <span className="text-sm text-muted-foreground">
                  {Object.keys(currentLab.extractionRules || {}).length} defined
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Sample Filters</span>
                <span className="text-sm text-muted-foreground">
                  {Object.keys(currentLab.sampleFilters || {}).length} defined
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Prompt Templates</span>
                <span className="text-sm text-muted-foreground">
                  {Object.keys(currentLab.promptTemplates || {}).length} defined
                </span>
              </div>
              <div className="pt-4 border-t">
                <Link href="/knowledge">
                  <Button variant="outline" className="w-full">
                    Manage Knowledge Base
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
