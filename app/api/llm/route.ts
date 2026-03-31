import { NextRequest, NextResponse } from 'next/server';
import { agent } from '@/lib/llm/reactAgent';
import { Buffer } from 'buffer';
import { HumanMessage, AIMessage } from "@langchain/core/messages";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    // A. 支持 multipart/form-data（文本+文件）与 application/json（纯文本消息）两种模式
    if (contentType.includes('multipart/form-data')) {
      // 1) 解析 FormData
      const formData = await request.formData();
      const prompt = (formData.get('prompt') as string) || '';
      const contextJson = (formData.get('contextJson') as string) || '';
      const messagesJson = formData.get('messagesJson') as string | null;
      const files = (formData.getAll('files') as File[]) || [];

      let userText = prompt || '';
      if (contextJson) {
        userText += `\n\n[Context]\n\`\`\`json\n${contextJson}\n\`\`\`\n`;
      }

      for (const file of files) {
        if (file.type?.startsWith('image/')) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
          userText += `\n\n[Image: ${file.name}]\n${dataUrl}\n`;
        } else if (file.name?.toLowerCase().endsWith('.md') || file.type === 'text/markdown') {
          const mdText = await file.text();
          userText += `\n\n[Markdown: ${file.name}]\n${mdText}\n`;
        } else if (file.type === 'application/json' || file.name?.toLowerCase().endsWith('.json')) {
          const jsonText = await file.text();
          userText += `\n\n[JSON: ${file.name}]\n\`\`\`json\n${jsonText}\n\`\`\`\n`;
        }
      }

      const messageContent: any[] = [{ type: 'text', text: userText.trim() }];
      for (const file of files) {
        if (file.type?.startsWith('image/')) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
          messageContent.push({ type: 'image_url', image_url: { url: dataUrl } });
        }
      }

      const baseMessages: Array<HumanMessage | AIMessage> = [];
      if (messagesJson) {
        try {
          const arr = JSON.parse(messagesJson as string) as Array<{ role: 'user' | 'assistant'; content: string }>;
          if (Array.isArray(arr)) {
            for (const m of arr) {
              if (m?.role === 'user') baseMessages.push(new HumanMessage(m.content ?? ''));
              else if (m?.role === 'assistant') baseMessages.push(new AIMessage(m.content ?? ''));
            }
          }
        } catch {}
      }

      const inputMessages = [...baseMessages, new HumanMessage({ content: messageContent })];
      const eventStream = await agent.stream({ messages: inputMessages }, { streamMode: 'messages' });

      const runtimeStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const [message] of eventStream) {
            if (message.content && typeof message.content === 'string') {
              controller.enqueue(encoder.encode(message.content));
            }
          }
          controller.close();
        },
      });

      return new Response(runtimeStream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    // B. 兼容 JSON 请求（旧路径）
    const body = await request.json();
    const { type = "openai", model = 'GLM-4.7', messages, temperature = 0.7, maxTokens = 1024 } = body;

    if (!type || !model || !messages) {
      return NextResponse.json(
        { error: 'Missing required parameters: type, model, messages' },
        { status: 400 }
      );
    }
    const eventStream = await agent.stream(
      { messages },
      { streamMode: "messages" } // 2026 推荐模式：按消息增量流式传输
    );

    const runtimeStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const [message, metadata] of eventStream) {
          if (message.content && typeof message.content === 'string') {
            controller.enqueue(encoder.encode(message.content));
          }
        }
        controller.close();
      },
    });

    return new Response(runtimeStream, {
      headers: { "Content-Type": "text/event-stream" },
    });


  } catch (error) {
    console.error('LLM API error:', error);
    return NextResponse.json(
      { error: 'Failed to process LLM request' },
      { status: 500 }
    );
  }
}
