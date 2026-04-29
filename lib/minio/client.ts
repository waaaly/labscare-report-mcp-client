import { Client, ClientOptions } from 'minio';
import { logger } from '../logger';

export function getMinioConfig(): ClientOptions {
  const fullEndpoint = process.env.MINIO_ENDPOINT || 'localhost:9000';
  const [host, portStr] = fullEndpoint.split(':');
  var config: ClientOptions = {
    endPoint: host,
    port: portStr ? parseInt(portStr) : undefined,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'admin',
    pathStyle: true
  };
  if (process.env.MINIO_PORT) {
    return { ...config, port: parseInt(process.env.MINIO_PORT) };
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
  relativePath: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  await ensureBucketExists();

  const lastSlash = relativePath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? relativePath.substring(0, lastSlash) : '';
  const baseName = lastSlash >= 0 ? relativePath.substring(lastSlash + 1) : relativePath;

  const timestamp = Date.now();
  const uniqueFileName = `${timestamp}-${baseName}`;
  const objectKey = dir ? `${dir}/${uniqueFileName}` : uniqueFileName;

  try {
    await minioClient.putObject(
      BUCKET_NAME,
      objectKey,
      fileBuffer,
      fileBuffer.length,
      { 'Content-Type': contentType }
    );
  } catch (error) {
    console.error('Failed to upload file:', error);
    throw error;
  }

  const url = `/${BUCKET_NAME}/${objectKey}`;
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

/** 
 * 服务端函数：使用 MinIO SDK 获取并解析 JSON 
 * 必须在 Server Component, API Route 或 Server Action 中运行
 * @param fullPath - MinIO 存储桶中的对象完整路径，格式为 /bucketName/objectName
 * @returns 解析后的 JSON 对象
 */
export async function getJsonFromMinio(fullPath: string) {
  try {
    const [bucketName, ...objectParts] = fullPath.replace(/^\/|\/$/g, "").split("/");
    const objectName = objectParts.join("/");
    // 1. 获取对象流
    const dataStream = await minioClient.getObject(bucketName, objectName);

    let content = '';

    // 2. 监听流数据并拼接字符串
    return new Promise((resolve, reject) => {
      dataStream.on('data', (chunk) => {
        content += chunk.toString(); // 将 Buffer 转换为字符串并追加
      });

      dataStream.on('end', () => {
        try {
          // 3. 传输完成后解析 JSON
          const json = JSON.parse(content);
          resolve(json);
        } catch (e: any) {
          reject(new Error('JSON 解析失败: ' + e.message));
        }
      });

      dataStream.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    console.error('获取 MinIO 对象失败:', error);
    throw error;
  }
}

export { minioClient };
