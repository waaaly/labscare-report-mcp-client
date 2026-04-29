import { NextRequest, NextResponse } from 'next/server';
import { contextStore } from '@/lib/llm/context-store';
import { logger } from '@/lib/logger';

/**
 * GET /api/conversations/:id/messages
 * 获取对话的消息列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const messages = await contextStore.getMessages(id, {
      limit,
      offset,
      orderBy: 'asc',
    });

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    logger.error(`[Messages API] 获取消息失败: ${params.id}`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/:id/messages
 * 添加消息到对话（用于导入或同步）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { role, content, contentType, messageType, attachments, metadata } = body;

    const message = await contextStore.addMessage(id, {
      role,
      content,
      contentType,
      messageType,
      attachments,
      metadata,
    });

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    logger.error(`[Messages API] 添加消息失败: ${params.id}`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to add message' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/:id/messages
 * 清空对话的所有消息
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await contextStore.clearMessages(id);

    return NextResponse.json({
      success: true,
      message: 'Messages cleared successfully',
    });
  } catch (error) {
    logger.error(`[Messages API] 清空消息失败: ${params.id}`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear messages' },
      { status: 500 }
    );
  }
}
