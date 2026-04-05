import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDocumentStatus } from '@/lib/redis/client';
import { deleteFile } from '@/lib/minio/client';

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string, documentId: string }> }
) {
  try {
    const { projectId, documentId } = await context.params;
    
    // 从数据库获取文档
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        projectId
      }
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // 尝试从 Redis 获取最新状态
    try {
      const redisStatus = await getDocumentStatus(documentId);
      if (redisStatus) {
        document.status = redisStatus;
      }
    } catch (error) {
      // Redis 错误不影响主流程
      console.error('Error getting status from Redis:', error);
    }

    return NextResponse.json({
      ...document,
      status: document.status || 'PENDING'
    });
  } catch (error) {
    console.error('Failed to fetch document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string, documentId: string }> }
) {
  try {
    const { projectId, documentId } = await context.params;
    await prisma.document.delete({
      where: {
        id: documentId,
        projectId,
      },
    });
    //同时删除minio上的文件
    const document = await prisma.document.findUnique({
      where: {
        id: documentId,
        projectId,
      },
    });
    if (document?.url) {
      const fileName = document.url.split('/').pop();
      if (fileName) {
        await deleteFile(fileName)
      }
    }
    if (document?.cover) {
      const coverFileName = document.cover.split('/').pop();
      if (coverFileName) {
       await deleteFile(coverFileName)
      }
    }
    return NextResponse.json(
      { message: 'Document deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to delete document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}