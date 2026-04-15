'use client';

import { useEffect, useRef } from 'react';
import { useScriptStore } from '@/store/script-store';
import { useLabStore } from '@/store/lab-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Code, Database, FileText, ArrowLeft, FolderKanban, FileVolume, Activity, Terminal } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import JSONEditor from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.min.css';

// 自定义 JSONEditor 样式
const customStyles = `
  <style>
    /* 覆盖 JSONEditor 默认蓝色配色 */
    .jsoneditor, .jsoneditor-menu {
      border-color: #0891B2 !important;
    }
    .jsoneditor-menu {
      background-color: #ECFEFF !important;
    }
    .jsoneditor-field {
      color: #164E63 !important;
    }
    .jsoneditor-value {
      color: #059669 !important;
    }
    .jsoneditor-string {
      color: #059669 !important;
    }
    .jsoneditor-number {
      color: #0891B2 !important;
    }
    .jsoneditor-boolean {
      color: #164E63 !important;
    }
    .jsoneditor-null {
      color: #64748B !important;
    }
  </style>
`;

// 注入自定义样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('div');
  styleElement.innerHTML = customStyles;
  document.head.appendChild(styleElement.firstChild as Node);
}

export default function ScriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentLab } = useLabStore();
  const { currentScript, loadScript, isLoading, error } = useScriptStore();
  const jsonEditorRef = useRef<HTMLDivElement>(null);
  const jsonEditorInstance = useRef<JSONEditor | null>(null);

  useEffect(() => {
    if (currentLab && id) {
      loadScript(currentLab.id, id);
    }
  }, [currentLab, id, loadScript]);

  useEffect(() => {
    if (jsonEditorRef.current && currentScript?.dataSource) {
      // 销毁之前的实例
      if (jsonEditorInstance.current) {
        jsonEditorInstance.current.destroy();
      }

      // 初始化 JSONEditor
      const editor = new JSONEditor(jsonEditorRef.current, {
        mode: 'view',
        indentation: 2,
        theme: 'light',
        statusBar: false,
        search: false,
        navigationBar: false
      });

      // 设置数据
      editor.set(currentScript.dataSource);
      jsonEditorInstance.current = editor;
    }

    // 清理函数
    return () => {
      if (jsonEditorInstance.current) {
        jsonEditorInstance.current.destroy();
      }
    };
  }, [currentScript?.dataSource]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading script details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!currentScript) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Script not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#ECFEFF] p-6 rounded-lg">
        <div className="flex items-center gap-4">
          <Link href="/scripts">
            <Button variant="ghost" size="icon" className="cursor-pointer hover:bg-white/50">
              <ArrowLeft className="h-5 w-5 text-[#164E63]" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#164E63]">Script Details</h1>
            <p className="text-muted-foreground">
              View and manage your script
            </p>
          </div>
        </div>
      </div>

      {/* 顶部卡片展示脚本数据和模拟运行按钮 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">{currentScript.name}</CardTitle>
          <Button
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Run Script
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Project Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-[#ECFEFF] rounded-md">
                  <FolderKanban className="h-5 w-5 text-[#0891B2]" />
                </div>
                <h3 className="font-semibold text-[#164E63]">Project</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{currentScript.project?.name || '-'}</p>
                {currentScript.project?.limsPid && (
                  <p className="text-muted-foreground">LMIS ID: {currentScript.project.limsPid}</p>
                )}
                {currentScript.project?.createdAt && (
                  <p className="text-muted-foreground">
                    Created: {new Date(currentScript.project.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Report Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-[#ECFEFF] rounded-md">
                  <FileVolume className="h-5 w-5 text-[#0891B2]" />
                </div>
                <h3 className="font-semibold text-[#164E63]">Report</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{currentScript.report?.name || '-'}</p>
                {currentScript.report?.description && (
                  <p className="text-muted-foreground line-clamp-2">{currentScript.report.description}</p>
                )}
                {currentScript.report?.createdAt && (
                  <p className="text-muted-foreground">
                    Created: {new Date(currentScript.report.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Task Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-[#ECFEFF] rounded-md">
                  <Activity className="h-5 w-5 text-[#0891B2]" />
                </div>
                <h3 className="font-semibold text-[#164E63]">Task</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">{currentScript.task?.id || '-'}</p>
                {currentScript.task?.status && (
                  <p className="text-muted-foreground">Status: {currentScript.task.status}</p>
                )}
                {currentScript.task?.model && (
                  <p className="text-muted-foreground">Model: {currentScript.task.model}</p>
                )}
                {currentScript.task?.duration && (
                  <p className="text-muted-foreground">Duration: {currentScript.task.duration}s</p>
                )}
              </div>
            </div>

            {/* Script Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-[#ECFEFF] rounded-md">
                  <Terminal className="h-5 w-5 text-[#0891B2]" />
                </div>
                <h3 className="font-semibold text-[#164E63]">Script</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">Version: {currentScript.version || 1}</p>
                <p className="text-muted-foreground">
                  Created: {new Date(currentScript.createdAt).toLocaleString()}
                </p>
                {currentScript.updatedAt && (
                  <p className="text-muted-foreground">
                    Updated: {new Date(currentScript.updatedAt).toLocaleString()}
                  </p>
                )}
                {currentScript.dataSource && (
                  <p className="text-muted-foreground">
                    Data Source: {currentScript.dataSource.name || '-'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主体内容：左侧JS编辑器，右侧Tab布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧JS编辑器 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Script Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <SyntaxHighlighter
                language="javascript"
                showLineNumbers={true}
                showInlineLineNumbers={true}
                style={vscDarkPlus}
                className="rounded-md"
              >
                {currentScript.code || ''}
              </SyntaxHighlighter>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 右侧Tab布局 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Script Data & Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="data">
              <TabsList className="mb-4">
                <TabsTrigger value="data" className="flex items-center gap-1">
                  <Database className="h-4 w-4" />
                  Data Source
                </TabsTrigger>
                <TabsTrigger value="results" className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Run Results
                </TabsTrigger>
              </TabsList>
              <TabsContent value="data" className="h-[540px]">
                <div ref={jsonEditorRef} className="w-full h-full"></div>
              </TabsContent>
              <TabsContent value="results" className="h-[540px]">
                <ScrollArea className="h-full">
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Run the script to see results
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}