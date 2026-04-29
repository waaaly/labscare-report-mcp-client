import { NextRequest, NextResponse } from 'next/server';
import { contextManager } from '@/lib/llm/context-manager';
import { contextStore } from '@/lib/llm/context-store';
import { logger } from '@/lib/logger';
import { Message } from '@prisma/client';

/**
 * GET /api/conversations/:id
 * 获取单个对话详情和消息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const includeMessages = searchParams.get('messages') !== 'false';

    const conversation = await contextStore.getConversation(id);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    let messages: Message[] = [];
    if (includeMessages) {
      messages = await contextStore.getMessages(id, {
        orderBy: 'asc',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...conversation,
        messages,
      },
    });
  } catch (error) {
    logger.error({ error }, `[Conversations API] 获取对话失败: ${params.id}`);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/:id
 * 更新对话信息
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { title, model, labId, projectId, reportId } = body;

    await contextManager.updateConversation(id, {
      title,
      model,
      labId,
      projectId,
      reportId,
    });

    const conversation = await contextStore.getConversation(id);

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error({ error }, `[Conversations API] 更新对话失败: ${params.id}`);
    return NextResponse.json(
      { success: false, error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/:id
 * 删除对话
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await contextManager.deleteConversation(id);

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    logger.error({ error }, `[Conversations API] 删除对话失败: ${params.id}`);
    return NextResponse.json(
      { success: false, error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
