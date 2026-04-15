import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { CreateProjectRequest } from '@/types/api';

export async function GET(
  request: Request,
  context: { params: Promise<{ labId: string }> }
) {
  try {
    const { labId } = await context.params;
    const projects = await prisma.project.findMany({
      where: { labId },
      orderBy: {
        createdAt: 'desc',
      },

    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ labId: string }> }
) {
  try {
    const { labId } = await context.params;
    const body: CreateProjectRequest = await request.json();
    const { name, description, limsPid, caseId } = body;

    const project = await prisma.project.create({
      data: {
        labId,
        name,
        limsPid,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
