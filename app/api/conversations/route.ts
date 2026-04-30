import { NextRequest, NextResponse } from 'next/server';
import { contextManager } from '@/lib/llm/context-manager';
import { contextStore } from '@/lib/llm/context-store';
import { logger } from '@/lib/logger';

/**
 * GET /api/conversations
 * 获取对话列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const conversations = await contextManager.listConversations({ limit, offset });

    return NextResponse.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    logger.error({ error }, '[Conversations API] 获取对话列表失败');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * 创建新对话
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, model, labId, projectId, reportId } = body;

    const conversationId = await contextManager.createConversation({
      title,
      model,
      labId,
      projectId,
      reportId,
    });

    const conversation = await contextStore.getConversation(conversationId);

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error({ error }, '[Conversations API] 创建对话失败');
    return NextResponse.json(
      { success: false, error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
