import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

const databaseUrl = process.env.DATABASE_URL || '';
const isPostgres = databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://');
const targetProvider = isPostgres ? 'postgresql' : 'sqlite';

try {
  let schema = fs.readFileSync(schemaPath, 'utf8');
  const providerRegex = /provider\s*=\s*"(sqlite|postgresql)"/;
  const currentMatch = schema.match(providerRegex);

  if (currentMatch && currentMatch[1] !== targetProvider) {
    schema = schema.replace(providerRegex, `provider = "${targetProvider}"`);
    fs.writeFileSync(schemaPath, schema, 'utf8');
    console.log(`[prepare-db] Updated Prisma datasource provider to "${targetProvider}" based on DATABASE_URL.`);
  } else {
    console.log(`[prepare-db] Prisma datasource provider is "${targetProvider}".`);
  }
} catch (error) {
  console.error('[prepare-db] Error updating schema.prisma:', error);
}
