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

    const knowledgeBase: any[] = [];

    return NextResponse.json(knowledgeBase);
  } catch (error) {
    console.error('Failed to load knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to load knowledge base' },
      { status: 500 }
    );
  }
}

