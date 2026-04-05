import { Worker, Job } from 'bullmq';
import { readTempFile, deleteTempFile } from '@/lib/storage';
import { processDocument } from '@/lib/docx/converter';
import { uploadFile } from '@/lib/minio/client';
import prisma from '@/lib/prisma';
import { sanitizeFileName } from '@/lib/utils';
import { updateDocumentProgress } from './client';
import { logger } from '../logger';


/**
 * 检查文件是否已存在
 * @param projectId 项目ID
 * @param fileName 文件名
 * @returns 是否已存在
 */
async function checkFileExists(projectId: string, fileName: string): Promise<boolean> {
  const existingFile = await prisma.document.findFirst({
    where: {
      projectId,
      name: fileName
    }
  });
  return !!existingFile;
}

async function processor(job: Job) {
  const task = job.data;
  setTimeout(async () => {
    try {
      console.log(`Processing task: ${job.id} for document: ${task.documentId}`);

      // 检查文件是否已存在
      const exists = await checkFileExists(task.projectId, task.name);
      if (exists) {
        deleteTempFile(task.tempFilePath);
        await updateDocumentProgress(task.documentId, 100, '存在同名文件!');
        return
        // return NextResponse.json(
        //   { error: 'File with the same name already exists' },
        //   { status: 409 }
        // );
      }
      await updateDocumentProgress(task.documentId, 5, '未发现同名文件,开始处理...');
      // 创建初始文档记录
      const document = await prisma.document.create({
        data: {
          id: task.documentId,
          projectId: task.projectId,
          name: task.name,
          type: task.type,
          url: '', // 临时空值，后续会更新
          status: 'PROCESSING'
        }
      });

      // 读取临时文件
      const buffer = await readTempFile(task.tempFilePath);

      // 处理文件
      await updateDocumentProgress(task.documentId, 20, '正在处理文件');
      const { pdfBuffer, coverBuffer } = await processDocument(buffer, task.fileType, task.fileName);
      await updateDocumentProgress(task.documentId, 50, '文件处理完成');

      // 安全处理文件名
      const safeFileName = sanitizeFileName(task.fileName);
      const pdfFileName = safeFileName.replace(/\.(doc|docx)$/i, '.pdf');
      const coverFileName = `${safeFileName.replace(/\.[^.]+$/, '')}_cover.jpg`;
      await updateDocumentProgress(task.documentId, 60, '正在上传文件');
      // 并行上传文件
      const [url, pdf, coverUrl] = await Promise.all([
        uploadFile(safeFileName, buffer, task.fileType),
        uploadFile('pdf/' + pdfFileName, pdfBuffer, 'application/pdf'),
        coverBuffer ? uploadFile('cover/' + coverFileName, coverBuffer, 'image/jpeg') : Promise.resolve(null)
      ]);
      await updateDocumentProgress(task.documentId, 80, '文件上传完成');
      // 更新数据库
      await prisma.document.update({
        where: { id: task.documentId },
        data: {
          status: 'COMPLETED',
          url,
          pdf,
          cover: coverUrl
        }
      });

      // 清理临时文件
      deleteTempFile(task.tempFilePath);
      await updateDocumentProgress(task.documentId, 100, '清理临时文件,任务完成');
      console.log(`Task ${job.id} completed successfully`);
    } catch (error) {
      console.error(`Error processing task ${job.id}:`, error);
      await updateDocumentProgress(task.documentId, 0, '任务处理失败');
      // 标记为失败
      await prisma.document.update({
        where: { id: task.documentId },
        data: { status: 'FAILED' }
      });
      // 清理临时文件
      deleteTempFile(task.tempFilePath);
      console.log(`Task ${job.id} failed`);

      // 抛出错误，让 BullMQ 处理重试
      throw error;
    }
  }, 5000);

}

// 创建 BullMQ Worker
const worker = new Worker('document-processing', processor,
  {
    connection: {
      host: process.env.REDIS_URL?.split('://')[1].split(':')[0] || 'localhost',
      port: Number(process.env.REDIS_URL?.split(':')[2].split('/')[0]) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: Number(process.env.REDIS_DB) || 0
    },
    // 配置重试选项
    // attempts: 3,
    // backoff: {
    //   type: 'exponential',
    //   delay: 1000
    // }
  });

// 监听事件
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, error) => {
  console.log(`Job ${job?.id || 'unknown'} failed with error: ${error.message}`);
});

/**
 * 启动文档处理器
 */
export function startDocumentProcessor(): void {
  logger.info('Document processor started with BullMQ');
}

// 导出 worker
export { worker };