import fs from 'fs';
import path from 'path';

export const isDevelopment = process.env.NODE_ENV === 'development';

const logFilePath = path.join(process.cwd(), 'debug.log');

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
  const timestamp = new Date().toISOString();
  const message = formatLogArgs(args);
  const logLine = `[${timestamp}] ${message}\n`;
  
  try {
    fs.appendFileSync(logFilePath, logLine, 'utf-8');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

export function devLog(...args: unknown[]) {
  if (isDevelopment) {
    console.log('[DEV]', ...args);
  }
  writeToFile('[INFO]', ...args);
}

export function devWarn(...args: unknown[]) {
  if (isDevelopment) {
    console.warn('[DEV]', ...args);
  }
  writeToFile('[WARN]', ...args);
}

export function devError(...args: unknown[]) {
  if (isDevelopment) {
    console.error('[DEV]', ...args);
  }
  writeToFile('[ERROR]', ...args);
}

export const logger = {
  info: devLog,
  warn: devWarn,
  error: devError,
  file: writeToFile,
}