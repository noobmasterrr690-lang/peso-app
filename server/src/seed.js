import { ensureDemoUser } from './demo.js';

try {
  const user = await ensureDemoUser();
  console.log('Seeded demo user:', user.email);
  process.exit(0);
} catch (error) {
  console.error('Failed to seed demo user:', error);
  process.exit(1);
}
