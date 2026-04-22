'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Plus,
  Building2,
  FolderOpen,
  FileText,
  FileCode,
  Upload,
  Brain,
  Settings,
  Activity,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  apiToolsConfig,
  categoryNames,
  type ApiToolConfig,
} from '@/lib/llm/api-tools-config';

type Props = {
  onInsertPrompt?: (prompt: string) => void;
};

export default function ApiToolsPanel({ onInsertPrompt }: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['lab', 'project'])
  );
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [copiedTool, setCopiedTool] = useState<string | null>(null);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleTool = (toolName: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  };

  const handleCopyPrompt = async (tool: ApiToolConfig) => {
    await navigator.clipboard.writeText(tool.examplePrompt);
    setCopiedTool(tool.name);
    setTimeout(() => setCopiedTool(null), 2000);
  };

  const handleUsePrompt = (tool: ApiToolConfig) => {
    onInsertPrompt?.(tool.examplePrompt);
  };

  // 按分类分组
  const groupedTools = apiToolsConfig.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, ApiToolConfig[]>);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      lab: <Building2 className="h-3.5 w-3.5" />,
      project: <FolderOpen className="h-3.5 w-3.5" />,
      report: <FileText className="h-3.5 w-3.5" />,
      script: <FileCode className="h-3.5 w-3.5" />,
      document: <Upload className="h-3.5 w-3.5" />,
      knowledge: <Brain className="h-3.5 w-3.5" />,
      task: <Activity className="h-3.5 w-3.5" />,
    };
    return icons[category] || <Settings className="h-3.5 w-3.5" />;
  };

  return (
    <div className="space-y-3">
      {/* 头部说明 */}
      <div className="p-3 rounded-lg bg-gradient-to-br from-violet-500/5 to-cyan-500/5 border border-violet-100 dark:border-violet-800">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-medium">API 工具列表</span>
        </div>
        <p className="text-xs text-muted-foreground">
          点击工具可查看详情，使用示例 prompt 快速开始对话
        </p>
      </div>

      {/* 工具列表 */}
      <ScrollArea className="h-[calc(100vh-380px)] pr-2">
        <div className="space-y-2">
          {Object.entries(groupedTools).map(([category, tools]) => (
            <div key={category} className="space-y-1">
              {/* 分类标题 */}
              <button
                onClick={() => toggleCategory(category)}
                className={cn(
                  'flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm font-medium',
                  'hover:bg-muted/60 transition-colors cursor-pointer'
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-violet-500/10 text-violet-600">
                    {getCategoryIcon(category)}
                  </div>
                  <span>{categoryNames[category as keyof typeof categoryNames]}</span>
                  <Badge variant="secondary" className="text-xs">
                    {tools.length}
                  </Badge>
                </div>
                {expandedCategories.has(category) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* 工具列表 */}
              {expandedCategories.has(category) && (
                <div className="space-y-1 pl-2">
                  {tools.map((tool) => (
                    <div
                      key={tool.name}
                      className={cn(
                        'rounded-lg border transition-all',
                        expandedTools.has(tool.name)
                          ? 'bg-card border-violet-200 dark:border-violet-800'
                          : 'bg-muted/30 border-transparent hover:border-muted'
                      )}
                    >
                      {/* 工具标题 */}
                      <button
                        onClick={() => toggleTool(tool.name)}
                        className="flex items-center justify-between w-full px-3 py-2 text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {tool.name}
                          </code>
                          <span className="text-sm font-medium truncate">
                            {tool.nameCn}
                          </span>
                        </div>
                        {expandedTools.has(tool.name) ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </button>

                      {/* 工具详情 */}
                      {expandedTools.has(tool.name) && (
                        <div className="px-3 pb-3 space-y-2">
                          {/* 描述 */}
                          <p className="text-xs text-muted-foreground">
                            {tool.description}
                          </p>

                          {/* 入参 */}
                          {tool.parameters.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-muted-foreground">
                                入参：
                              </span>
                              <div className="space-y-0.5">
                                {tool.parameters.map((param) => (
                                  <div
                                    key={param.name}
                                    className="flex items-start gap-1.5 text-xs"
                                  >
                                    <code className="bg-muted px-1 py-0.5 rounded font-mono text-violet-600 shrink-0">
                                      {param.name}
                                    </code>
                                    <span className="text-muted-foreground">
                                      {param.type}
                                      {param.required ? ' (必填)' : ' (可选)'}
                                      {param.description && `: ${param.description}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 示例 Prompt */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                示例 Prompt：
                              </span>
                            </div>
                            <div className="relative group">
                              <div className="p-2 rounded-md bg-muted/50 text-xs text-muted-foreground border border-dashed">
                                {tool.examplePrompt.length > 60
                                  ? tool.examplePrompt.slice(0, 60) + '...'
                                  : tool.examplePrompt}
                              </div>
                              <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => handleCopyPrompt(tool)}
                                    >
                                      {copiedTool === tool.name ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{copiedTool === tool.name ? '已复制' : '复制 prompt'}</p>
                                  </TooltipContent>
                                </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>

                          {/* 使用按钮 */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-1.5 h-8 text-xs"
                            onClick={() => handleUsePrompt(tool)}
                          >
                            <Plus className="h-3 w-3" />
                            使用此 Prompt
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
