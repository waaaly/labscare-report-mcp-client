function formatLogArgs(args: unknown[]): string {
  return args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}
export function writeToFile(...args: unknown[]) {
  if (typeof window === 'undefined') {
     // 只有在服务端环境才会动态加载这些 Node 模块
    const fs =  require('fs');
    const path =  require('path');
    const logFilePath = path.join(process.cwd(), 'debug.log');
    const timestamp = new Date().toISOString();
    const message = formatLogArgs(args);
    const logLine = `[${timestamp}] ${message}\n`;

    try {
      fs.appendFileSync(logFilePath, logLine, 'utf-8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}