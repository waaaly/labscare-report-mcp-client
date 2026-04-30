import { SSEParser } from './sse-parser';
import type { StreamEvent } from '@/store/stream-store';
import type { Message, FileAttachment } from '@/store/conversation-store';

export interface StreamControllerOptions {
  onEvent?: (event: StreamEvent) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onLog?: (message: string) => void;
}

export class StreamController {
  private parser: SSEParser;
  private abortController: AbortController | null = null;
  private options: StreamControllerOptions;
  private isRunning: boolean = false;

  constructor(options: StreamControllerOptions = {}) {
    this.parser = new SSEParser();
    this.options = options;
  }

  async start(
    url: string,
    body: FormData,
    userMessage: Message,
    lastUserMessage: { text: string; files: File[] }
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error('Stream already running');
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      this.options.onLog?.('[StreamController] Starting stream...');
      this.options.onEvent?.({ type: 'status', text: '正在思考...' });

      const response = await fetch(url, {
        method: 'POST',
        body: body,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      this.options.onLog?.('[StreamController] Reading stream...');

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.options.onLog?.('[StreamController] Stream completed');
          break;
        }

        const events = this.parser.parse(value);
        for (const event of events) {
          this.options.onLog?.(`[StreamController] Event: ${event.type}`);
          this.options.onEvent?.(event);
        }

        await new Promise(requestAnimationFrame);
      }

      const remainingEvents = this.parser.flush();
      for (const event of remainingEvents) {
        this.options.onEvent?.(event);
      }

      this.options.onComplete?.();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.options.onLog?.('[StreamController] Stream aborted');
      } else {
        this.options.onLog?.(`[StreamController] Error: ${error}`);
        this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.options.onLog?.('[StreamController] Stop requested');
    }
  }

  isStreamRunning(): boolean {
    return this.isRunning;
  }
}