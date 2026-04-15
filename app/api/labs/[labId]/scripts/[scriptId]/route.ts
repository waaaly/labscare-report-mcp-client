import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: { labId: string; scriptId: string } }) {
  const { labId, scriptId } = params;

  try {
    const script = await prisma.script.findFirst({
      where: {
        id: scriptId,
        labId
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            limsPid: true,
            createdAt: true
          }
        },
        report: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true
          }
        },
        task: {
          select: {
            id: true,
            status: true,
            model: true,
            progress: true,
            duration: true,
            createdAt: true,
            completedAt: true
          }
        },
        dataSource: {
          select: {
            id: true,
            name: true,
            type: true,
            url: true,
            size: true,
            status: true,
            storagePath: true,
            pdf: true,
            cover: true,
            createdAt: true
          }
        }
      }
    });

    if (!script) {
      return NextResponse.json(
        { error: 'Script not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      script: {
        id: script.id,
        name: script.name,
        code: script.code,
        version: script.version,
        project: {
          id: script.project?.id,
          name: script.project?.name,
          limsPid: script.project?.limsPid,
          createdAt: script.project?.createdAt.toISOString()
        },
        report: {
          id: script.report?.id,
          name: script.report?.name,
          description: script.report?.description,
          createdAt: script.report?.createdAt.toISOString()
        },
        task: {
          id: script.task?.id,
          status: script.task?.status,
          model: script.task?.model,
          progress: script.task?.progress,
          duration: script.task?.duration,
          createdAt: script.task?.createdAt.toISOString(),
          completedAt: script.task?.completedAt?.toISOString()
        },
        dataSource: {
          id: script.dataSource?.id,
          name: script.dataSource?.name,
          type: script.dataSource?.type,
          url: script.dataSource?.url,
          size: script.dataSource?.size,
          status: script.dataSource?.status,
          storagePath: script.dataSource?.storagePath,
          pdf: script.dataSource?.pdf,
          cover: script.dataSource?.cover,
          createdAt: script.dataSource?.createdAt.toISOString()
        },
        createdAt: script.createdAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('Error fetching script details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch script details' },
      { status: 500 }
    );
  }
}