import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadFile, uploadCoverImage,deleteFile } from '@/lib/minio';
import { processDocument } from '@/lib/document-converter';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed.' },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { pdfBuffer, coverBuffer } = await processDocument(buffer, file.type, file.name);

    const url = await uploadFile(file.name, buffer, file.type);
    const pdfFileName = file.name.replace(/\.(doc|docx)$/i, '.pdf');
    const pdf = await uploadFile('pdf/'+pdfFileName, pdfBuffer, 'application/pdf');

    let coverUrl = null;
    if (coverBuffer) {
      const coverFileName = `${file.name.replace(/\.[^.]+$/, '')}_cover.jpg`;
      coverUrl = await uploadFile('cover/'+coverFileName, coverBuffer, 'image/jpeg');
    }

    const document = await prisma.document.create({
      data: {
        projectId,
        name: file.name,
        type: file.type,
        url,
        pdf,
        cover: coverUrl,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Failed to upload document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const documents = await prisma.document.findMany({
      where: { projectId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
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