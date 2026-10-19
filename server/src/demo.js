import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';

export function createDemoData(passwordHash) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentDay = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const d = (day) => new Date(year, month, Math.min(Math.max(1, day), daysInMonth), 12, 0, 0);
  const lastD = (day) => new Date(year, month - 1, Math.min(Math.max(1, day), 28), 12, 0, 0);

  return {
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
        totalLimit: 1500,
        categoryLimits: JSON.stringify({
          Food: 500,
          Transport: 250,
          Entertainment: 300,
          Study: 200,
          Utilities: 250,
        }),
      },
    },
    savingsGoals: {
      create: [
        {
          name: 'Emergency fund',
          targetAmount: 2000,
          currentAmount: 1100,
          targetDate: new Date(year, month + 2, 15),
        },
        {
          name: 'Laptop upgrade',
          targetAmount: 1500,
          currentAmount: 650,
          targetDate: new Date(year, month + 1, 20),
        },
      ],
    },
    expenses: {
      create: [
        { amount: 68, category: 'Food', date: d(Math.min(2, currentDay)), note: 'Groceries' },
        { amount: 35, category: 'Transport', date: d(Math.min(4, currentDay)), note: 'Jeepney & bus fare' },
        { amount: 120, category: 'Entertainment', date: d(Math.min(7, currentDay)), note: 'Movie with friends' },
        { amount: 55, category: 'Study', date: d(Math.min(10, currentDay)), note: 'Textbook & pens' },
        { amount: 45, category: 'Food', date: d(Math.min(14, currentDay)), note: 'Coffee and snacks' },
        { amount: 95, category: 'Utilities', date: d(Math.min(18, currentDay)), note: 'Mobile data load' },
        { amount: 80, category: 'Food', date: d(currentDay), note: 'Lunch at school' },
        { amount: 110, category: 'Food', date: lastD(5), note: 'Supermarket supplies' },
        { amount: 40, category: 'Transport', date: lastD(12), note: 'Train & jeep fare' },
        { amount: 150, category: 'Entertainment', date: lastD(20), note: 'Weekend outing' },
      ],
    },
    incomes: {
      create: [
        { amount: 3000, source: 'Allowance', date: d(1), note: 'Monthly allowance from parents' },
        { amount: 1500, source: 'Job', date: d(Math.min(currentDay, 15)), note: 'Campus tutoring' },
        { amount: 3000, source: 'Allowance', date: lastD(1), note: 'Monthly allowance from parents' },
      ],
    },
  };
}

export async function ensureDemoUser() {
  const passwordHash = await bcrypt.hash('password123', 10);
  const existing = await prisma.user.findUnique({
    where: { email: 'student@peso.app' },
    include: {
      balances: true,
      budgets: true,
      savingsGoals: true,
      expenses: true,
      incomes: true,
    },
  });

  if (!existing) {
    console.log('Seeding demo user student@peso.app...');
    const demoData = createDemoData(passwordHash);
    const user = await prisma.user.create({
      data: demoData,
      include: {
        balances: true,
        budgets: true,
        savingsGoals: true,
        expenses: true,
        incomes: true,
      },
    });
    console.log('Demo user seeded successfully.');
    return user;
  }

  // Update password in case it was changed
  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash },
  });

  // Ensure balance exists
  if (!existing.balances?.length) {
    await prisma.balance.create({
      data: { userId: existing.id, currentAmount: 3200 },
    });
  }

  // Ensure budget exists
  if (!existing.budgets?.length) {
    await prisma.budget.create({
      data: {
        userId: existing.id,
        period: 'monthly',
        totalLimit: 1500,
        categoryLimits: JSON.stringify({
          Food: 500,
          Transport: 250,
          Entertainment: 300,
          Study: 200,
          Utilities: 250,
        }),
      },
    });
  }

  // Ensure savings goals exist
  if (!existing.savingsGoals?.length) {
    const now = new Date();
    await prisma.savingsGoal.create({
      data: { userId: existing.id, name: 'Emergency fund', targetAmount: 2000, currentAmount: 1100, targetDate: new Date(now.getFullYear(), now.getMonth() + 2, 15) },
    });
    await prisma.savingsGoal.create({
      data: { userId: existing.id, name: 'Laptop upgrade', targetAmount: 1500, currentAmount: 650, targetDate: new Date(now.getFullYear(), now.getMonth() + 1, 20) },
    });
  }

  // Ensure expenses exist
  if (!existing.expenses?.length) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const d = (day) => new Date(year, month, Math.min(Math.max(1, day), daysInMonth), 12, 0, 0);
    const lastD = (day) => new Date(year, month - 1, Math.min(Math.max(1, day), 28), 12, 0, 0);

    const items = [
      { amount: 68, category: 'Food', date: d(Math.min(2, currentDay)), note: 'Groceries' },
      { amount: 35, category: 'Transport', date: d(Math.min(4, currentDay)), note: 'Jeepney & bus fare' },
      { amount: 120, category: 'Entertainment', date: d(Math.min(7, currentDay)), note: 'Movie with friends' },
      { amount: 55, category: 'Study', date: d(Math.min(10, currentDay)), note: 'Textbook & pens' },
      { amount: 45, category: 'Food', date: d(Math.min(14, currentDay)), note: 'Coffee and snacks' },
      { amount: 95, category: 'Utilities', date: d(Math.min(18, currentDay)), note: 'Mobile data load' },
      { amount: 80, category: 'Food', date: d(currentDay), note: 'Lunch at school' },
      { amount: 110, category: 'Food', date: lastD(5), note: 'Supermarket supplies' },
      { amount: 40, category: 'Transport', date: lastD(12), note: 'Train & jeep fare' },
      { amount: 150, category: 'Entertainment', date: lastD(20), note: 'Weekend outing' },
    ];
    for (const item of items) {
      await prisma.expense.create({
        data: { userId: existing.id, ...item },
      });
    }
  }

  // Ensure incomes exist
  if (!existing.incomes?.length) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();
    const d = (day) => new Date(year, month, Math.min(Math.max(1, day), 28), 12, 0, 0);
    const lastD = (day) => new Date(year, month - 1, Math.min(Math.max(1, day), 28), 12, 0, 0);

    const incs = [
      { amount: 3000, source: 'Allowance', date: d(1), note: 'Monthly allowance from parents' },
      { amount: 1500, source: 'Job', date: d(Math.min(currentDay, 15)), note: 'Campus tutoring' },
      { amount: 3000, source: 'Allowance', date: lastD(1), note: 'Monthly allowance from parents' },
    ];
    for (const inc of incs) {
      await prisma.income.create({
        data: { userId: existing.id, ...inc },
      });
    }
  }

  return existing;
}
