import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..');

// 1. Prepare schema.prisma with the right provider (sqlite vs postgresql)
try {
  execSync('node scripts/prepare-db.js', { cwd: serverDir, stdio: 'inherit' });
} catch (err) {
  console.error('[db:setup] Error in prepare-db:', err.message);
}

// 2. Always generate Prisma client
try {
  execSync('npx prisma generate', { cwd: serverDir, stdio: 'inherit' });
} catch (err) {
  console.error('[db:setup] Fatal: Error generating prisma client:', err.message);
  process.exit(1);
}

// 3. Attempt db push, but DO NOT fail the build if the database is unreachable
try {
  console.log('[db:setup] Synchronizing database schema...');
  execSync('npx prisma db push --skip-generate --accept-data-loss', { cwd: serverDir, stdio: 'inherit' });
  console.log('[db:setup] Database schema synchronized successfully.');
} catch (err) {
  console.warn('[db:setup] Note: Could not push schema to database during build (' + err.message + ').');
  console.warn('[db:setup] Build will continue normally. Schema will sync when a valid database is connected.');
}

