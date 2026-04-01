'use client';

import { Loader2, Send, Paperclip, X, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import React from 'react';
import { prepare, layout } from '@chenglou/pretext';

export type Msg = {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
};

const WIDTH_BUCKET_SIZE = 50;

function bucketWidth(width: number): number {
  return Math.ceil(width / WIDTH_BUCKET_SIZE) * WIDTH_BUCKET_SIZE;
}

const plainCache = new Map<string, string>();

function getPlain(s: string): string {
  const cached = plainCache.get(s);
  if (cached !== undefined) return cached;
  const result = s
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#>*_~\-]+/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
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

const MarkdownMessage = React.memo(({ content }: { content: string }) => (
  <ReactMarkdown>{content}</ReactMarkdown>
), (prev, next) => prev.content === next.content);

export function VirtualizedMessages({
  messages,
  isLoading,
  messagesEndRef,
}: {
  messages: Msg[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = React.useState(0);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [containerW, setContainerW] = React.useState(0);
  const heightCacheRef = React.useRef<Map<number, HeightCacheEntry>>(new Map());
  const pendingMeasurementsRef = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const rafIdRef = React.useRef<number | null>(null);
  const [, forceUpdate] = React.useState(0);

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
    el.addEventListener('scroll', handler);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', handler);
    };
  }, []);

  const overscanPx = 400;
  const virtualizationEnabled = messages.length > 10 && containerW > 0;

  const fontInfo = React.useMemo(() => {
    const dummy = window.document.body;
    const cs = window.getComputedStyle(dummy);
    const fs = cs.fontSize || '14px';
    const ff = cs.fontFamily || 'Inter, ui-sans-serif, system-ui';
    const lhStr = cs.lineHeight || '20px';
    const lh = Number.parseFloat(lhStr) || 20;
    return { font: `${fs} ${ff}`, lineHeight: lh };
  }, []);

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
    return `${m.role}|${m.content.length}|${m.content.slice(0, 100)}`;
  }, []);

  const estimateHeight = React.useCallback(
    (m: Msg, bw: number) => {
      const key = `${m.role}|${bw}|${m.content}`;
      let h = measureCache.current.get(key);
      if (h == null) {
        const txt = getPlain(m.content || '');
        const prepared = prepare(txt, fontInfo.font, { whiteSpace: 'pre-wrap' });
        const { height } = layout(prepared, bw, fontInfo.lineHeight);
        h = Math.ceil(height + 32 + 16);
        measureCache.current.set(key, h);
      }
      return h;
    },
    [fontInfo]
  );

  const processBatchMeasurements = React.useCallback(() => {
    const pending = pendingMeasurementsRef.current;
    if (pending.size === 0) return;

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
        if (cached.isLocked && isStreaming) return;
        if (Math.abs(cached.height - actualRounded) <= 2) return;
      }

      updates.push({
        index,
        height: actualRounded,
      });

      cache.set(index, {
        height: actualRounded,
        contentHash: getContentHash(msg),
        bucketWidth: bucketedWidth,
        isLocked: isStreaming||true,
      });
    });

    pending.clear();
    rafIdRef.current = null;

    if (updates.length > 0) {
      forceUpdate((n) => n + 1);
    }
  }, [messages, getContentHash, bucketedWidth]);

  const scheduleBatchMeasurement = React.useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(processBatchMeasurements);
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
      <div ref={containerRef} className="h-full overflow-auto space-y-4" onScroll={onScroll}>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {message.role === 'assistant' ? (
                message.isStreaming ? (
                  <pre className="whitespace-pre-wrap">{message.content}</pre>
                ) : (
                  <MarkdownMessage content={message.content} />
                )
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-4 rounded-lg bg-muted flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
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
  while (start < cumulative.length && cumulative[start] + itemHeights[start] < fromY) start++;
  let end = start;
  while (end < cumulative.length && cumulative[end] < toY) end++;

  const topPad = cumulative[start] || 0;
  let renderedH = 0;
  for (let i = start; i < end; i++) renderedH += itemHeights[i];
  const bottomPad = Math.max(0, totalH - topPad - renderedH);

  return (
    <div ref={containerRef} className="h-full overflow-auto" onScroll={onScroll}>
      <div className="space-y-4">
        <div style={{ height: topPad }} />
        {messages.slice(start, end).map((message, i) => {
          const index = start + i;
          const assignRef = (el: HTMLDivElement | null) => {
            if (!el) return;
            pendingMeasurementsRef.current.set(index, el);
            scheduleBatchMeasurement();
          };
          return (
            <div
              key={index}
              ref={assignRef}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {message.role === 'assistant' ? (
                  message.isStreaming ? (
                    <pre className="whitespace-pre-wrap">{message.content}</pre>
                  ) : (
                    <MarkdownMessage content={message.content} />
                  )
                ) : (
                  message.content
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
      </div>
    </div>
  );
}
