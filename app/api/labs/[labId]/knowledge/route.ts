import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { readMcpResource } from '@/lib/mcp/client';
import type { UpdateKnowledgeBaseRequest } from '@/types/api';
import { Prisma } from '@prisma/client';
export async function GET(
  request: Request,
  context: { params: Promise<{ labId: string }> }
) {
  try {
    const { labId } = await context.params;
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
    });

    if (!lab) {
      return NextResponse.json({ error: 'Lab not found' }, { status: 404 });
    }

    const knowledgeBase = lab.knowledgeBase;

    return NextResponse.json(knowledgeBase);
  } catch (error) {
    console.error('Failed to load knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to load knowledge base' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ labId: string }> }
) {
  try {
    const { labId } = await context.params;
    const body = await request.json();
    const { knowledgeBase } = body;

    const lab = await prisma.lab.update({
      where: { id: labId },
      data: {
        knowledgeBase: knowledgeBase as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(lab);
  } catch (error) {
    console.error('Failed to update knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to update knowledge base' },
      { status: 500 }
    );
  }
}
