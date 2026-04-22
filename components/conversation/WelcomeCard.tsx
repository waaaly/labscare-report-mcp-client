'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, MessageSquare, Zap, BookOpen, ChevronRight, Bot, Code, FileText, Lightbulb } from 'lucide-react';

type WelcomeCardProps = {
  onQuickAction?: (action: string) => void;
};

const quickActions = [
  {
    icon: Code,
    title: '编写代码',
    description: '生成、调试、解释代码',
    color: 'bg-violet-500/10 text-violet-600',
  },
  {
    icon: FileText,
    title: '文档处理',
    description: '读取、总结、翻译文档',
    color: 'bg-cyan-500/10 text-cyan-600',
  },
  {
    icon: Lightbulb,
    title: '问题解答',
    description: '解答技术或业务问题',
    color: 'bg-amber-500/10 text-amber-600',
  },
  {
    icon: BookOpen,
    title: '数据分析',
    description: '处理表格、图表、报告',
    color: 'bg-emerald-500/10 text-emerald-600',
  },
];

const features = [
  {
    icon: Sparkles,
    title: '多模型支持',
    description: '支持 OpenAI、Claude、Gemini 等主流大语言模型',
  },
  {
    icon: Zap,
    title: '智能工具调用',
    description: '自动调用代码执行、文件操作等专业工具',
  },
  {
    icon: MessageSquare,
    title: '上下文记忆',
    description: '理解对话上下文，提供连贯的交互体验',
  },
];

export default function WelcomeCard({ onQuickAction }: WelcomeCardProps) {
  return (
    <div className="h-full flex items-center justify-center p-6 overflow-auto">
      <div className="max-w-2xl w-full space-y-8">
        {/* Agent 简介头部 */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/20">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              您好，我是 AI 助手
            </h1>
            <p className="text-muted-foreground mt-2">
              我可以帮助您完成代码开发、文档处理、数据分析等多种任务
            </p>
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            快捷操作
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Card
                key={action.title}
                className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-violet-200 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 group"
                onClick={() => onQuickAction?.(action.title)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${action.color}`}>
                      <action.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm group-hover:text-violet-600 transition-colors">
                        {action.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {action.description}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 功能特点 */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            核心能力
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-muted/30 border-dashed">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-gradient-to-br from-violet-500/20 to-cyan-500/20">
                      <feature.icon className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{feature.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {feature.description}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 使用技巧 */}
        <Card className="bg-gradient-to-br from-violet-50 to-cyan-50 dark:from-violet-950/30 dark:to-cyan-950/30 border-violet-100 dark:border-violet-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-medium text-sm">使用技巧</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 直接输入问题或任务描述，我会自动理解您的意图</li>
                  <li>• 可以上传代码文件、文档或图片，我会帮您分析和处理</li>
                  <li>• 使用 ↵ Enter 发送消息，Shift + Enter 换行</li>
                  <li>• 发送文件后，我可以帮您解读、分析或转换格式</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
