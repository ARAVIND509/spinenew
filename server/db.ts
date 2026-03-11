import "dotenv/config";
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Test connection
prisma.$connect()
  .then(() => console.log('Successfully connected to SQLite database via Prisma'))
  .catch((err: any) => console.error('Failed to connect to database:', err));
