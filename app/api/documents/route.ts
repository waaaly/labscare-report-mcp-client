import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DocStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

interface BatchDocumentInput {
  projectId: string;
  reportId: string;
  name: string;
  type: string;
  url: string;
  storagePath: string;
  size?: number;
  status?: DocStatus;
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { documents } = body as { documents: BatchDocumentInput[] };

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: 'documents array is required and must not be empty' },
        { status: 400 }
      );
    }

    const results = [];
    for (const doc of documents) {
      const created = await prisma.document.create({
        data: {
          projectId: doc.projectId,
          reportId: doc.reportId,
          name: doc.name,
          type: doc.type,
          url: doc.url,
          storagePath: doc.storagePath,
          size: doc.size ? BigInt(doc.size) : undefined,
          status: doc.status || DocStatus.SUCCESS,
        },
      });
      results.push({
        id: created.id,
        name: created.name,
        url: created.url,
      });
      logger.info(`[BatchImport] Document record created: ${created.id} (${doc.name})`);
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    logger.error({ error }, 'Failed to create document records');
    return NextResponse.json(
      { error: 'Failed to create document records' },
      { status: 500 }
    );
  }
}
