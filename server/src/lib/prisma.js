import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export function isRealPostgresUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (
    trimmed.includes('ep-xxxxx') ||
    trimmed.includes('ep-cool-dawn') ||
    trimmed.includes('change-this') ||
    trimmed.includes('dummy') ||
    trimmed.startsWith('file:')
  ) {
    return false;
  }
  return trimmed.startsWith('postgres://') || trimmed.startsWith('postgresql://');
}

export const isRealPostgres = isRealPostgresUrl(process.env.DATABASE_URL);

if (!isRealPostgres) {
  const dbPath = path.resolve(__dirname, '../../prisma/dev.db');
  process.env.DATABASE_URL = `file:${dbPath}`;
}

export const prisma = new PrismaClient();

