import 'server-only'; 
import fs from 'fs';

import path from 'path';


// 临时文件存储目录
const TEMP_DIR = path.join(process.cwd(), 'temp');

// 确保临时目录存在
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * 写入临时文件
 * @param file 上传的文件
 * @returns 临时文件路径
 */
export async function writeTempFile(file: File): Promise<string> {
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // 生成唯一文件名
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
    const tempFilePath = path.join(TEMP_DIR, uniqueName);
    
    // 写入文件
    fs.writeFileSync(tempFilePath, buffer);
    
    return tempFilePath;
  } catch (error) {
    console.error('Failed to write temp file:', error);
    throw error;
  }
}

/**
 * 读取临时文件
 * @param filePath 临时文件路径
 * @returns 文件缓冲区
 */
export async function readTempFile(filePath: string): Promise<Buffer> {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    console.error('Failed to read temp file:', error);
    throw error;
  }
}

/**
 * 删除临时文件
 * @param filePath 临时文件路径
 */
export async function deleteTempFile(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Failed to delete temp file:', error);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 清理过期的临时文件
 * @param maxAge 最大文件年龄（毫秒）
 */
export async function cleanupTempFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup temp files:', error);
  }
}

export { TEMP_DIR };