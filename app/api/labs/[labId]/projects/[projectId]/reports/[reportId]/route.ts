import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 类型定义
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
async function validateReportData(data: UpdateReportData): Promise<void> {
  if (data.name !== undefined) {
    if (data.name.trim() === '') {
      const error = new Error('Report name cannot be empty') as ValidationError;
      error.name = 'ValidationError';
      throw error;
    }

    if (data.name.length > 255) {
      const error = new Error('Report name cannot exceed 255 characters') as ValidationError;
      error.name = 'ValidationError';
      throw error;
    }
  }

  if (data.description && data.description.length > 1000) {
    const error = new Error('Report description cannot exceed 1000 characters') as ValidationError;
    error.name = 'ValidationError';
    throw error;
  }
}

/**
 * 获取单个报告
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; reportId: string }> }
) {
  try {
    const { projectId, reportId } = await context.params;
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        projectId,
      },
      include: {
        documents: {
          select: {
            id: true,
            name: true,
            url: true,
            content: true,
            size: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
        tasks: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Failed to fetch report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

/**
 * 更新报告
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string; reportId: string }> }
) {
  try {
    const { projectId, reportId } = await context.params;
    const data: UpdateReportData = await request.json();

    // 验证数据
    await validateReportData(data);

    // 检查报告是否存在且属于该项目
    const existingReport = await prisma.report.findFirst({
      where: {
        id: reportId,
        projectId,
      },
    });

    if (!existingReport) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // 更新报告
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        name: data.name,
        description: data.description,
      },
    });

    return NextResponse.json(updatedReport);
  } catch (error: any) {
    // 细粒度错误处理
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    } else {
      console.error('Failed to update report:', error);
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }
  }
}

/**
 * 删除报告
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string; reportId: string }> }
) {
  try {
    const { projectId, reportId } = await context.params;

    // 检查报告是否存在且属于该项目
    const existingReport = await prisma.report.findFirst({
      where: {
        id: reportId,
        projectId,
      },
    });

    if (!existingReport) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // 删除报告（级联删除会自动处理相关的documents和tasks）
    await prisma.report.delete({
      where: { id: reportId },
    });

    return NextResponse.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Failed to delete report:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}
