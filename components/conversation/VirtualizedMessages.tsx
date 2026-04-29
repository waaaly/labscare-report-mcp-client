"use client";

import {
  Loader2,
  Send,
  Copy,
  X,
  XCircle,
  Image as ImageIcon,
  File as FileIcon,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Search,
  Database,
  ZoomIn,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import React from "react";
import { prepare, layout } from "@chenglou/pretext";
import ImageLightbox from "./ImageLightbox";
import { BatchImportBubble } from "./BatchImportBubble";

export type Msg = {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  messageType?: "thought" | "tool_call" | "status" | "content";
  tool?: string;
  files?: FileAttachment[];
  timestamp?: number;
  branchId?: string;
  parentId?: string;
};

export type FileAttachment = {
  name: string;
  type: "image" | "json" | "md";
  content: string;
  preview?: string;
};

function parseBatchImportContent(content: string): {
  labName: string;
  projects: {
    name: string;
    reports: {
      name: string;
      documents: {
        fileName: string;
        status: 'uploaded';
        isImage?: boolean;
      }[];
    }[];
  }[];
  fileCount: number;
} | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.action !== 'batch_import') return null;
    let fileCount = 0;
    const projects = parsed.projects.map((p: any) => ({
      name: p.name,
      reports: p.reports.map((r: any) => {
        fileCount += r.documents.length;
        return {
          name: r.name,
          documents: r.documents.map((d: any) => ({
            fileName: d.fileName,
            status: 'uploaded' as const,
            isImage: d.contentType?.startsWith('image/'),
          })),
        };
      }),
    }));
    return { labName: parsed.labName, projects, fileCount };
  } catch {
    return null;
  }
}

const WIDTH_BUCKET_SIZE = 50;

// 时间格式化函数
function formatMessageTime(timestamp: number): { short: string; full: string } {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // 短格式：显示 HH:mm
  const short = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 完整格式：显示日期和时间
  const isToday = diffDays === 0;
  const isYesterday = diffDays === 1;

  let full: string;
  if (isToday) {
    full = `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  } else if (isYesterday) {
    full = `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    full = `${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    full = date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return { short, full };
}

// 文本高亮函数
function highlightText(text: string, query: string): React.ReactNode[] {
  if (!query.trim()) return [text];

  const parts: React.ReactNode[] = [];
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const matches = text.split(regex);

  matches.forEach((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      parts.push(
        <mark key={index} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
          {part}
        </mark>
      );
    } else {
      parts.push(part);
    }
  });

  return parts;
}

function bucketWidth(width: number): number {
  return Math.ceil(width / WIDTH_BUCKET_SIZE) * WIDTH_BUCKET_SIZE;
}

const plainCache = new Map<string, string>();

function getPlain(s: string): string {
  const cached = plainCache.get(s);
  if (cached !== undefined) return cached;
  const result = s
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim())
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#>*_~\-]+/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
  plainCache.set(s, result);
  if (plainCache.size > 2000) {
    const firstKey = plainCache.keys().next().value;
    if (firstKey !== undefined) plainCache.delete(firstKey);
  }
  return result;
}

type HeightCacheEntry = {
  height: number;
  contentHash: string;
  bucketWidth: number;
  isLocked: boolean;
};

const CodeBlock = ({ language, code }: { language: string; code: string }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mt-4 mb-4">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <span className="text-xs text-gray-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-gray-800/80 hover:bg-gray-700/80 transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-gray-400" />
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "plaintext"}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: "0.375rem",
          fontSize: "0.875rem",
          lineHeight: 1.5,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownMessage = React.memo(
  function MarkdownMessage({ content }: { content: string }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            
            return match ? (
              <CodeBlock language={match[1]} code={codeString} />
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content
);
MarkdownMessage.displayName = 'MarkdownMessage';

const ThoughtMessage = React.memo(
  function ThoughtMessage({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isPartiallyExpanded, setIsPartiallyExpanded] = React.useState(false);

    // 智能判断是否是工具描述（基于关键词和长度）
    const isToolDescription = React.useMemo(() => {
      return (
        content.length > 500 &&
        (content.includes("工具") ||
          content.includes("Tool") ||
          content.includes("function") ||
          content.includes("参数"))
      );
    }, [content]);

    // 预览文本
    const previewText = React.useMemo(() => {
      const lines = content.split("\n").filter((line) => line.trim());
      if (lines.length === 0) return content;

      // 取前3行，最多200字符
      let preview = lines.slice(0, 3).join("\n");
      if (preview.length > 200) {
        preview = preview.substring(0, 200) + "...";
      }
      return preview;
    }, [content]);

    const getLabel = () => {
      if (isToolDescription) return "🔧 Tool Description";
      return "💭 Thinking Process";
    };

    const getColorClass = () => {
      if (isToolDescription) return "bg-blue-50 border-blue-200 text-blue-700";
      return "bg-gray-50 border-gray-200 text-gray-600";
    };

    return (
      <div className={`border rounded-lg ${getColorClass()}`}>
        <button
          onClick={() => {
            if (isToolDescription && !isPartiallyExpanded && !isExpanded) {
              setIsPartiallyExpanded(true);
            } else {
              setIsExpanded(!isExpanded);
              if (!isExpanded) setIsPartiallyExpanded(false);
            }
          }}
          className="w-full flex items-center justify-between p-3 text-left text-sm hover:bg-white/30 transition-colors"
        >
          <span className="font-medium flex items-center gap-2">
            {getLabel()}
            {isStreaming && (
              <span className="text-xs opacity-70">(typing...)</span>
            )}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* 部分展开：显示预览文本 */}
        {isPartiallyExpanded && !isExpanded && (
          <div className="px-3 pb-3 pt-0 text-sm">
            <pre className="whitespace-pre-wrap font-mono text-xs opacity-80">
              {previewText}
            </pre>
            <div className="mt-2 text-xs opacity-60">
              {content.length > previewText.length &&
                `...${content.length - previewText.length} more characters`}
            </div>
          </div>
        )}

        {/* 完全展开：显示完整内容 */}
        {isExpanded && (
          <div className="p-3 pt-0 text-sm">
            <pre className="whitespace-pre-wrap font-mono text-xs">
              {content}
            </pre>
            {isStreaming && (
              <div className="mt-2 text-xs opacity-60 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Receiving content...
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.content === next.content && prev.isStreaming === next.isStreaming,
);
ThoughtMessage.displayName = 'ThoughtMessage';

const ToolCallMessage = React.memo(
  function ToolCallMessage({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    const parts = content.split('\n');
    const callText = parts[0];
    const resultText = parts.slice(1).join('\n').trim();
    const hasResult = !!resultText;

    const isError = resultText.toLowerCase().includes('error') || resultText.includes('失败');

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-3">
          <Search className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm text-blue-700 flex-1">{callText}</span>
          {isStreaming && !hasResult && (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
          )}
          {hasResult && !isError && (
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          )}
          {hasResult && isError && (
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
        </div>
        {hasResult && (
          <div className={`flex items-start gap-2 px-3 pb-3 border-t ${isError ? 'bg-red-50/50 border-blue-100' : 'bg-green-50/50 border-blue-100'}`}>
            <span className={`text-sm ${isError ? 'text-red-600' : 'text-green-700'}`}>{resultText}</span>
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.content === next.content && prev.isStreaming === next.isStreaming,
);
ToolCallMessage.displayName = 'ToolCallMessage';

const StatusMessage = React.memo(
  function StatusMessage({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-700">{content}</span>
      </div>
    );
  },
  (prev, next) =>
    prev.content === next.content && prev.isStreaming === next.isStreaming,
);
StatusMessage.displayName = 'StatusMessage';

// 文件附件渲染组件
const FileAttachment = React.memo(
  function FileAttachment({ file, onImageClick }: { file: FileAttachment; onImageClick?: (src: string, name: string) => void }) {
    const [isExpanded, setIsExpanded] = React.useState(false);

    console.log(
      "[FileAttachment] 渲染文件:",
      file.name,
      file.type,
      "内容长度:",
      file.content.length,
    );

    if (file.type === "image") {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border bg-background group">
          <div className="relative">
            <img
              src={file.content}
              alt={file.name}
              className="max-w-full h-auto max-h-64 object-contain cursor-zoom-in"
              onClick={() => onImageClick?.(file.content, file.name)}
            />
            {/* 放大图标覆盖层 */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
              <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="px-3 py-1 text-xs text-muted-foreground bg-muted/50">
            {file.name}
          </div>
        </div>
      );
    }

    if (file.type === "json") {
      return (
        <div className="mt-2 border rounded-lg bg-background">
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
          {isExpanded && (
            <div className="px-3 pb-2">
              <pre className="text-xs font-mono bg-muted/30 p-2 rounded overflow-auto max-h-64 overflow-y-auto">
                {file.content}
              </pre>
            </div>
          )}
        </div>
      );
    }

    if (file.type === "md") {
      return (
        <div className="mt-2 border rounded-lg bg-background">
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileIcon className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
          {isExpanded && (
            <div className="px-3 pb-2">
              <div className="text-xs bg-muted/30 p-2 rounded overflow-auto max-h-64 overflow-y-auto">
                <ReactMarkdown>{file.content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  },
  (prev, next) =>
    prev.file.content === next.file.content &&
    prev.file.type === next.file.type,
);
FileAttachment.displayName = 'FileAttachment';

export function VirtualizedMessages({
  messages,
  isLoading,
  messagesEndRef,
  currentStatus = null,
  searchQuery = '',
  highlightedMessageIndex,
  onCreateBranch,
}: {
  messages: Msg[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  currentStatus?: string | null;
  searchQuery?: string;
  highlightedMessageIndex?: number | null;
  onCreateBranch?: (messageIndex: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = React.useState(0);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [containerW, setContainerW] = React.useState(0);
  const heightCacheRef = React.useRef<Map<number, HeightCacheEntry>>(new Map());
  const pendingMeasurementsRef = React.useRef<Map<number, HTMLDivElement>>(
    new Map(),
  );
  const rafIdRef = React.useRef<number | null>(null);
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [, forceUpdate] = React.useState(0);
  const [fontInfo, setFontInfo] = React.useState({
    font: `14px Inter, ui-sans-serif, system-ui`,
    lineHeight: 20,
  });

  // 图片 Lightbox 状态
  const [lightboxImage, setLightboxImage] = React.useState<{ src: string; name: string } | null>(null);

  // 图片点击回调
  const handleImageClick = React.useCallback((src: string, name: string) => {
    setLightboxImage({ src, name });
  }, []);

  // 节流更新时间戳，避免流式传输时频繁强制更新
  const lastUpdateTimeRef = React.useRef(0);

  // 清理函数，确保组件卸载时清理所有待处理的定时器
  React.useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      pendingMeasurementsRef.current.clear();
    };
  }, []);

  React.useEffect(() => {
    // useEffect 只在客户端执行，不会触发服务端与客户端的 Diff 冲突
    const dummy = window.document.body;
    const cs = window.getComputedStyle(dummy);
    const fs = cs.fontSize;
    const ff = cs.fontFamily;
    const lhStr = cs.lineHeight;
    const lh = Number.parseFloat(lhStr);

    setFontInfo({ font: `${fs} ${ff}`, lineHeight: lh });
  }, []); // 仅在挂载时运行一次

  const onScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportH(el.clientHeight);
      setContainerW(el.clientWidth);
    });
    ro.observe(el);
    setViewportH(el.clientHeight);
    setContainerW(el.clientWidth);
    const handler = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", handler);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", handler);
    };
  }, []);

  const overscanPx = 400;
  const virtualizationEnabled = messages.length > 10 && containerW > 0;

  const measureCache = React.useRef<Map<string, number>>(new Map());

  const bucketedWidth = React.useMemo(() => {
    const maxW = Math.max(80, Math.floor(containerW * 0.8));
    const contentW = Math.max(40, maxW - 32);
    return bucketWidth(contentW);
  }, [containerW]);

  const actualBubbleWidth = React.useMemo(() => {
    const maxW = Math.max(80, Math.floor(containerW * 0.8));
    return Math.max(40, maxW - 32);
  }, [containerW]);

  const getContentHash = React.useCallback((m: Msg) => {
    // 对内容长度进行分桶，减少流式传输时的哈希变化
    const contentLengthBucket = Math.floor(m.content.length / 500) * 500;
    return `${m.role}|${m.messageType}|${contentLengthBucket}|${m.content.slice(0, 100)}`;
  }, []);

  const estimateHeight = React.useCallback(
    (m: Msg, bw: number) => {
      const key = `${m.role}|${m.messageType}|${bw}|${m.content}`;
      let h = measureCache.current.get(key);
      if (h == null) {
        if (m.messageType === "thought") {
          h = Math.ceil(48 + Math.min(200, m.content.length * 0.5));
        } else if (
          m.messageType === "tool_call" ||
          m.messageType === "status"
        ) {
          h = Math.ceil(48);
        } else {
          const txt = getPlain(m.content || "");
          const prepared = prepare(txt, fontInfo.font, {
            whiteSpace: "pre-wrap",
          });
          const { height } = layout(prepared, bw, fontInfo.lineHeight);
          h = Math.ceil(height + 32 + 16);
        }
        measureCache.current.set(key, h);
      }
      return h;
    },
    [fontInfo],
  );

  const processBatchMeasurements = React.useCallback(() => {
    const pending = pendingMeasurementsRef.current;
    if (pending.size === 0) return;

    console.log(
      "[VirtualizedMessages] 处理批量高度测量，待测量数量:",
      pending.size,
    );

    const updates: Array<{ index: number; height: number }> = [];
    const cache = heightCacheRef.current;

    pending.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      let actual = rect.height;
      if (!Number.isFinite(actual) || actual <= 0) return;
      if (index > 0) actual += 16;
      const actualRounded = Math.ceil(actual);
      const msg = messages[index];
      if (!msg) return;

      const cached = cache.get(index);
      const isStreaming = msg.isStreaming;

      if (cached) {
        // 流式传输时使用更大的容差，避免频繁更新
        const tolerance = isStreaming ? 10 : 2;
        if (cached.isLocked && isStreaming) return;
        if (Math.abs(cached.height - actualRounded) <= tolerance) return;
      }

      updates.push({
        index,
        height: actualRounded,
      });

      console.log(
        `[VirtualizedMessages] 更新消息 ${index} 高度: ${actualRounded}px, 内容长度: ${msg.content?.length || 0}`,
      );

      cache.set(index, {
        height: actualRounded,
        contentHash: getContentHash(msg),
        bucketWidth: bucketedWidth,
        isLocked: isStreaming || true,
      });
    });

    pending.clear();
    rafIdRef.current = null;

    if (updates.length > 0) {
      console.log(
        "[VirtualizedMessages] 强制重新渲染，更新数量:",
        updates.length,
      );
      // 检查是否需要节流：流式传输时限制更新频率
      const now = Date.now();
      const hasStreaming = updates.some(u => {
        const msg = messages[u.index];
        return msg?.isStreaming;
      });

      if (hasStreaming && now - lastUpdateTimeRef.current < 100) {
        // 如果是流式传输且距离上次更新不足 100ms，延迟更新
        const delay = 100 - (now - lastUpdateTimeRef.current);
        if (updateTimeoutRef.current !== null) {
          clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
          lastUpdateTimeRef.current = Date.now();
          forceUpdate((n) => n + 1);
          updateTimeoutRef.current = null;
        }, delay);
      } else {
        lastUpdateTimeRef.current = now;
        forceUpdate((n) => n + 1);
      }
    }
  }, [messages, getContentHash, bucketedWidth]);

  const scheduleBatchMeasurement = React.useCallback(() => {
    if (rafIdRef.current !== null) return;
    console.log("[VirtualizedMessages] 安排批量高度测量");
    // 使用双重 RAF 确保布局完成后才测量
    rafIdRef.current = requestAnimationFrame(() => {
      requestAnimationFrame(processBatchMeasurements);
    });
  }, [processBatchMeasurements]);

  const itemHeights = React.useMemo(() => {
    if (!virtualizationEnabled) return messages.map(() => 0);

    const arr: number[] = [];
    const cache = heightCacheRef.current;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const cached = cache.get(i);

      if (cached && cached.bucketWidth === bucketedWidth) {
        const currentHash = getContentHash(m);
        if (cached.contentHash === currentHash) {
          arr.push(cached.height);
          continue;
        }
        if (cached.isLocked && m.isStreaming) {
          arr.push(cached.height);
          continue;
        }
      }

      const estimated = estimateHeight(m, actualBubbleWidth);
      arr.push(estimated);

      if (m.isStreaming && cached) {
        cache.set(i, {
          ...cached,
          height: estimated,
          isLocked: true,
        });
      }
    }
    return arr;
  }, [
    messages,
    bucketedWidth,
    actualBubbleWidth,
    estimateHeight,
    virtualizationEnabled,
    getContentHash,
  ]);

  if (!virtualizationEnabled) {
    return (
      <div
        ref={containerRef}
        className="h-full overflow-auto space-y-4"
        onScroll={onScroll}
      >
        {currentStatus && (
          <StatusMessage
            key="current-status"
            content={currentStatus}
            isStreaming={false}
          />
        )}
        {messages.map((message, index) => {
          if (message.role === "user") {
            console.log(`[VirtualizedMessages] 渲染用户消息 ${index}:`, {
              hasFiles: !!message.files,
              fileCount: message.files?.length || 0,
              files: message.files?.map((f) => ({
                name: f.name,
                type: f.type,
                contentLength: f.content.length,
              })),
            });
            return (
              <div key={index} className="flex justify-end">
                <div
                  className={`max-w-[80%] ${
                    highlightedMessageIndex === index ? 'ring-2 ring-yellow-400 rounded-lg' : ''
                  }`}
                >
                  <div className="p-4 rounded-lg bg-primary text-primary-foreground relative">
                    {(() => {
                      const batchData = parseBatchImportContent(message.content);
                      if (batchData) return <BatchImportBubble {...batchData} />;
                      return searchQuery ? highlightText(message.content, searchQuery) : message.content;
                    })()}
                    {onCreateBranch && (
                      <button
                        onClick={() => onCreateBranch(index)}
                        className="absolute top-2 right-2 p-1 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
                        aria-label="Create branch"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                  {message.files && message.files.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.files.map((file, fileIndex) => {
                        return <FileAttachment key={fileIndex} file={file} onImageClick={handleImageClick} />;
                      })}
                    </div>
                  )}
                  {message.timestamp && (
                    <div className="mt-1 text-xs text-muted-foreground text-right">
                      <span title={formatMessageTime(message.timestamp).full}>
                        {formatMessageTime(message.timestamp).short}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (message.messageType === "thought") {
            return (
              <div key={index} className="flex justify-start">
                <div className="max-w-[80%]">
                  <ThoughtMessage
                    content={message.content}
                    isStreaming={message.isStreaming}
                  />
                </div>
              </div>
            );
          }

          if (message.messageType === "tool_call") {
            return (
              <div key={index} className="flex justify-start">
                <div className="max-w-[80%]">
                  <ToolCallMessage
                    content={message.content}
                    isStreaming={message.isStreaming}
                  />
                </div>
              </div>
            );
          }

          // Status 消息现在使用独立状态管理，不在这里渲染

          return (
            <div key={index} className="flex justify-start">
              <div
                className={`max-w-[80%] ${
                  highlightedMessageIndex === index ? 'ring-2 ring-yellow-400 rounded-lg' : ''
                }`}
              >
                <div className="p-4 rounded-lg bg-muted">
                  {message.isStreaming ? (
                    (() => {
                      return (
                        <pre className="whitespace-pre-wrap">
                          {message.content}
                        </pre>
                      );
                    })()
                  ) : searchQuery ? (
                    <div>{highlightText(message.content, searchQuery)}</div>
                  ) : (
                    <MarkdownMessage content={message.content} />
                  )}
                </div>
                {message.timestamp && !message.isStreaming && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span title={formatMessageTime(message.timestamp).full}>
                      {formatMessageTime(message.timestamp).short}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-4 rounded-lg bg-muted flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        {/* 图片 Lightbox */}
        {lightboxImage && (
          <ImageLightbox
            src={lightboxImage.src}
            alt={lightboxImage.name}
            isOpen={!!lightboxImage}
            onClose={() => setLightboxImage(null)}
          />
        )}
      </div>
    );
  }

  const cumulative: number[] = [];
  let sum = 0;
  for (const h of itemHeights) {
    cumulative.push(sum);
    sum += h;
  }
  const totalH = sum;

  const fromY = Math.max(0, scrollTop - overscanPx);
  const toY = Math.min(totalH, scrollTop + viewportH + overscanPx);

  let start = 0;
  while (
    start < cumulative.length &&
    cumulative[start] + itemHeights[start] < fromY
  )
    start++;
  let end = start;
  while (end < cumulative.length && cumulative[end] < toY) end++;

  const topPad = cumulative[start] || 0;
  let renderedH = 0;
  for (let i = start; i < end; i++) renderedH += itemHeights[i];
  const bottomPad = Math.max(0, totalH - topPad - renderedH);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto"
      onScroll={onScroll}
    >
      <div className="space-y-4">
        {currentStatus && (
          <StatusMessage
            key="current-status"
            content={currentStatus}
            isStreaming={false}
          />
        )}
        <div style={{ height: topPad }} />
        {messages.slice(start, end).map((message, i) => {
          const index = start + i;
          const assignRef = (el: HTMLDivElement | null) => {
            if (!el) return;
            // 检查是否需要测量：如果是流式传输且已经锁定，则跳过
            const cached = heightCacheRef.current.get(index);
            if (cached?.isLocked && message.isStreaming) return;
            // 检查是否已经测量过相同的元素（通过比较引用）
            if (pendingMeasurementsRef.current.get(index) === el) return;

            pendingMeasurementsRef.current.set(index, el);
            scheduleBatchMeasurement();
          };

          if (message.role === "user") {
            console.log(`[VirtualizedMessages V] 渲染用户消息 ${index}:`, {
              hasFiles: !!message.files,
              fileCount: message.files?.length || 0,
              files: message.files?.map((f) => ({
                name: f.name,
                type: f.type,
                contentLength: f.content.length,
              })),
            });
            return (
              <div key={index} ref={assignRef} className="flex justify-end">
                <div
                  className={`max-w-[80%] ${
                    highlightedMessageIndex === index ? 'ring-2 ring-yellow-400 rounded-lg' : ''
                  }`}
                >
                  <div className="p-4 rounded-lg bg-primary text-primary-foreground relative">
                    {(() => {
                      const batchData = parseBatchImportContent(message.content);
                      if (batchData) return <BatchImportBubble {...batchData} />;
                      return searchQuery ? highlightText(message.content, searchQuery) : message.content;
                    })()}
                    {onCreateBranch && (
                      <button
                        onClick={() => onCreateBranch(index)}
                        className="absolute top-2 right-2 p-1 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
                        aria-label="Create branch"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                  {message.files && message.files.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.files.map((file, fileIndex) => {
                        return <FileAttachment key={fileIndex} file={file} onImageClick={handleImageClick} />;
                      })}
                    </div>
                  )}
                  {message.timestamp && (
                    <div className="mt-1 text-xs text-muted-foreground text-right">
                      <span title={formatMessageTime(message.timestamp).full}>
                        {formatMessageTime(message.timestamp).short}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (message.messageType === "thought") {
            return (
              <div key={index} ref={assignRef} className="flex justify-start">
                <div className="max-w-[80%]">
                  <ThoughtMessage
                    content={message.content}
                    isStreaming={message.isStreaming}
                  />
                </div>
              </div>
            );
          }

          if (message.messageType === "tool_call") {
            return (
              <div key={index} ref={assignRef} className="flex justify-start">
                <div className="max-w-[80%]">
                  <ToolCallMessage
                    content={message.content}
                    isStreaming={message.isStreaming}
                  />
                </div>
              </div>
            );
          }

          // Status 消息现在使用独立状态管理，不在这里渲染

          return (
            <div key={index} ref={assignRef} className="flex justify-start">
              <div
                className={`max-w-[80%] ${
                  highlightedMessageIndex === index ? 'ring-2 ring-yellow-400 rounded-lg' : ''
                }`}
              >
                <div className="p-4 rounded-lg bg-muted">
                  {message.isStreaming ? (
                    (() => {
                      return (
                        <pre className="whitespace-pre-wrap">
                          {message.content}
                        </pre>
                      );
                    })()
                  ) : searchQuery ? (
                    <div>{highlightText(message.content, searchQuery)}</div>
                  ) : (
                    <MarkdownMessage content={message.content} />
                  )}
                </div>
                {message.timestamp && !message.isStreaming && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span title={formatMessageTime(message.timestamp).full}>
                      {formatMessageTime(message.timestamp).short}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div style={{ height: bottomPad }} />
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-4 rounded-lg bg-muted flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        {/* 图片 Lightbox */}
        {lightboxImage && (
          <ImageLightbox
            src={lightboxImage.src}
            alt={lightboxImage.name}
            isOpen={!!lightboxImage}
            onClose={() => setLightboxImage(null)}
          />
        )}
      </div>
    </div>

  );
}
