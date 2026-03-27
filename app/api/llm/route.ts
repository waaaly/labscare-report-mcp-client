import { NextRequest, NextResponse } from 'next/server';
import { createLlmClient, chatCompletion, closeLlmClient } from '@/lib/llm/client';
import { agent } from '@/lib/llm/reactAgent';
import { BytesOutputParser } from "@langchain/core/output_parsers";
import { llm } from '@/lib/llm/reactAgent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type = "openai", model = 'GLM-4.7', messages, temperature = 0.7, maxTokens = 1024 } = body;

    if (!type || !model || !messages) {
      return NextResponse.json(
        { error: 'Missing required parameters: type, model, messages' },
        { status: 400 }
      );
    }
    // 注意：Agent 返回的是消息对象流，我们需要解析出文本部分
    const eventStream = await agent.stream(
      { messages },
      { streamMode: "messages" } // 2026 推荐模式：按消息增量流式传输
    );

    // E. 构建符合前端打字机效果的 ReadableStream
    const runtimeStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const [message, metadata] of eventStream) {
          // 只将 AI 回复的内容（Content）发送给前端
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