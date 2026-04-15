import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: { labId: string } }) {
  const { labId } = params;
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');
  const reportId = searchParams.get('reportId');
  const searchTerm = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');

  try {
    const where: any = {
      labId
    };

    if (projectId) {
      where.projectId = projectId;
    }

    if (reportId) {
      where.reportId = reportId;
    }

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    const orderBy: any = {};
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'name') {
      orderBy.name = sortOrder;
    } else if (sortBy === 'updatedAt') {
      orderBy.updatedAt = sortOrder;
    } else if (sortBy === 'version') {
      orderBy.version = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [scripts, totalScripts] = await Promise.all([
      prisma.script.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              limsPid: true
            }
          },
          report: {
            select: {
              id: true,
              name: true
            }
          },
          task: {
            select: {
              id: true,
              status: true,
              model: true
            }
          },
          dataSource: {
            select: {
              id: true,
              name: true,
              type: true,
              url: true
            }
          }
        }
      }),
      prisma.script.count({ where })
    ]);

    const totalPages = Math.ceil(totalScripts / pageSize);

    return NextResponse.json({
      scripts: scripts.map(script => ({
        id: script.id,
        name: script.name,
        projectName: script.project?.name,
        reportName: script.report?.name,
        taskName: script.task?.id,
        createdAt: script.createdAt.toISOString()
      })),
      pagination: {
        total: totalScripts,
        page,
        pageSize,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching scripts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scripts' },
      { status: 500 }
    );
  }
}
