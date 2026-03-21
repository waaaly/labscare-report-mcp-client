'use client';

import { useEffect } from 'react';
import { useLabStore } from '@/store/lab-store';
import { useProjectStore } from '@/store/project-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderKanban, FileText, Database, Plus, Clock, TrendingUp, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
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
        <div className="text-muted-foreground">{tCommon('loading')}</div>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('welcomeTo')} {currentLab.name} • {t('version')} {currentLab.version}
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t('newProject')}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalProjects')}</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 inline" />
              {t('activeProjects')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('documents')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              <Clock className="mr-1 h-3 w-3 inline" />
              {t('uploadedDocuments')}
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
              {t('definedSchemas')}
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
              {t('generatedScripts')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('recentProjects')}</CardTitle>
            <CardDescription>{t('yourMostRecentProjects')}</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('noProjectsYet')}
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
                        <div>{project.documents?.length ?? 0} {t('docs')}</div>
                        <div>{project.schemas?.length ?? 0} {t('schemas')}</div>
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
            <CardTitle>{t('knowledgeBase')}</CardTitle>
            <CardDescription>{t('currentLabKnowledgeBaseStatus')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('fieldMappings')}</span>
                <span className="text-sm text-muted-foreground">
                  {Object.keys(currentLab.fieldMappings || {}).length} {t('defined')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('extractionRules')}</span>
                <span className="text-sm text-muted-foreground">
                  {Object.keys(currentLab.extractionRules || {}).length} {t('defined')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('sampleFilters')}</span>
                <span className="text-sm text-muted-foreground">
                  {Object.keys(currentLab.sampleFilters || {}).length} {t('defined')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('promptTemplates')}</span>
                <span className="text-sm text-muted-foreground">
                  {Object.keys(currentLab.promptTemplates || {}).length} {t('defined')}
                </span>
              </div>
              <div className="pt-4 border-t">
                <Link href="/knowledge">
                  <Button variant="outline" className="w-full">
                    {t('manageKnowledgeBase')}
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
