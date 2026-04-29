'use client';

import { useEffect, useState } from 'react';
import { useLabStore } from '@/store/lab-store';
import { useProjectStore } from '@/store/project-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FolderKanban, Plus, FileText, Database, FileCode, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function ProjectsPage() {
  const { currentLab } = useLabStore();
  const { projects, loadProjects, isLoading, removeProject } = useProjectStore();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (currentLab) {
      loadProjects(currentLab.id);
    }
  }, [currentLab, loadProjects]);

  const handleDelete = async () => {
    if (!deleteTarget || !currentLab) return;
    setIsDeleting(true);
    try {
      await removeProject(deleteTarget.id, currentLab.id);
      setDeleteTarget(null);
    } catch {
      // error already set in store
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading+{currentLab?.name}+ projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your laboratory data extraction projects
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first project to start extracting data from laboratory reports
            </p>
            <Link href="/projects/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full hover:shadow-lg transition-all cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <FolderKanban className="h-5 w-5 text-primary" />
                      {project.name}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteTarget({ id: project.id, name: project.name });
                      }}
                      title="删除项目"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    {project.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                     <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">LMIS Project ID</span>
                      <span className="font-medium">{project.limsPid}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Documents</span>
                      <span className="font-medium">{project.documents?.length ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Schemas</span>
                      <span className="font-medium">{project.schemas?.length ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Scripts</span>
                      <span className="font-medium">{project.scripts?.length ?? 0}</span>
                    </div>
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      Created {format(new Date(project.createdAt), 'MMM d, yyyy')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除项目「{deleteTarget?.name}」吗？此操作会同时删除该项目下的所有报告、物料文件、脚本和任务记录，且不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
