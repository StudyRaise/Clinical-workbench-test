import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['query', 'error', 'warn']
    });
  }
  return prisma;
}

export async function disconnect() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
