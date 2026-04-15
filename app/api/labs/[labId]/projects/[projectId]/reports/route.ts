import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 类型定义
interface CreateReportData {
  name: string;
  description?: string;
  status?: string;
}

interface UpdateReportData {
  name?: string;
  description?: string;
  status?: string;
}

interface ValidationError extends Error {
  name: 'ValidationError';
}

/**
 * 验证报告数据
 * @param data 报告数据
 * @throws ValidationError 如果数据不合法
 */
async function validateReportData(data: CreateReportData): Promise<void> {
  if (!data.name || data.name.trim() === '') {
    const error = new Error('Report name is required') as ValidationError;
    error.name = 'ValidationError';
    throw error;
  }

  if (data.name.length > 255) {
    const error = new Error('Report name cannot exceed 255 characters') as ValidationError;
    error.name = 'ValidationError';
    throw error;
  }

  if (data.description && data.description.length > 1000) {
    const error = new Error('Report description cannot exceed 1000 characters') as ValidationError;
    error.name = 'ValidationError';
    throw error;
  }
}

/**
 * 创建报告
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ labId: string; projectId: string }> }
) {
  try {
    const { labId, projectId } = await context.params;
    const data: CreateReportData = await request.json();

    // 验证数据
    await validateReportData(data);

    // 创建报告
    const report = await prisma.report.create({
      data: {
        projectId,
        labId: labId,
        name: data.name,
        description: data.description,
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error: any) {
    // 细粒度错误处理
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    } else if (error.code === 'P2003') {
      // 外键约束错误
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    } else {
      console.error('Failed to create report:', error);
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 500 }
      );
    }
  }
}

/**
 * 获取报告列表
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const reports = await prisma.report.findMany({
      where: { projectId },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        documents: {
          select: {
            id: true,
            name: true,
            url: true,
            size: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
        tasks: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
