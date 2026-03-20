import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { CreateLabRequest } from '@/types/api';
import { Prisma } from '@prisma/client';

export async function GET() {
  try {
    const labs = await prisma.lab.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(labs);
  } catch (error) {
    console.error('Failed to fetch labs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch labs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: CreateLabRequest = await request.json();
    const { name, domain, fieldMappings, extractionRules, sampleFilters, promptTemplates } = body;

    const lab = await prisma.lab.create({
      data: {
        name,
        domain,
        fieldMappings: fieldMappings as Prisma.InputJsonValue,
        extractionRules: extractionRules as Prisma.InputJsonValue,
        sampleFilters: sampleFilters as Prisma.InputJsonValue,
        promptTemplates: promptTemplates as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(lab, { status: 201 });
  } catch (error) {
    console.error('Failed to create lab:', error);
    return NextResponse.json(
      { error: 'Failed to create lab' },
      { status: 500 }
    );
  }
}
