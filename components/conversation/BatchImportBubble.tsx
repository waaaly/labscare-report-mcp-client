'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Folder,
  FolderOpen,
  FileText,
  Image,
  CheckCircle2,
  PackageOpen,
} from 'lucide-react';

interface BatchImportDocument {
  fileName: string;
  status: 'pending' | 'uploaded';
  isImage?: boolean;
}

interface BatchImportReport {
  name: string;
  documents: BatchImportDocument[];
}

interface BatchImportProject {
  name: string;
  reports: BatchImportReport[];
}

interface BatchImportBubbleProps {
  labName: string;
  projects: BatchImportProject[];
  fileCount: number;
  className?: string;
}

export function BatchImportBubble({
  labName,
  projects,
  fileCount,
  className,
}: BatchImportBubbleProps) {
  const [collapsedProjects, setCollapsedProjects] = React.useState<Set<number>>(() => {
    const s = new Set<number>();
    projects.forEach((_, i) => s.add(i));
    return s;
  });
  const [collapsedReports, setCollapsedReports] = React.useState<Set<string>>(() => {
    const s = new Set<string>();
    projects.forEach((p, pi) => {
      p.reports.forEach((_, ri) => s.add(`${pi}-${ri}`));
    });
    return s;
  });

  const toggleProject = (idx: number) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleReport = (key: string) => {
    setCollapsedReports((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const reportCount = projects.reduce((acc, p) => acc + p.reports.length, 0);

  return (
    <Card className={cn('max-w-md', className)}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <PackageOpen className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">批量导入</span>
          <Badge className="text-[10px] h-5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">
            {projects.length} 个项目
          </Badge>
          <Badge variant="secondary" className="text-[10px] h-5">
            {reportCount} 个报告
          </Badge>
        </div>

        <div className="space-y-1.5">
          {projects.map((project, pi) => {
            const isProjectOpen = collapsedProjects.has(pi);

            return (
              <div
                key={pi}
                className="rounded-lg border border-blue-500/15 bg-blue-500/5"
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-blue-500/10 rounded-t-lg transition-colors"
                  onClick={() => toggleProject(pi)}
                >
                  {isProjectOpen ? (
                    <FolderOpen className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                  ) : (
                    <Folder className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium truncate">{project.name}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 ml-auto">
                    {project.reports.length} 报告
                  </Badge>
                </button>

                {isProjectOpen && (
                  <div className="px-3 pb-2 space-y-1">
                    {project.reports.map((report, ri) => {
                      const reportKey = `${pi}-${ri}`;
                      const isReportOpen = collapsedReports.has(reportKey);

                      return (
                        <div key={ri} className="pl-4 border-l-2 border-amber-500/20">
                          <button
                            type="button"
                            className="w-full flex items-center gap-1.5 py-1 text-xs hover:text-foreground text-muted-foreground transition-colors"
                            onClick={() => toggleReport(reportKey)}
                          >
                            <span className="truncate">📄 {report.name}</span>
                          </button>

                          {isReportOpen && (
                            <div className="pl-4 pb-1 space-y-0.5">
                              {report.documents.map((doc, di) => (
                                <div
                                  key={di}
                                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                                >
                                  {doc.isImage !== false ? (
                                    <Image className="h-3 w-3 text-green-400 flex-shrink-0" />
                                  ) : (
                                    <FileText className="h-3 w-3 text-orange-400 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{doc.fileName}</span>
                                  {doc.status === 'uploaded' && (
                                    <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-1 border-t flex items-center justify-between text-[10px] text-muted-foreground">
          <span>📍 目标实验室: {labName}</span>
          <span>📦 已上传 {fileCount} 个文件</span>
        </div>
      </CardContent>
    </Card>
  );
}
