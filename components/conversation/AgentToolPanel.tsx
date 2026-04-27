'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Bot,
  Sparkles,
  Cpu,
  Hash,
  ChevronDown,
  ChevronRight,
  Zap,
  FileCode,
  Search,
  Database,
  Settings,
  Activity,
  Wrench,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTokenCount } from '@/lib/llm/token-stats';
import ApiToolsPanel from './ApiToolsPanel';

type Props = {
  logs?: string[];
  // 以下为预留属性，后续功能扩展使用
  currentModel?: string;
  onModelChange?: (model: string) => void;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  conversationUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  requestCount?: number;
  onInsertPrompt?: (prompt: string) => void;
  availableModels?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  availableTools?: Array<{
    id: string;
    name: string;
    description?: string;
    enabled?: boolean;
    icon: typeof FileCode | typeof Search | typeof Database | typeof Zap;
  }>;
  usageHistory?: Array<{
    content: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }>;
};

const defaultModels = [
  { id: 'gpt-4o', name: 'GPT-4o', description: '最新最强模型' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '轻量快速' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: '平衡性能' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '长上下文' },
];

const defaultTools = [
  { id: 'code-interpreter', name: '代码执行', description: '运行Python/JS代码', icon: FileCode, enabled: true },
  { id: 'web-search', name: '网络搜索', description: '搜索互联网', icon: Search, enabled: true },
  { id: 'file-operations', name: '文件操作', description: '读写本地文件', icon: Database, enabled: false },
  { id: 'function-call', name: '函数调用', description: '调用自定义函数', icon: Zap, enabled: true },
];

export default function AgentToolPanel({
  logs = [],
  currentModel,
  onModelChange,
  tokenUsage,
  conversationUsage,
  requestCount = 0,
  onInsertPrompt,
  availableModels,
  availableTools,
  usageHistory = [],
}: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const models = availableModels || defaultModels;
  const tools = availableTools || defaultTools;

  const handleModelChange = (value: string) => {
    onModelChange?.(value);
  };

  return (
    <Card className="h-full flex flex-col bg-gradient-to-b from-background to-muted/20">
      <CardHeader className="p-4 border-b bg-gradient-to-r from-violet-500/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <CardTitle className="text-base">高级设置</CardTitle>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {isExpanded && (
          <Tabs defaultValue="model" className="h-full flex flex-col">
            <TabsList className="w-full grid grid-cols-4 rounded-none border-b bg-muted/30 h-10">
              <TabsTrigger value="model" className="text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                模型
              </TabsTrigger>
              <TabsTrigger value="api-tools" className="text-xs gap-1">
                <Wrench className="h-3 w-3" />
                API工具
              </TabsTrigger>
              <TabsTrigger value="token" className="text-xs gap-1">
                <BarChart3 className="h-3 w-3" />
                Token
              </TabsTrigger>
              <TabsTrigger value="tools" className="text-xs gap-1">
                <Cpu className="h-3 w-3" />
                工具
              </TabsTrigger>
            </TabsList>
            {/* 模型选择标签页 */}
            <TabsContent value="model" className="flex-1 overflow-auto p-4 mt-0 space-y-4">
              {/* 模型选择 */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="h-4 w-4" />
                  <span>模型选择</span>
                </div>
                <Select value={currentModel} onValueChange={handleModelChange}>
                  <SelectTrigger className="w-full h-10 bg-muted/50 border-transparent hover:border-violet-200">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{model.name}</span>
                          {model.description && (
                            <span className="text-xs text-muted-foreground">
                              {model.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 当前模型信息 */}
                <div className="p-3 rounded-lg bg-gradient-to-br from-violet-500/5 to-cyan-500/5 border border-violet-100 dark:border-violet-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-medium">当前模型</span>
                  </div>
                  <div className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                    {models.find((m) => m.id === currentModel)?.name || currentModel}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {models.find((m) => m.id === currentModel)?.description || '已选中'}
                  </p>
                </div>
              </section>

              {/* Token 消耗统计 - 仅展示当前请求 */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Hash className="h-4 w-4" />
                  <span>Token 消耗</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    当前请求
                  </Badge>
                </div>
                {tokenUsage && tokenUsage.totalTokens > 0 ? (
                  <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-3 border border-purple-500/20">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-400">输入</span>
                        <span className="font-mono font-medium">
                          {formatTokenCount(tokenUsage.inputTokens)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-400">输出</span>
                        <span className="font-mono font-medium">
                          {formatTokenCount(tokenUsage.outputTokens)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-purple-500/20 pt-2 mt-2">
                        <span className="text-purple-400">总计</span>
                        <span className="font-mono font-bold text-purple-400">
                          {formatTokenCount(tokenUsage.totalTokens)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-4 border rounded-lg bg-muted/30">
                    发送消息后即可查看 Token 消耗
                  </div>
                )}
              </section>

              {/* 活动日志 */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="h-4 w-4" />
                  <span>活动日志</span>
                  {logs.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {logs.length} 条
                    </Badge>
                  )}
                </div>
                <div className="border rounded-lg p-2 h-40 overflow-auto bg-muted/30">
                  {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                      暂无活动记录
                    </div>
                  ) : (
                    <div className="space-y-1 text-xs">
                      {logs.slice(-20).map((log, i) => (
                        <div key={i} className="font-mono text-muted-foreground/80">
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </TabsContent>

            {/* API 工具标签页 */}
            <TabsContent value="api-tools" className="flex-1 overflow-auto p-4 mt-0">
              <ApiToolsPanel onInsertPrompt={onInsertPrompt} />
            </TabsContent>

            {/* Token 统计标签页 */}
            <TabsContent value="token" className="flex-1 overflow-auto p-4 mt-0">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  <span>Token 消耗统计</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {usageHistory.length} 次提问
                  </Badge>
                </div>

                {usageHistory.length > 0 ? (
                  <div className="space-y-4">
                    {/* 列表：每次提问的 token 消耗 */}
                    <div className="space-y-2">
                      {usageHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border bg-muted/30 p-3 space-y-2"
                        >
                          <div className="text-xs text-muted-foreground truncate" title={item.content}>
                            {item.content || '[无内容]'}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-blue-400">
                              输入 {formatTokenCount(item.inputTokens)}
                            </span>
                            <span className="text-green-400">
                              输出 {formatTokenCount(item.outputTokens)}
                            </span>
                            <span className="text-purple-400 font-mono font-medium">
                              总计 {formatTokenCount(item.totalTokens)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 会话汇总 */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                      <div className="text-xs text-muted-foreground mb-2">会话汇总</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-400">输入</span>
                          <span className="font-mono font-medium">
                            {formatTokenCount(conversationUsage?.inputTokens || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-400">输出</span>
                          <span className="font-mono font-medium">
                            {formatTokenCount(conversationUsage?.outputTokens || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm border-t border-slate-600 pt-2 mt-2">
                          <span className="text-purple-400">总计</span>
                          <span className="font-mono font-bold text-purple-400">
                            {formatTokenCount(conversationUsage?.totalTokens || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-8 border rounded-lg bg-muted/30">
                    暂无 Token 消耗记录
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 工具标签页 */}
            <TabsContent value="tools" className="flex-1 overflow-auto p-4 mt-0">
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Cpu className="h-4 w-4" />
                  <span>可用工具</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {tools.filter((t) => t.enabled).length}/{tools.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {tools.map((tool) => (
                    <div
                      key={tool.id}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border transition-all',
                        tool.enabled
                          ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                          : 'bg-muted/30 border-transparent opacity-60'
                      )}
                    >
                      <div
                        className={cn(
                          'p-1.5 rounded-md',
                          tool.enabled
                            ? 'bg-green-500/20 text-green-600'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <tool.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{tool.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {tool.description}
                        </div>
                      </div>
                      <Badge
                        variant={tool.enabled ? 'default' : 'secondary'}
                        className={cn(
                          'text-xs',
                          tool.enabled
                            ? 'bg-green-500 hover:bg-green-600'
                            : ''
                        )}
                      >
                        {tool.enabled ? '已启用' : '已禁用'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>
          </Tabs>
        )}

        {/* 预留区域提示 */}
        {isExpanded && (
          <div className="text-center py-3 border-t border-dashed">
            <p className="text-xs text-muted-foreground">
              更多高级功能持续开发中...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
