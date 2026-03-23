import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
prisma.$use(async (params, next) => {
  const { createId } = require('@paralleldrive/cuid2');
  if (params.action === 'create') {
    switch (params.model) {
      case "Project":
        if (!params.args.data.id) {
          params.args.data.id = `proj${createId()}`;
        }
      case "Lab":
        if (!params.args.data.id) {
          params.args.data.id = `lab${createId()}`;
        }
      case "Document":
        if (!params.args.data.id) {
          params.args.data.id = `doc${createId()}`;
        }
    }
  }

  return next(params);
});