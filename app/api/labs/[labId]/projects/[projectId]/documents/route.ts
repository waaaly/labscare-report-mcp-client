import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeTempFile } from '@/lib/storage';
import { sendDocumentProcessingTask } from '@/lib/redis/client';


// 类型定义
interface ValidationError extends Error {
  name: 'ValidationError';
}

/**
 * 安全处理文件名，防止路径遍历攻击
 * @param fileName 原始文件名
 * @returns 安全的文件名
 */
function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * 验证文件是否合法
 * @param file 上传的文件
 * @throws ValidationError 如果文件不合法
 */
async function validateFile(file: File): Promise<void> {
  if (!file) {
    const error = new Error('No file provided') as ValidationError;
    error.name = 'ValidationError';
    throw error;
  }

  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/json',
    'text/markdown'
  ];

  if (!allowedTypes.includes(file.type)) {
    const error = new Error('Invalid file type. Only PDF, DOC, DOCX, images, JSON, and MD files are allowed.') as ValidationError;
    error.name = 'ValidationError';
    throw error;
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    const error = new Error('File size exceeds 10MB limit') as ValidationError;
    error.name = 'ValidationError';
    throw error;
  }
}


export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const { createId } = require('@paralleldrive/cuid2');
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (files.length === 0) {
      const error = new Error('No files provided') as ValidationError;
      error.name = 'ValidationError';
      throw error;
    }
    
    const results = [];
    
    for (const file of files) {
      // 验证文件
      await validateFile(file);
      
      const documentId = `doc${createId()}`;
      
      // 写入临时文件
      const tempFilePath = await writeTempFile(file);

      // 发送消息到队列
      const taskId = await sendDocumentProcessingTask(
        documentId,
        projectId,
        file.name,
        file.type,
        tempFilePath
      );
      
      results.push({
        taskId,
        id: documentId,
        projectId: projectId,
        name: file.name,
        type: file.type,
        status: 'PENDING',
        message: 'Document upload started. Processing in background.'
      });
    }
    
    return NextResponse.json(results, { status: 202 });
 
  } catch (error: any) {
    // 细粒度错误处理
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    } else {
      console.error('Unexpected error:', error);
      return NextResponse.json(
        { error: 'Failed to upload documents' },
        { status: 500 }
      );
    }
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

