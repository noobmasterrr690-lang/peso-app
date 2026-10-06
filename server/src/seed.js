import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';

const passwordHash = await bcrypt.hash('password123', 10);

const existing = await prisma.user.findUnique({ where: { email: 'student@peso.app' } });
if (existing) {
  console.log('Demo user already exists.');
  process.exit(0);
}

const user = await prisma.user.create({
  data: {
    name: 'Sam Student',
    email: 'student@peso.app',
    passwordHash,
    balances: {
      create: {
        currentAmount: 3200,
      },
    },
    budgets: {
      create: {
        period: 'monthly',
        totalLimit: 1200,
        categoryLimits: JSON.stringify({
          Food: 350,
          Transport: 180,
          Entertainment: 220,
          Study: 140,
          Utilities: 160,
        }),
      },
    },
    savingsGoals: {
      create: [
        {
          name: 'Emergency fund',
          targetAmount: 1500,
          currentAmount: 780,
          targetDate: new Date('2026-12-15T00:00:00.000Z'),
        },
        {
          name: 'Laptop upgrade',
          targetAmount: 1200,
          currentAmount: 420,
          targetDate: new Date('2026-10-20T00:00:00.000Z'),
        },
      ],
    },
    expenses: {
      create: [
        { amount: 68, category: 'Food', date: new Date('2026-09-01'), note: 'Groceries' },
        { amount: 32, category: 'Transport', date: new Date('2026-09-02'), note: 'Bus pass' },
        { amount: 120, category: 'Entertainment', date: new Date('2026-09-05'), note: 'Movie night' },
        { amount: 55, category: 'Study', date: new Date('2026-09-07'), note: 'Textbooks' },
        { amount: 42, category: 'Food', date: new Date('2026-09-12'), note: 'Coffee and snacks' },
        { amount: 89, category: 'Utilities', date: new Date('2026-09-10'), note: 'Internet and phone' },
        { amount: 76, category: 'Food', date: new Date('2026-09-18'), note: 'Dinner with friends' },
      ],
    },
    incomes: {
      create: [
        { amount: 2500, source: 'Allowance', date: new Date('2026-09-01'), note: 'Monthly allowance from parents' },
        { amount: 1200, source: 'Part-time Job', date: new Date('2026-09-15'), note: 'Campus tutoring' },
      ],
    },
  },
  include: {
    balances: true,
    budgets: true,
    savingsGoals: true,
    incomes: true,
  },
});

console.log('Seeded demo user:', user.email);
process.exit(0);
