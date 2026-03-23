import { Client } from 'minio';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT?.split(':')[0] || 'localhost',
  port: parseInt(process.env.MINIO_ENDPOINT?.split(':')[1] || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'password123',
  pathStyle: true
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'documents';
const COVER_BUCKET_NAME = 'docscover';

export async function ensureBucketExists(): Promise<void> {
  const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
  if (!bucketExists) {
    await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
  }
}

export async function ensureCoverBucketExists(): Promise<void> {
  const bucketExists = await minioClient.bucketExists(COVER_BUCKET_NAME);
  if (!bucketExists) {
    await minioClient.makeBucket(COVER_BUCKET_NAME, 'us-east-1');
  }
}

export async function uploadFile(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  await ensureBucketExists();

  const timestamp = Date.now();
  const uniqueFileName = `${timestamp}-${fileName}`;

  await minioClient.putObject(
    BUCKET_NAME,
    uniqueFileName,
    fileBuffer,
    fileBuffer.length,
    { 'Content-Type': contentType }
  );

  const url = `${process.env.MINIO_ENDPOINT}/${BUCKET_NAME}/${uniqueFileName}`;
  return url;
}

export async function uploadCoverImage(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string = 'image/jpeg'
): Promise<string> {
  await ensureBucketExists();

  const timestamp = Date.now();
  const uniqueFileName = `${timestamp}-${fileName}`;

  await minioClient.putObject(
    BUCKET_NAME,
    uniqueFileName,
    fileBuffer,
    fileBuffer.length,
    { 'Content-Type': contentType }
  );

  const url = `${process.env.MINIO_ENDPOINT}/${BUCKET_NAME}/cover/${uniqueFileName}`;
  return url;
}

export async function deleteFile(fileName: string): Promise<void> {
  await minioClient.removeObject(BUCKET_NAME, fileName);
}

export async function getFileUrl(fileName: string): Promise<string> {
  return `${process.env.MINIO_ENDPOINT}/${BUCKET_NAME}/${fileName}`;
}

export { minioClient };
