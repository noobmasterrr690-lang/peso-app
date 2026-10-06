import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const dbUrl = (process.env.DATABASE_URL || '').trim();
const isPlaceholder =
  !dbUrl ||
  dbUrl.includes('ep-xxxxx') ||
  dbUrl.includes('ep-cool-dawn') ||
  dbUrl.includes('change-this') ||
  dbUrl.includes('dummy') ||
  dbUrl.startsWith('file:');

const isRealPostgres = !isPlaceholder && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'));

if (!isRealPostgres) {
  const dbPath = path.resolve(__dirname, '../../prisma/dev.db');
  process.env.DATABASE_URL = `file:${dbPath}`;
}

export const prisma = new PrismaClient();

