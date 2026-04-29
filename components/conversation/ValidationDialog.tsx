'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FolderOpen,
  Folder,
  AlertTriangle,
  XCircle,
  Image,
  FileText,
  FileJson,
} from 'lucide-react';
import { DirectoryStructure } from './ValidatedStructurePanel';
import type { UploadFileItem } from './UploadProgressDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: DirectoryStructure | null;
  pendingFiles: File[];
  onConfirm: (structure: DirectoryStructure, uploadItems: UploadFileItem[]) => void;
}

export default function ValidationDialog({
  open,
  onOpenChange,
  result,
  pendingFiles,
  onConfirm,
}: Props) {
  if (!result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>目录结构验证</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  type TestCase = DirectoryStructure['testCases'][number];
  const isTestCaseValid = (tc: TestCase) => {
    if (tc.missingJson) return false;
    if (tc.rawReportDirs.length === 0) return false;
    return tc.rawReportDirs.every(rd => !rd.missingTemplatePng && !rd.missingDescMd);
  };

  const passed = result.testCases.filter(isTestCaseValid);
  const failed = result.testCases.filter(tc => !isTestCaseValid(tc));
  const hasPassed = passed.length > 0;

  const handleConfirm = () => {
    const topLevelDir = result.topLevelDir;

    const passedPaths = new Set<string>();
    passed.forEach(tc => {
      const tcPrefix = `${topLevelDir}/${tc.name}`;
      passedPaths.add(tcPrefix);
      tc.rawReportDirs.forEach(rd => {
        passedPaths.add(`${tcPrefix}/${rd.name}`);
      });
    });

    const passedFiles = pendingFiles.filter(f => {
      const rp = (f as any).webkitRelativePath || f.name;
      const lastSlash = rp.lastIndexOf('/');
      const parentPath = lastSlash > 0 ? rp.substring(0, lastSlash) : '';
      return passedPaths.has(parentPath);
    });

    const uploadItems: UploadFileItem[] = passedFiles
      .filter(f => {
        const rp = (f as any).webkitRelativePath || f.name;
        const lower = rp.toLowerCase();
        return lower.endsWith('.png') || lower.endsWith('.jpg') ||
          lower.endsWith('.jpeg') || lower.endsWith('.md') ||
          lower.endsWith('.json');
      })
      .map(f => ({
        relativePath: (f as any).webkitRelativePath || f.name,
        file: f,
      }));

    const filteredStructure: DirectoryStructure = {
      topLevelDir,
      testCases: passed,
      isValid: true,
      errors: [],
    };

    onConfirm(filteredStructure, uploadItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-1.5 rounded-md',
              result.isValid ? 'bg-green-500/10' : 'bg-destructive/10'
            )}>
              {result.isValid
                ? <FolderOpen className="h-5 w-5 text-green-600" />
                : <AlertTriangle className="h-5 w-5 text-destructive" />}
            </div>
            <DialogTitle>
              {result.isValid ? '目录结构验证通过' : '目录结构验证未通过'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {result.isValid
              ? 'Agent 将按照以下映射关系创建项目和报告，请确认后上传'
              : '部分目录不符合要求，请检查以下问题后重新上传'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          {passed.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-green-600" />
                通过检查的目录
                <Badge className="text-[10px] h-5 bg-green-500 hover:bg-green-600">{passed.length}</Badge>
              </h4>
              <div className="space-y-2">
                {passed.map((tc, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium">{tc.name}</span>
                      </div>
                      <Badge className="text-[10px] h-5 bg-green-500 hover:bg-green-600">通过</Badge>
                    </div>

                    <div className="space-y-1.5 pl-2 border-l-2 border-green-500/20">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">目录名称</span>
                        <span className="font-mono text-foreground/80">{tc.name}</span>
                        <span className="text-green-600">→</span>
                        <span className="font-medium text-green-700">项目名称</span>
                      </div>
                      {tc.rawReportDirs.map((rd, ridx) => (
                        <div key={ridx} className="space-y-1 pl-2 border-l border-green-500/15">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">报告目录</span>
                            <span className="font-mono text-foreground/80">{rd.name}</span>
                            <span className="text-green-600">→</span>
                            <span className="font-medium text-green-700">报告名称</span>
                          </div>
                          <div className="flex items-start gap-2 text-xs">
                            <span className="text-muted-foreground">物料文件</span>
                            <div className="flex flex-wrap gap-1">
                              {rd.templatePngs.map((f, fidx) => (
                                <span key={fidx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 font-mono text-[10px]">
                                  <Image className="h-2.5 w-2.5" />
                                  {f}
                                </span>
                              ))}
                              {rd.descMd && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 font-mono text-[10px]">
                                  <FileText className="h-2.5 w-2.5" />
                                  {rd.descMd}
                                </span>
                              )}
                            </div>
                            <span className="text-green-600">→</span>
                            <span className="font-medium text-green-700">报告物料</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <FileJson className="h-3 w-3 text-sky-400" />
                          数据文件（共享）
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">OK</Badge>
                        </div>
                        {['样品数据.json', '流程数据.json'].map(fname => {
                          const found = tc.jsonFiles.includes(fname);
                          return (
                            <div key={fname} className="flex items-center gap-1 text-[11px] text-muted-foreground/80 pl-4">
                              {found
                                ? <span className="text-green-500">✓</span>
                                : <span className="text-muted-foreground/40">✗</span>}
                              <span className={found ? '' : 'text-muted-foreground/40'}>{fname}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="space-y-1.5">
                        {tc.rawReportDirs.map((rd, ridx) => (
                          <div key={ridx} className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <FolderOpen className="h-3 w-3 text-amber-400" />
                              {rd.name}
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">OK</Badge>
                            </div>
                            <div className="pl-4 space-y-0.5">
                              {rd.templatePngs.map((f, fidx) => (
                                <div key={fidx} className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                  <span className="text-green-500">✓</span>
                                  <Image className="h-3 w-3 text-green-400" />
                                  <span>{f}</span>
                                </div>
                              ))}
                              {rd.descMd && (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                  <span className="text-green-500">✓</span>
                                  <FileText className="h-3 w-3 text-orange-400" />
                                  <span>{rd.descMd}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                未通过检查的目录
                <Badge variant="destructive" className="text-[10px] h-5">{failed.length}</Badge>
              </h4>
              <div className="space-y-2">
                {failed.map((tc, idx) => {
                  const tcErrors: string[] = [];
                  if (tc.missingJson) tcErrors.push('缺少 样品数据.json 或 流程数据.json（至少一个）');
                  if (tc.rawReportDirs.length === 0) tcErrors.push('缺少原始报告目录（需含占位符模板.png + 占位符描述文档.md）');
                  tc.rawReportDirs.forEach(rd => {
                    if (rd.missingTemplatePng) tcErrors.push(`${rd.name} 缺少占位符模板图片（.png）`);
                    if (rd.missingDescMd) tcErrors.push(`${rd.name} 缺少占位符描述文档.md`);
                  });

                  return (
                    <div key={idx} className="rounded-lg border border-destructive/10 bg-destructive/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-blue-400" />
                          <span className="text-sm font-medium">{tc.name}</span>
                        </div>
                        <Badge variant="destructive" className="text-[10px] h-5">未通过</Badge>
                      </div>

                      <div className="space-y-1.5">
                        {tcErrors.map((err, eidx) => (
                          <div key={eidx} className="flex items-center gap-2 text-xs text-destructive/90">
                            <XCircle className="h-3 w-3 flex-shrink-0" />
                            {err}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <FileJson className="h-3 w-3 text-sky-400" />
                            数据文件
                            {tc.missingJson
                              ? <XCircle className="h-3 w-3 text-destructive" />
                              : <Badge variant="secondary" className="text-[10px] h-4 px-1">OK</Badge>}
                          </div>
                          {['样品数据.json', '流程数据.json'].map(fname => {
                            const found = tc.jsonFiles.includes(fname);
                            return (
                              <div key={fname} className="flex items-center gap-1 text-[11px] text-muted-foreground/80 pl-4">
                                {found
                                  ? <span className="text-green-500">✓</span>
                                  : <span className="text-muted-foreground/40">✗</span>}
                                <span className={found ? '' : 'text-muted-foreground/40'}>{fname}</span>
                              </div>
                            );
                          })}
                        </div>
                        {tc.rawReportDirs.length > 0 ? tc.rawReportDirs.map((rd, ridx) => (
                          <div key={ridx} className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <FolderOpen className="h-3 w-3 text-amber-400" />
                              {rd.name}
                              {rd.missingTemplatePng || rd.missingDescMd
                                ? <XCircle className="h-3 w-3 text-destructive" />
                                : <Badge variant="secondary" className="text-[10px] h-4 px-1">OK</Badge>}
                            </div>
                            <div className="pl-4 space-y-0.5">
                              {rd.templatePngs.length > 0 ? rd.templatePngs.map((f, fidx) => (
                                <div key={fidx} className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                  <span className="text-green-500">✓</span>
                                  <Image className="h-3 w-3 text-green-400" />
                                  <span>{f}</span>
                                </div>
                              )) : (
                                <div className="flex items-center gap-1 text-[11px] text-destructive/60 pl-1">
                                  <span>✗</span>
                                  <span>缺少占位符模板图片</span>
                                </div>
                              )}
                              {rd.descMd ? (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                  <span className="text-green-500">✓</span>
                                  <FileText className="h-3 w-3 text-orange-400" />
                                  <span>{rd.descMd}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-[11px] text-destructive/60 pl-1">
                                  <span>✗</span>
                                  <span>缺少占位符描述文档.md</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <FolderOpen className="h-3 w-3 text-amber-400" />
                            <span className="text-destructive/60">未找到报告目录</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">期望的目录结构</h4>
            <div className="font-mono text-xs text-muted-foreground space-y-0.5 leading-relaxed">
              <div className="flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5 text-blue-400" />
                <span>顶层目录/</span>
              </div>
              <div className="pl-4 flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5 text-blue-400" />
                <span>测试用例名称/</span>
                <span className="text-[10px] text-green-600/80">→ 项目名称</span>
              </div>
              <div className="pl-8 flex items-center gap-1.5">
                <FileJson className="h-3.5 w-3.5 text-sky-400" />
                <span>样品数据.json</span>
                <span className="text-[10px] text-amber-600/80">(至少一个)</span>
              </div>
              <div className="pl-8 flex items-center gap-1.5">
                <FileJson className="h-3.5 w-3.5 text-sky-400" />
                <span>流程数据.json</span>
                <span className="text-[10px] text-muted-foreground/60">(可选)</span>
              </div>
              <div className="pl-8 flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                <span>原始报告名称1/</span>
                <span className="text-[10px] text-green-600/80">→ 报告名称</span>
              </div>
              <div className="pl-12 flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5 text-green-400" />
                <span>占位符模板.png</span>
                <span className="text-[10px] text-muted-foreground/60">(可多个)</span>
              </div>
              <div className="pl-12 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-orange-400" />
                <span>占位符描述文档.md</span>
              </div>
              <div className="pl-8 flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                <span>原始报告名称2/</span>
                <span className="text-[10px] text-green-600/80">→ 报告名称</span>
              </div>
              <div className="pl-12 flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5 text-green-400" />
                <span>占位符模板.png</span>
              </div>
              <div className="pl-12 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-orange-400" />
                <span>占位符描述文档.md</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          {hasPassed ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleConfirm}>
                确认创建{passed.length > 0 ? `（${passed.length} 个项目）` : ''}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
