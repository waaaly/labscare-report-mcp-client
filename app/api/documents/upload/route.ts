import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/minio/client';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const relativePath = (formData.get('relativePath') as string) || file.name;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadFile(relativePath, buffer, file.type);

    return NextResponse.json({
      url,
      storagePath: url,
      fileName: file.name,
      relativePath,
      size: file.size,
      contentType: file.type,
    });
  } catch (error) {
    console.error('Failed to upload file to MinIO:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
