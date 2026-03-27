import { NextRequest, NextResponse } from 'next/server';
import { createLlmClient, chatCompletion, closeLlmClient } from '@/lib/llm/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type="openai", model='gpt-5.1', messages, temperature=0.7, maxTokens=1024 } = body;

    if (!type || !model || !messages) {
      return NextResponse.json(
        { error: 'Missing required parameters: type, model, messages' },
        { status: 400 }
      );
    }

    // 创建 LLM 客户端
    const client = await createLlmClient({ type, model });

    // 调用聊天完成
    const response = await chatCompletion({
      messages,
      temperature,
      maxTokens,
    });

    // 关闭客户端
    await closeLlmClient();

    return NextResponse.json({ response });
  } catch (error) {
    console.error('LLM API error:', error);
    return NextResponse.json(
      { error: 'Failed to process LLM request' },
      { status: 500 }
    );
  }
}