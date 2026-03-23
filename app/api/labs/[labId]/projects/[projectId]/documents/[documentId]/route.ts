import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {  deleteFile } from '@/lib/minio';

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