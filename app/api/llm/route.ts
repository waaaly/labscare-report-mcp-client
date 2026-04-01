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
        } catch { }
      }

      const inputMessages = [...baseMessages, new HumanMessage({ content: messageContent })];
      const eventStream = await agent.stream({ messages: inputMessages }, { streamMode: ['messages', 'updates'] });

      const runtimeStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          for await (const event of eventStream) {
            // ==================== 处理 messages 模式 (最重要，用于实时输出) ====================
            if (Array.isArray(event) && event.length === 2) {
              const [streamMode, chunk] = event;   // 解构 streamMode 和 chunk

              if (streamMode === "messages") {
                // chunk 是 [messageChunk, metadata] 的 tuple
                const [messageChunk, metadata] = chunk as [any, any];

                // 1. 输出模型思考内容或最终答案
                if (messageChunk?.content && typeof messageChunk.content === "string") {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({
                      type: "content",
                      text: messageChunk.content
                    })}\n\n`)
                  );
                }

                // 2. 输出 Tool Calling 过程（关键！让用户看到正在调用什么工具）
                if (messageChunk?.tool_calls && messageChunk.tool_calls.length > 0) {
                  messageChunk.tool_calls.forEach((tc: any) => {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        type: "tool_call",
                        tool: tc.name,
                        args: tc.args || {},
                        message: `正在调用工具: ${tc.name}...`
                      })}\n\n`)
                    );
                  });
                }
              }

              // ==================== 处理 updates 模式 ====================
              else if (streamMode === "updates") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "status",
                    text: "工具执行完成，正在继续处理..."
                  })}\n\n`)
                );
              }
            }
          }

          // 流结束
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        },
      });
      return new Response(runtimeStream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

  } catch (error) {
    console.error('LLM API error:', error);
    return NextResponse.json(
      { error: 'Failed to process LLM request' },
      { status: 500 }
    );
  }
}
