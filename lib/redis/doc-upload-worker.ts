import { Worker, Job, WorkerOptions } from 'bullmq';
import { readTempFile, deleteTempFile } from '@/lib/storage';
import { processDocument } from '@/lib/docx/converter';
import { uploadFile } from '@/lib/minio/client';
import prisma from '@/lib/prisma';
import { sanitizeFileName } from '@/lib/utils';
import { DOCUMENT_PROCESSOR_WORKER_NAME, getRedisConfig, updateDocumentProgress } from './client';
import Pino from 'pino';
import fs from 'fs';

// ==================== 类型定义 ====================
interface DocumentJobData {
  documentId: string;
  projectId: string;
  fileName: string;
  fileType: string;
  type: string; // MIME type
  tempFilePath: string;
  reportId?: string;
  size?: number;
}

// 全局单例（防止多实例启动）
declare global {
  var docWorker: Worker | undefined;
}

// ==================== 工具函数 ====================
async function waitForFile(
  filePath: string,
  maxRetries = 5,
  logger: Pino.Logger
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (fs.existsSync(filePath)) {
      return true;
    }
    logger.info(`[Processing Task] 等待文件就绪... 第 ${i + 1} 次重试`);
    await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1))); // 指数退避
  }
  return false;
}

async function checkFileExists(documentId: string, fileName: string, logger: Pino.Logger): Promise<boolean> {
  try {
    const existing = await prisma.document.findFirst({
      where: { name: fileName, projectId: { not: undefined } }, // 可根据需要加 projectId 过滤
      select: { id: true },
    });
    return !!existing;
  } catch (error) {
    logger.error(`[Processing Task]: ${documentId} 检查文件存在性失败: ${error}`);
    return false;
  }
}

async function handleError(
  documentId: string,
  fileName: string,
  error: unknown,
  logger: Pino.Logger,
  stage: string
): Promise<void> {
  const msg = `${stage}: ${error}`;
   if (error instanceof AggregateError) {
    error.errors.forEach((singleError, index) => {
      console.error(`Error ${index}:`, singleError.message);
    });
  } else {
    console.error(error);
  }
  logger.error(`[Processing Task]: ${documentId} ${msg}`);
  try {
    await updateDocumentProgress(documentId, fileName, 100, msg, 'failed');
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED' },
    });
  } catch (cleanupErr) {
    logger.error(`[Processing Task]: ${documentId} 清理失败: ${cleanupErr}`);
  }
}

// ==================== 核心处理器 ====================
async function processor(job: Job<DocumentJobData>, logger: Pino.Logger): Promise<void> {
  const { documentId, fileName, projectId, fileType, tempFilePath, reportId, size } = job.data;
  const jobId = job.id;
  const startTime = Date.now();

  // 为每个任务创建一个带前缀的子 logger（强烈推荐！）
  const taskLogger = logger.child({
    component: "Worker",
    jobId,
    documentId,
    fileName
  });

  let tempFileFound = false;
  let buffer: Buffer | null = null;
  let documentCreated = false;

  try {
    taskLogger.info(`🚀 开始处理任务 (耗时将从现在开始计时)`);

    // 1. 等待并读取临时文件
    tempFileFound = await waitForFile(tempFilePath, 6, taskLogger);
    if (!tempFileFound) {
      throw new Error(`临时文件不存在或等待超时: ${tempFilePath}`);
    }

    buffer = await readTempFile(tempFilePath);
    taskLogger.info(`临时文件读取成功，Buffer 大小: ${buffer.length} bytes`);

    // 2. 重名检查
    const exists = await checkFileExists(documentId, fileName, taskLogger);
    if (exists) {
      throw new Error(`文件已存在: ${fileName}`);
    }

    // 3. 创建文档记录
    await updateDocumentProgress(documentId, fileName, 20, '开始处理文件...', 'processing');
    await prisma.document.create({
      data: {
        id: documentId,
        projectId,
        reportId: reportId,
        name: fileName,
        type: fileType,
        url: '',
        size: size || 0,
        status: 'PROCESSING',
      },
    });
    documentCreated = true;
    taskLogger.info('文档记录创建成功');

    // 4. 处理文件
    const isDocFile = fileType.includes('word') || fileType.includes('docx') || fileType.includes('msword');
    const isTextFile = fileType.includes('text/') || fileType.includes('application/json') || fileType.includes('application/xml') || fileType.includes('text/markdown') || fileType.includes('text/csv');

    let url = '', pdf: string | null = null, coverUrl: string | null = null, content: string | undefined, mdContent: string | undefined;

    if (isDocFile) {
      taskLogger.info('检测到 Word 文档，开始转换...');
      await updateDocumentProgress(documentId, fileName, 50, '正在转换 Word 为 PDF...', 'processing');

      const { pdfBuffer, coverBuffer } = await processDocument(buffer, fileType, fileName);

      const safeName = sanitizeFileName(fileName);
      const pdfName = safeName.replace(/\.(doc|docx)$/i, '.pdf');
      const coverName = `${safeName.replace(/\.[^.]+$/, '')}_cover.jpg`;

      await updateDocumentProgress(documentId, fileName, 70, '转换完成，正在上传...', 'processing');

      const [fileUrl, pdfUrl, cover] = await Promise.all([
        uploadFile(safeName, buffer, fileType),
        uploadFile(`pdf/${pdfName}`, pdfBuffer, 'application/pdf'),
        coverBuffer ? uploadFile(`cover/${coverName}`, coverBuffer, 'image/jpeg') : Promise.resolve(null),
      ]);

      url = fileUrl;
      pdf = pdfUrl;
      coverUrl = cover;

      taskLogger.info(`Word 处理完成 | PDF: ${pdfUrl ? '成功' : '无'} | Cover: ${coverUrl ? '成功' : '无'}`);
    } else {
      taskLogger.info('非 Word 文件，直接上传...');
      await updateDocumentProgress(documentId, fileName, 70, '正在上传文件...', 'processing');

      const safeName = sanitizeFileName(fileName);
      url = await uploadFile(safeName, buffer, fileType);

      // 处理文本类型文件，读取内容
      if (isTextFile) {
        try {
          const fileContent = buffer.toString('utf8');
          taskLogger.info(`文本文件内容读取成功，长度: ${fileContent.length} 字符`);
          
          // 区分 Markdown 文件和其他文本文件
          if (fileType.includes('markdown') || fileType.includes('md') || fileName.endsWith('.md')) {
            mdContent = fileContent;
          } else {
            content = fileContent;
          }
        } catch (error) {
          taskLogger.warn(`文本文件内容读取失败: ${error}`);
          content = undefined;
        }
      }

      taskLogger.info(`文件上传完成，URL: ${url}`);
    }

    // 5. 更新数据库最终状态
    const updateData: any = { status: 'COMPLETED', url, pdf, cover: coverUrl };
    if (content !== undefined) {
      updateData.content = content;
    }
    if (mdContent !== undefined) {
      updateData.mdContent = mdContent;
    }
    await prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    taskLogger.info(`✅ 任务处理成功！总耗时 ${duration}s`);

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    taskLogger.error(`❌ 任务处理失败，耗时 ${duration}s | 错误: ${error.message}`);
    await handleError(documentId, fileName, error, taskLogger, '任务处理异常');
    throw error;   // 让 BullMQ 标记为 failed
  } finally {
    if (tempFileFound) {
      try {
        deleteTempFile(tempFilePath);
        taskLogger.info('临时文件清理完成');
      } catch (e) {
        taskLogger.warn(`临时文件清理失败: ${e}`);
      }
    }

    try {
      await updateDocumentProgress(documentId, fileName, 100,
        documentCreated ? '任务处理完成' : '任务失败',
        documentCreated ? 'completed' : 'failed'
      );
    } catch (e) {
      taskLogger.warn(`最终进度更新失败: ${e}`);
    }
  }
}

// ==================== Worker 启动 ====================
let workerInstance: Worker | null = null;

export function startDocumentProcessor(logger: Pino.Logger): void {
  if (global.docWorker) {
    logger.info('Document processor already started');
    return;
  }

  const workerOptions: WorkerOptions = {
    connection: getRedisConfig(),
    concurrency: 3,           // ← 改成 2~4 （推荐从 3 开始）
    lockDuration: 600_000,    // 10 分钟（docx 转换可能比较慢）
    stalledInterval: 30_000,  // 每 30 秒检查 stalled job
    maxStalledCount: 2,       // 最多重试 stalled 2 次
  };

  workerInstance = new Worker<DocumentJobData>(
    DOCUMENT_PROCESSOR_WORKER_NAME,
    (job) => processor(job, logger),
    workerOptions
  );

  // 事件监听（统一处理）
  const events = ['active', 'completed', 'failed', 'progress', 'error', 'stalled'] as const;
  events.forEach((event) => {
    workerInstance!.on(event, (Job: Job, error?: Error) => {
      try {
        if (event === 'error') {
          logger.error(`Worker error: ${Job}`);
        } else if (event === 'failed') {
          logger.error(`Job ${Job?.id || 'unknown'} failed: ${error?.message}`);
        } else {
          logger.info(`Job ${Job?.id} ${event}`);
        }
      } catch (e) {
        logger.error(`Event handler error (${event}): ${e}`);
      }
    });
  });

  global.docWorker = workerInstance;
  logger.info(`PID: ${process.pid} Document processor started with BullMQ`);
}

// 导出（可选）
export { workerInstance as worker };

// ==================== Graceful Shutdown 示例（推荐在进程退出时调用） ====================
export async function shutdownDocumentProcessor(logger: Pino.Logger): Promise<void> {
  if (global.docWorker) {
    logger.info('Shutting down document worker...');
    await global.docWorker.close();
    global.docWorker = undefined;
    logger.info('Document worker closed');
  }
}