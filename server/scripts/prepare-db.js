import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

const databaseUrl = (process.env.DATABASE_URL || '').trim();

// Check if the URL is a sample placeholder from guides
const isPlaceholder = 
  !databaseUrl ||
  databaseUrl.includes('ep-xxxxx') ||
  databaseUrl.includes('ep-cool-dawn-a1b2c3') ||
  databaseUrl.includes('change-this') ||
  databaseUrl.includes('dummy') ||
  databaseUrl.startsWith('file:');

const isRealPostgres = !isPlaceholder && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'));
const targetProvider = isRealPostgres ? 'postgresql' : 'sqlite';

try {
  let schema = fs.readFileSync(schemaPath, 'utf8');

  // Update provider
  const providerRegex = /provider\s*=\s*"(sqlite|postgresql)"/;
  schema = schema.replace(providerRegex, `provider = "${targetProvider}"`);

  // Update url
  const urlRegex = /url\s*=\s*.*$/m;
  if (targetProvider === 'sqlite') {
    schema = schema.replace(urlRegex, 'url      = "file:./dev.db"');
    console.log(`[prepare-db] Using local SQLite database (file:./dev.db).`);
  } else {
    schema = schema.replace(urlRegex, 'url      = env("DATABASE_URL")');
    console.log(`[prepare-db] Using cloud PostgreSQL database.`);
  }

  fs.writeFileSync(schemaPath, schema, 'utf8');
} catch (error) {
  console.error('[prepare-db] Error updating schema.prisma:', error);
}
