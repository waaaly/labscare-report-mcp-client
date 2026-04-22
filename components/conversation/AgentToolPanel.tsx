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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ApiToolsPanel from './ApiToolsPanel';

type Props = {
  logs?: string[];
  // 以下为预留属性，后续功能扩展使用
  currentModel?: string;
  onModelChange?: (model: string) => void;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
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
  onInsertPrompt,
  availableModels,
  availableTools,
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
            <TabsList className="w-full grid grid-cols-3 rounded-none border-b bg-muted/30 h-10">
            <TabsTrigger value="model" className="text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                模型
              </TabsTrigger>
              <TabsTrigger value="api-tools" className="text-xs gap-1">
                <Wrench className="h-3 w-3" />
                API工具
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

              {/* Token 消耗统计 */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Hash className="h-4 w-4" />
                  <span>Token 消耗</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    本会话
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Card className="p-2 text-center bg-violet-50/50 dark:bg-violet-950/30">
                    <div className="text-lg font-bold text-violet-600">
                      {tokenUsage?.prompt || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">输入</div>
                  </Card>
                  <Card className="p-2 text-center bg-cyan-50/50 dark:bg-cyan-950/30">
                    <div className="text-lg font-bold text-cyan-600">
                      {tokenUsage?.completion || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">输出</div>
                  </Card>
                  <Card className="p-2 text-center bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
                    <div className="text-lg font-bold">
                      {tokenUsage?.total || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">总计</div>
                  </Card>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  精确计费请查看服务商后台
                </p>
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
