'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Folder, X, ChevronDown, ChevronRight, FileJson, FileText, Image, Image as ImageIcon, File as FileIcon } from 'lucide-react';

export interface RawReportDir {
  name: string;
  files: string[];
  templatePngs: string[];
  descMd: string | null;
  missingTemplatePng: boolean;
  missingDescMd: boolean;
}

export interface DirectoryStructure {
  topLevelDir: string;
  testCases: {
    name: string;
    jsonFiles: string[];
    missingJson: boolean;
    rawReportDirs: RawReportDir[];
  }[];
  isValid: boolean;
  errors: string[];
}

interface ValidatedStructureData {
  structure: DirectoryStructure;
  files: File[];
  previews: Map<string, { preview?: string; previewText?: string }>;
}

interface Props {
  data: ValidatedStructureData;
  onRemove: () => void;
}

export default function ValidatedStructurePanel({ data, onRemove }: Props) {
  const [rootOpen, setRootOpen] = React.useState(true);
  const [openProjects, setOpenProjects] = React.useState<Set<number>>(() => {
    const s = new Set<number>();
    data.structure.testCases.forEach((_, i) => s.add(i));
    return s;
  });
  const [openReports, setOpenReports] = React.useState<Set<string>>(() => {
    const s = new Set<string>();
    data.structure.testCases.forEach((tc, tcIdx) => {
      tc.rawReportDirs.forEach((_, rdIdx) => s.add(`${tcIdx}-${rdIdx}`));
    });
    return s;
  });

  const toggleProject = (idx: number) => {
    setOpenProjects(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleReport = (key: string) => {
    setOpenReports(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="px-3 pt-3 pb-2 border-b">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-1.5 hover:bg-muted/50 rounded px-1 py-0.5 -ml-1 transition-colors"
          onClick={() => setRootOpen(v => !v)}
        >
          {rootOpen
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <FolderOpen className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">上传目录</span>
          <Badge className="text-[10px] h-5 bg-green-500 hover:bg-green-600">
            {data.structure.testCases.length} 个项目
          </Badge>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded bg-background/80 hover:bg-background p-1"
          aria-label="移除目录结构"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {rootOpen && (
        <div className="mt-2 space-y-1.5 max-h-72 overflow-auto pr-1">
          {data.structure.testCases.map((tc, tcIdx) => {
            const tcPathPrefix = `${data.structure.topLevelDir}/${tc.name}`;
            const projectOpen = openProjects.has(tcIdx);
            const reportCount = tc.rawReportDirs.length;

            return (
              <div key={tcIdx} className="rounded-lg border border-green-500/20 bg-green-500/5">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 bg-green-500/10 border-b border-green-500/10 hover:bg-green-500/15 transition-colors"
                  onClick={() => toggleProject(tcIdx)}
                >
                  {projectOpen
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  <Folder className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium">{tc.name}</span>
                  <span className="text-[10px] text-muted-foreground">项目</span>
                  <Badge variant="secondary" className="text-[10px] h-4 ml-auto">
                    {reportCount} 个报告
                  </Badge>
                </button>

                {projectOpen && (
                  <div className="px-3 py-2 space-y-2">
                    {tc.jsonFiles.length > 0 && (
                      <div className="pl-5">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                          <FileJson className="h-3 w-3 text-sky-400" />
                          <span>数据文件</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {tc.jsonFiles.map((jf, jfIdx) => {
                            const rp = `${tcPathPrefix}/${jf}`;
                            const pv = data.previews.get(rp);
                            const fileObj = data.files.find(f => (f as any).webkitRelativePath === rp);
                            return (
                              <div key={jfIdx} className="flex-shrink-0 w-48 rounded border bg-background overflow-hidden">
                                <div className="px-2 py-1.5 border-b bg-muted/30 flex items-center gap-1">
                                  <FileJson className="h-3 w-3 text-sky-400" />
                                  <span className="text-[10px] font-medium truncate">{jf}</span>
                                </div>
                                <div className="p-1.5">
                                  <div className="h-14 w-full overflow-auto rounded bg-muted/60 p-1.5 text-[9px] leading-snug">
                                    {pv?.previewText ? (
                                      <pre className="whitespace-pre-wrap">{pv.previewText}</pre>
                                    ) : (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <FileIcon className="h-3 w-3" />
                                        <span>Loading…</span>
                                      </div>
                                    )}
                                  </div>
                                  {fileObj && (
                                    <div className="mt-0.5 text-[9px] text-muted-foreground">
                                      {(fileObj.size / 1024).toFixed(1)} KB
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {tc.rawReportDirs.map((rd, rdIdx) => {
                      const rdPathPrefix = `${tcPathPrefix}/${rd.name}`;
                      const reportKey = `${tcIdx}-${rdIdx}`;
                      const reportOpen = openReports.has(reportKey);

                      return (
                        <div key={rdIdx} className="pl-5 border-l-2 border-amber-500/20">
                          <button
                            type="button"
                            className="w-full flex items-center gap-1.5 py-1 hover:bg-amber-500/5 rounded px-1 -ml-1 transition-colors"
                            onClick={() => toggleReport(reportKey)}
                          >
                            {reportOpen
                              ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                            <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-xs font-medium">{rd.name}</span>
                            <span className="text-[10px] text-muted-foreground">报告</span>
                          </button>

                          {reportOpen && (
                            <div className="pl-4 pb-1">
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {rd.templatePngs.map((png, pngIdx) => {
                                  const rp = `${rdPathPrefix}/${png}`;
                                  const pv = data.previews.get(rp);
                                  return (
                                    <div key={pngIdx} className="flex-shrink-0 w-28 rounded border bg-background overflow-hidden">
                                      <div className="h-20 w-full">
                                        {pv?.preview ? (
                                          <img src={pv.preview} alt={png} className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="h-full flex items-center justify-center text-muted-foreground">
                                            <ImageIcon className="h-4 w-4" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="px-1.5 py-1 text-[9px] truncate text-muted-foreground flex items-center gap-0.5">
                                        <Image className="h-2.5 w-2.5 text-green-400" />
                                        {png}
                                      </div>
                                    </div>
                                  );
                                })}
                                {rd.descMd && (() => {
                                  const rp = `${rdPathPrefix}/${rd.descMd}`;
                                  const pv = data.previews.get(rp);
                                  const fileObj = data.files.find(f => (f as any).webkitRelativePath === rp);
                                  return (
                                    <div className="flex-shrink-0 w-48 rounded border bg-background overflow-hidden">
                                      <div className="px-2 py-1.5 border-b bg-muted/30 flex items-center gap-1">
                                        <FileText className="h-3 w-3 text-orange-400" />
                                        <span className="text-[10px] font-medium truncate">{rd.descMd}</span>
                                      </div>
                                      <div className="p-1.5">
                                        <div className="h-14 w-full overflow-auto rounded bg-muted/60 p-1.5 text-[9px] leading-snug">
                                          {pv?.previewText ? (
                                            <pre className="whitespace-pre-wrap">{pv.previewText}</pre>
                                          ) : (
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                              <FileIcon className="h-3 w-3" />
                                              <span>Loading…</span>
                                            </div>
                                          )}
                                        </div>
                                        {fileObj && (
                                          <div className="mt-0.5 text-[9px] text-muted-foreground">
                                            {(fileObj.size / 1024).toFixed(1)} KB
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
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
      )}
    </div>
  );
}
