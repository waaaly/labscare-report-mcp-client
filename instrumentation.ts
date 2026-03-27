
export async function register() {

  // 启动文档处理器
  // 必须加这个判断，确保代码只在 Node.js 服务端运行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 使用 await import 动态加载，防止 Next.js 在其他环境下预解析该文件
    const { startDocumentProcessor } = await import('./lib/redis/docUploadWorker');
    startDocumentProcessor();
    console.log('Document processor registered via instrumentation hook');
  }
}
