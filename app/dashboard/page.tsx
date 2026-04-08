'use client';

import { useEffect, useState } from 'react';
import { useLabStore } from '@/store/lab-store';
import { useProjectStore } from '@/store/project-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FolderKanban,
  FileText,
  Database,
  Clock,
  TrendingUp,
  FlaskConical,
  Plus,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Code,
  Layers,
  Settings,
  Upload,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface TaskStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
}

interface RecentTask {
  id: string;
  name: string;
  status: string;
  progress: number;
  reportName?: string;
  createdAt: number;
  duration?: number;
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { currentLab, isLoading: labLoading } = useLabStore();
  const { projects, loadProjects, isLoading: projectsLoading } = useProjectStore();

  const [taskStats, setTaskStats] = useState<TaskStats>({ total: 0, running: 0, completed: 0, failed: 0 });
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  useEffect(() => {
    if (currentLab) {
      loadProjects(currentLab.id);
      loadTaskStats(currentLab.id);
    }
  }, [currentLab, loadProjects]);

  const loadTaskStats = async (labId: string) => {
    setTasksLoading(true);
    try {
      const response = await fetch(`/api/tasks?labId=${labId}`);
      if (response.ok) {
        const tasks = await response.json();
        const stats: TaskStats = { total: 0, running: 0, completed: 0, failed: 0 };
        tasks.forEach((task: any) => {
          stats.total++;
          if (task.status === 'running' || task.status === 'waiting' || task.status === 'active') {
            stats.running++;
          } else if (task.status === 'completed') {
            stats.completed++;
          } else if (task.status === 'failed') {
            stats.failed++;
          }
        });
        setTaskStats(stats);
        setRecentTasks(tasks.slice(0, 5).map((task: any) => ({
          id: task.id,
          name: task.name,
          status: task.status,
          progress: task.progress,
          reportName: task.reportName,
          createdAt: task.createdAt,
          duration: task.duration,
        })));
      }
    } catch (error) {
      console.error('Failed to load task stats:', error);
    } finally {
      setTasksLoading(false);
    }
  };

  const totalProjects = projects.length;
  const totalDocuments = projects.reduce((sum, p) => sum + (p.documents?.length ?? 0), 0);
  const totalSchemas = projects.reduce((sum, p) => sum + (p.schemas?.length ?? 0), 0);
  const totalScripts = projects.reduce((sum, p) => sum + (p.scripts?.length ?? 0), 0);

  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('time.justNow');
    if (diffMins < 60) return `${diffMins} ${t('time.minutesAgo')}`;
    if (diffHours < 24) return `${diffHours} ${t('time.hoursAgo')}`;
    return `${diffDays} ${t('time.daysAgo')}`;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
      case 'waiting':
      case 'active':
        return (
          <Badge className="bg-primary text-white hover:bg-primary/90">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {t('tasks.running')}
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {t('tasks.completed')}
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-destructive text-white hover:bg-destructive/90">
            <XCircle className="h-3 w-3 mr-1" />
            {t('tasks.failed')}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (labLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentLab) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <FlaskConical className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">{t('noLabSelected')}</h2>
        <p className="text-muted-foreground">{t('selectOrCreateLab')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('welcomeTo')} {currentLab.name} • {t('version')} {currentLab.version}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/tasks/new">
            <Button variant="outline" className="cursor-pointer">
              <PlayCircle className="mr-2 h-4 w-4" />
              {t('newTask')}
            </Button>
          </Link>
          <Link href="/projects/new">
            <Button className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              {t('newProject')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Task Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/tasks'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('tasks.total')}</CardTitle>
            <PlayCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {taskStats.running} {t('tasks.running').toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/tasks?status=running'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('tasks.running')}</CardTitle>
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{taskStats.running}</div>
            <Progress value={taskStats.total > 0 ? (taskStats.running / taskStats.total) * 100 : 0} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/tasks?status=completed'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('tasks.completed')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{taskStats.completed}</div>
            <Progress value={taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0} className="mt-2 h-1 bg-green-100 [&>div]:bg-green-500" />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/tasks?status=failed'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('tasks.failed')}</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{taskStats.failed}</div>
            <Progress value={taskStats.total > 0 ? (taskStats.failed / taskStats.total) * 100 : 0} className="mt-2 h-1 bg-red-100 [&>div]:bg-destructive" />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('tasks.recentTasks')}</CardTitle>
              <CardDescription>{t('tasks.title')}</CardDescription>
            </div>
            <Link href="/tasks">
              <Button variant="ghost" size="sm" className="cursor-pointer">
                {t('viewAllTasks')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : recentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <PlayCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-4">{t('tasks.noTasks')}</p>
                <Link href="/tasks/new">
                  <Button size="sm" className="cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('tasks.createFirstTask')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{task.name}</span>
                          {getStatusBadge(task.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {task.reportName || '-'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getRelativeTime(task.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="w-24">
                        <Progress value={task.progress} className="h-2" />
                        <span className="text-xs text-muted-foreground mt-1 block text-right">{task.progress}%</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Knowledge Base */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                {t('quickActions.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Link href="/projects/new">
                <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1 cursor-pointer">
                  <FolderKanban className="h-5 w-5" />
                  <span className="text-xs">{t('quickActions.createProject')}</span>
                </Button>
              </Link>
              <Link href="/tasks/new">
                <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1 cursor-pointer">
                  <PlayCircle className="h-5 w-5" />
                  <span className="text-xs">{t('quickActions.createTask')}</span>
                </Button>
              </Link>
              <Link href="/documents">
                <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1 cursor-pointer">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">{t('quickActions.uploadDocument')}</span>
                </Button>
              </Link>
              <Link href="/knowledge">
                <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1 cursor-pointer">
                  <Settings className="h-5 w-5" />
                  <span className="text-xs">{t('quickActions.manageKnowledge')}</span>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Knowledge Base Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t('knowledgeBase.title')}</CardTitle>
              <CardDescription>{t('knowledgeBase.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    {t('knowledgeBase.fieldMappings')}
                  </span>
                  <Badge variant="secondary">
                    {Object.keys(currentLab.fieldMappings || {}).length} {t('knowledgeBase.defined')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Code className="h-4 w-4 text-muted-foreground" />
                    {t('knowledgeBase.extractionRules')}
                  </span>
                  <Badge variant="secondary">
                    {Object.keys(currentLab.extractionRules || {}).length} {t('knowledgeBase.defined')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    {t('knowledgeBase.sampleFilters')}
                  </span>
                  <Badge variant="secondary">
                    {Object.keys(currentLab.sampleFilters || {}).length} {t('knowledgeBase.defined')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {t('knowledgeBase.promptTemplates')}
                  </span>
                  <Badge variant="secondary">
                    {Object.keys(currentLab.promptTemplates || {}).length} {t('knowledgeBase.defined')}
                  </Badge>
                </div>
                <div className="pt-3 border-t">
                  <Link href="/knowledge">
                    <Button variant="outline" className="w-full cursor-pointer">
                      {t('knowledgeBase.manage')}
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Project Statistics & Recent Projects */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Project Stats */}
        <div className="grid gap-4 grid-cols-2 lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('statistics.totalProjects')}</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="mr-1 h-3 w-3 inline" />
                {t('statistics.activeProjects')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('statistics.totalDocuments')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDocuments}</div>
              <p className="text-xs text-muted-foreground">
                <Clock className="mr-1 h-3 w-3 inline" />
                {t('statistics.uploadedDocuments')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('statistics.totalSchemas')}</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSchemas}</div>
              <p className="text-xs text-muted-foreground">
                <Database className="mr-1 h-3 w-3 inline" />
                {t('statistics.definedSchemas')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('statistics.totalScripts')}</CardTitle>
              <Code className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalScripts}</div>
              <p className="text-xs text-muted-foreground">
                <Code className="mr-1 h-3 w-3 inline" />
                {t('statistics.generatedScripts')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('projects.title')}</CardTitle>
              <CardDescription>{t('projects.title')}</CardDescription>
            </div>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="cursor-pointer">
                {t('viewAllProjects')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-4">{t('projects.noProjects')}</p>
                <Link href="/projects/new">
                  <Button size="sm" className="cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('projects.createFirstProject')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {projects.slice(0, 4).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium truncate">{project.name}</h3>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {project.description || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {project.documents?.length ?? 0} {t('projects.documents')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        {project.schemas?.length ?? 0} {t('projects.schemas')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Code className="h-3 w-3" />
                        {project.scripts?.length ?? 0} {t('projects.scripts')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
