import { StreamEvent } from '@/store/stream-store';

export class SSEParser {
  private buffer: string = '';
  private decoder: TextDecoder;

  constructor() {
    this.decoder = new TextDecoder();
  }

  parse(chunk: Uint8Array): StreamEvent[] {
    const events: StreamEvent[] = [];
    const text = this.decoder.decode(chunk, { stream: true });
    this.buffer += text;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const event = this.parseLine(line);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  private parseLine(line: string): StreamEvent | null {
    if (!line.startsWith('data: ')) {
      return null;
    }

    const data = line.slice(6).trim();
    if (!data) {
      return null;
    }

    try {
      const json = JSON.parse(data);
      return this.normalizeEvent(json);
    } catch {
      console.error('Failed to parse SSE JSON:', data);
      return null;
    }
  }

  private normalizeEvent(json: unknown): StreamEvent | null {
    if (typeof json !== 'object' || json === null) {
      return null;
    }

    const obj = json as Record<string, unknown>;
    const type = obj.type as StreamEvent['type'];

    if (!type || !['content', 'thought', 'tool_call', 'tool_result', 'status', 'metrics'].includes(type)) {
      console.warn('Unknown SSE event type:', type);
      return null;
    }

    const event: StreamEvent = { type };

    if (obj.text !== undefined) {
      event.text = String(obj.text);
    }
    if (obj.message !== undefined) {
      event.message = String(obj.message);
    }
    if (obj.tool !== undefined) {
      event.tool = String(obj.tool);
    }
    if (obj.node !== undefined) {
      event.node = String(obj.node);
    }
    if (obj.token_usage !== undefined && typeof obj.token_usage === 'object') {
      const usage = obj.token_usage as Record<string, unknown>;
      event.token_usage = {
        inputTokens: Number(usage.inputTokens) || 0,
        outputTokens: Number(usage.outputTokens) || 0,
        totalTokens: Number(usage.totalTokens) || 0,
      };
    }

    return event;
  }

  flush(): StreamEvent[] {
    const events: StreamEvent[] = [];
    if (this.buffer.trim()) {
      const lines = this.buffer.split('\n');
      for (const line of lines) {
        const event = this.parseLine(line);
        if (event) {
          events.push(event);
        }
      }
      this.buffer = '';
    }
    return events;
  }
}