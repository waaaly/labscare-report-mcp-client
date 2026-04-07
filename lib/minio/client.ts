import { Client, ClientOptions } from 'minio';

export function getMinioConfig(): ClientOptions {
  var config: ClientOptions = {
    endPoint: process.env.MINIO_ENDPOINT?.split(':')[0] || 'localhost',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'admin',
    pathStyle: true
  };
  if (!process.env.MINIO_ENDPOINT) {
    return { ...config, port: 9000 };
  } else {
    return config;
  }
}

export function getMinioPublicHost(): string {
   if (!process.env.MINIO_ENDPOINT) {
    return 'http://localhost:9001';
  } else {
    return process.env.MINIO_ENDPOINT;
  }
}

const minioClient = new Client(getMinioConfig());

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
  try {

    await minioClient.putObject(
      BUCKET_NAME,
      uniqueFileName,
      fileBuffer,
      fileBuffer.length,
      { 'Content-Type': contentType }
    );
  } catch (error) {
    console.error('Failed to upload file:', error);
    throw error;
  }

  const url = `/${BUCKET_NAME}/${uniqueFileName}`;
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
