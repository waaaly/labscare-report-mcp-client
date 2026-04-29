import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ labId: string; projectId: string }> }
) {
  try {
    const { labId, projectId } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId, labId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.taskLog.deleteMany({ where: { task: { projectId } } }),
      prisma.script.deleteMany({ where: { projectId } }),
      prisma.task.deleteMany({ where: { projectId } }),
      prisma.document.deleteMany({ where: { projectId } }),
      prisma.report.deleteMany({ where: { projectId } }),
      prisma.project.delete({ where: { id: projectId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
