import { PrismaClient } from '@prisma/client';

// 全局 Prisma 客户端实例
let prisma: PrismaClient;
// 注入 BigInt 序列化逻辑
if (!(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

if (process.env.NODE_ENV === 'production') {
  // 生产环境直接创建新实例
  prisma = new PrismaClient();
} else {
  // 开发环境使用全局实例避免重复创建
  const globalForPrisma = global as unknown as { prisma: PrismaClient };
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = globalForPrisma.prisma;
}

export default prisma;
