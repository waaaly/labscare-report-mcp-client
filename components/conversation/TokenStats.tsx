'use client';

import { formatTokenCount } from '@/lib/llm/token-stats';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface TokenStatsProps {
  currentUsage?: TokenUsage | null;
  conversationUsage: TokenUsage;
  requestCount: number;
}

export default function TokenStats({ currentUsage, conversationUsage, requestCount }: TokenStatsProps) {
  return (
    <div className="space-y-4">
      {/* 当前请求 */}
      {currentUsage && currentUsage.totalTokens > 0 && (
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-3 border border-purple-500/20">
          <div className="text-xs text-muted-foreground mb-2">本次请求</div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-blue-400">输入</span>
              <span className="font-mono font-medium">
                {formatTokenCount(currentUsage.inputTokens)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-green-400">输出</span>
              <span className="font-mono font-medium">
                {formatTokenCount(currentUsage.outputTokens)}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t border-purple-500/20 pt-2 mt-2">
              <span className="text-purple-400">总计</span>
              <span className="font-mono font-bold text-purple-400">
                {formatTokenCount(currentUsage.totalTokens)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 对话累计 */}
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
          <span>对话累计</span>
          <span className="bg-slate-700 px-1.5 py-0.5 rounded text-xs">
            {requestCount} 次请求
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-blue-400">输入</span>
            <span className="font-mono font-medium">
              {formatTokenCount(conversationUsage.inputTokens)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-green-400">输出</span>
            <span className="font-mono font-medium">
              {formatTokenCount(conversationUsage.outputTokens)}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-slate-600 pt-2 mt-2">
            <span className="text-purple-400">总计</span>
            <span className="font-mono font-bold text-purple-400">
              {formatTokenCount(conversationUsage.totalTokens)}
            </span>
          </div>
        </div>
      </div>

      {/* 提示信息 */}
      {conversationUsage.totalTokens === 0 && (
        <div className="text-xs text-muted-foreground text-center py-4">
          发送消息后即可查看 Token 消耗统计
        </div>
      )}
    </div>
  );
}
