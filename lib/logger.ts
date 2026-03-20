export const isDevelopment = process.env.NODE_ENV === 'development';

export function devLog(...args: unknown[]) {
  if (isDevelopment) {
    console.log('[DEV]', ...args);
  }
}

export function devWarn(...args: unknown[]) {
  if (isDevelopment) {
    console.warn('[DEV]', ...args);
  }
}

export function devError(...args: unknown[]) {
  if (isDevelopment) {
    console.error('[DEV]', ...args);
  }
}

export const logger = {
  info:devLog,
  warn:devWarn,
  error:devError,
}