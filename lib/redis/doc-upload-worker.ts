import { Worker, Job } from 'bullmq';
import { readTempFile, deleteTempFile } from '@/lib/storage';
import { processDocument } from '@/lib/docx/converter';
import { uploadFile } from '@/lib/minio/client';
import prisma from '@/lib/prisma';
import { sanitizeFileName } from '@/lib/utils';
import { getRedisConfig, updateDocumentProgress } from './client';
import { logger } from '../logger';
// 1. 定义全局类型，防止 TS 报错
declare global {
  var docWorker: Worker | undefined;
}

/**
 * 检查文件是否已存在
 * @param projectId 项目ID
 * @param fileName 文件名
 * @returns 是否已存在
 */
async function checkFileExists(documentId: string, fileName: string): Promise<boolean> {
  try {
    logger.info(`[Processing Task]: ${documentId} Checking file existence: ${fileName}`);
    const existingFile = await prisma.document.findFirst({
      where: {
        id: documentId,
        name: fileName
      }
    });
    return !!existingFile;
  } catch (error) {
    logger.error(`[Processing Task]: ${documentId} Error checking file existence: ${error}`);
    return false;
  }
}

async function processor(job: Job) {
  const task = job.data;
  try {
    process.stdout.write(`\n🚀 WORKER START: ${job.id} \n`);

    // 检查文件是否已存在
    const exists = await checkFileExists(task.documentId, task.fileName);
    if (exists) {
      deleteTempFile(task.tempFilePath);
      await updateDocumentProgress(task.documentId, 100, '存在同名文件!', 'failed');
      throw new Error('存在同名文件!');
    }
    await updateDocumentProgress(task.documentId, 5, '未发现同名文件,开始处理...', 'processing');
    // 创建初始文档记录
    const document = await prisma.document.create({
      data: {
        id: task.documentId,
        projectId: task.projectId,
        name: task.fileName,
        type: task.fileType,
        url: '', // 临时空值，后续会更新
        status: 'PROCESSING'
      }
    });
    if (document) {
      logger.info(`[Processing Task]: ${job.id}` + 'Created document record');
      // 读取临时文件
      const buffer = await readTempFile(task.tempFilePath);

      let url = '';
      let pdf = null;
      let coverUrl = null;

      // 检查是否为doc或docx文件
      const isDocFile = task.type === 'application/msword' || task.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      if (isDocFile) {
        // 处理文件
        await updateDocumentProgress(task.documentId, 20, '正在处理文件', 'processing');
        const { pdfBuffer, coverBuffer } = await processDocument(buffer, task.fileType, task.fileName);
        await updateDocumentProgress(task.documentId, 50, '文件处理完成', 'processing');

        // 安全处理文件名
        const safeFileName = sanitizeFileName(task.fileName);
        const pdfFileName = safeFileName.replace(/\.(doc|docx)$/i, '.pdf');
        const coverFileName = `${safeFileName.replace(/\.[^.]+$/, '')}_cover.jpg`;
        await updateDocumentProgress(task.documentId, 60, '正在上传文件', 'processing');
        // 并行上传文件
        const [fileUrl, pdfUrl, cover] = await Promise.all([
          uploadFile(safeFileName, buffer, task.fileType),
          uploadFile('pdf/' + pdfFileName, pdfBuffer, 'application/pdf'),
          coverBuffer ? uploadFile('cover/' + coverFileName, coverBuffer, 'image/jpeg') : Promise.resolve(null)
        ]);
        url = fileUrl;
        pdf = pdfUrl;
        coverUrl = cover;
      } else {
        // 直接上传其他类型的文件
        await updateDocumentProgress(task.documentId, 20, '正在上传文件', 'processing');
        const safeFileName = sanitizeFileName(task.fileName);
        url = await uploadFile(safeFileName, buffer, task.type);
        await updateDocumentProgress(task.documentId, 80, '文件上传完成', 'processing');
      }

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
      await updateDocumentProgress(task.documentId, 100, '已清理临时文件,任务完成', 'completed');
      logger.info(`[Processing Task]: ${job.id} completed successfully`);
    } else {
      await updateDocumentProgress(task.documentId, 100, '任务处理失败,文档记录不存在', 'failed');
    }

  } catch (error) {
    console.error(`[Processing Task]: ${job.id} Error processing task ${job.id}:`, error);
    await updateDocumentProgress(task.documentId, 100, `任务处理失败: ${error}`, 'failed');
    // 标记为失败
    // await prisma.document.update({
    //   where: { id: task.documentId },
    //   data: { status: 'FAILED' }
    // });
    // 清理临时文件
    deleteTempFile(task.tempFilePath);
    logger.info(`[Processing Task]: ${job.id} failed`);

    // 抛出错误，让 BullMQ 处理重试
    throw error;
  }
}

let worker: Worker | null = null;

/**
 * 启动文档处理器
 */
export function startDocumentProcessor(): void {

  if (global.docWorker) {
    logger.info('Document processor already started');
    return;
  }
  // 创建 BullMQ Worker
  worker = new Worker('document-processing', processor,
    {
      connection: getRedisConfig(),
      concurrency: 1
    });
  logger.info({ getRedisConfig: getRedisConfig() }, 'redis config');
  worker.on('progress', (job) => {
    logger.info(`Job ${job.id} progress: ${job.progress}`);
  });
  worker.on('active', (job) => {
    logger.info(`Job ${job.id} is active`);
  });
  // 监听事件
  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    logger.info(`Job ${job?.id || 'unknown'} failed with error: ${error.message}`);
  });

  worker.on('error', (error) => {
    console.error('Worker error:', error);
  });
  // 3. 将实例存入全局
  global.docWorker = worker;
  logger.info(`PID: ${process.pid} Document processor started with BullMQ`);
}

// 导出 workerexport { worker };