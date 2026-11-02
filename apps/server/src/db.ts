import { PrismaClient } from '@prisma/client';
import { isDev } from './config.js';

export const prisma = new PrismaClient({
  log: isDev ? ['warn', 'error'] : ['error'],
});

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
