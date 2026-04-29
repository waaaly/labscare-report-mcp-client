import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ labId: string }> }
) {
  try {
    const { labId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const search = searchParams.get('search') || '';
    const projectName = searchParams.get('projectName') || '';
    const reportName = searchParams.get('reportName') || '';
    const type = searchParams.get('type') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '12')));

    const where: Prisma.DocumentWhereInput = {
      project: {
        labId,
      },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { project: { name: { contains: search, mode: 'insensitive' } } },
        { report: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (projectName) {
      where.project = {
        ...(where.project as Prisma.ProjectWhereInput),
        name: { contains: projectName, mode: 'insensitive' },
      };
    }

    if (reportName) {
      where.report = {
        name: { contains: reportName, mode: 'insensitive' },
      };
    }

    if (type) {
      where.type = type;
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              limsPid: true,
            },
          },
          report: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);

    return NextResponse.json({
      documents,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
