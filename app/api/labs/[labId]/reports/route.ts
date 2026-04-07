import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * 根据 labId 获取所有项目的所有报告
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ labId: string }> }
) {
  try {
    const { labId } = await context.params;
    
    // 查询该实验室下所有项目的所有报告
    const reports = await prisma.report.findMany({
      where: {
        project: {
          labId
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        documents: {
          select: {
            id: true,
            name: true,
            url: true,
            type: true,
            content: true,
            size: true,
            status: true,
            createdAt: true,
          },
        },
        task: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Failed to fetch reports by labId:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
