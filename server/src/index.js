import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prisma, isRealPostgres } from './lib/prisma.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'peso-dev-secret';

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

function sanitizeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

async function getUserBalance(userId) {
  return prisma.balance.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

async function adjustUserBalance(userId, delta, client = prisma) {
  const latest = await client.balance.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!latest) {
    return client.balance.create({
      data: { userId, currentAmount: Number(Number(delta).toFixed(2)) },
    });
  }

  const updatedAmount = Number((Number(latest.currentAmount) + Number(delta)).toFixed(2));
  return client.balance.update({
    where: { id: latest.id },
    data: { currentAmount: updatedAmount },
  });
}

async function getUserBudget(userId) {
  return prisma.budget.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

async function readJsonString(str) {
  try {
    return JSON.parse(str || '{}');
  } catch {
    return {};
  }
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return res.status(401).json({ message: 'Session expired or user not found. Please sign in again.' });
    }
    req.user = { id: user.id, email: user.email };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

app.get('/api/health', async (req, res) => {
  let dbStatus = 'ok';
  let dbError = null;
  try {
    await prisma.user.count();
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message;
  }
  res.json({
    ok: dbStatus === 'ok',
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    message: 'Peso server is running.',
    database: {
      status: dbStatus,
      provider: isRealPostgres ? 'postgresql' : 'sqlite',
      error: dbError,
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'healthy', message: 'Peso server is running.' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        balances: {
          create: { currentAmount: 0 },
        },
      },
    });

    const token = makeToken(user);
    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Unable to create account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json({
      token: makeToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Unable to log in.' });
  }
});

app.post('/api/auth/reset-request', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    return res.json({
      message: 'If an account exists for that email, a reset link has been sent.',
      token: null,
    });
  }

  const token = crypto.randomBytes(20).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  return res.json({
    message: 'If an account exists for that email, a reset link has been sent.',
    token,
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, token, password } = req.body || {};

  if (!email || !token || !password) {
    return res.status(400).json({ message: 'Email, reset token, and a new password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return res.status(400).json({ message: 'Unable to reset password for that account.' });
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.userId !== user.id || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ message: 'This reset token is invalid or expired.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await prisma.passwordResetToken.delete({ where: { token } });

  return res.json({ message: 'Password reset successful.' });
});

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  const [balance, budget, expenses, goals, incomes] = await Promise.all([
    getUserBalance(userId),
    getUserBudget(userId),
    prisma.expense.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    }),
    prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.income.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
  ]);

  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.amount), 0);
  const now = new Date();
  const periodStart = budget?.period === 'weekly'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
    : new Date(now.getFullYear(), now.getMonth(), 1);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = budget?.period === 'weekly'
    ? new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + 7)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const periodExpenses = expenses.filter((item) => {
    const date = new Date(item.date);
    return date >= periodStart && date < periodEnd;
  });
  const periodSpent = periodExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const periodIncomes = incomes.filter((item) => {
    const date = new Date(item.date);
    return date >= periodStart && date < periodEnd;
  });
  const periodIncome = periodIncomes.reduce((sum, item) => sum + Number(item.amount), 0);
  const netCashflow = periodIncome - periodSpent;

  const periodCategoryTotals = periodExpenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
    return acc;
  }, {});
  const categoryTotals = expenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
    return acc;
  }, {});

  const budgetLimits = budget ? await readJsonString(budget.categoryLimits) : {};
  const budgetStatus = budget
    ? {
        totalLimit: Number(budget.totalLimit),
        spent: periodSpent,
        remaining: Number(budget.totalLimit) - periodSpent,
        usagePercent: budget.totalLimit > 0 ? (periodSpent / Number(budget.totalLimit)) * 100 : 0,
        categoryLimits: budgetLimits,
        categorySpent: periodCategoryTotals,
        period: budget.period,
      }
    : null;

  const savingsTotal = goals.reduce((sum, goal) => sum + Number(goal.currentAmount), 0);

  return res.json({
    user: { id: userId },
    balance: balance ? Number(balance.currentAmount) : 0,
    totalExpenses,
    totalIncome,
    periodSpent,
    periodIncome,
    netCashflow,
    expenses,
    incomes,
    budget: budgetStatus,
    categoryTotals,
    goals,
    savingsTotal,
  });
});

app.get('/api/balance', authMiddleware, async (req, res) => {
  const balance = await getUserBalance(req.user.id);
  return res.json({ currentAmount: balance ? Number(balance.currentAmount) : 0 });
});

app.put('/api/balance', authMiddleware, async (req, res) => {
  const { currentAmount } = req.body || {};
  if (currentAmount === undefined || Number.isNaN(Number(currentAmount))) {
    return res.status(400).json({ message: 'A valid balance amount is required.' });
  }

  const userId = req.user.id;

  try {
    const latestBalance = await getUserBalance(userId);

    if (!latestBalance) {
      const balance = await prisma.balance.create({
        data: { userId, currentAmount: Number(currentAmount) },
      });
      return res.json({ currentAmount: Number(balance.currentAmount) });
    }

    const balance = await prisma.balance.update({
      where: { id: latestBalance.id },
      data: { currentAmount: Number(currentAmount) },
    });

    return res.json({ currentAmount: Number(balance.currentAmount) });
  } catch (error) {
    console.error('Update balance error:', error);
    return res.status(500).json({ message: error.message || 'Unable to update balance.' });
  }
});

app.get('/api/expenses', authMiddleware, async (req, res) => {
  const { category, startDate, endDate } = req.query;
  const where = { userId: req.user.id };

  if (category) where.category = category;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  try {
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    return res.status(500).json({ message: error.message || 'Unable to fetch expenses.' });
  }
});

app.post('/api/expenses', authMiddleware, async (req, res) => {
  const { amount, category, date, note } = req.body || {};

  if (!amount || !category || !date) {
    return res.status(400).json({ message: 'Amount, category, and date are required.' });
  }

  const numAmount = Number(amount);
  if (numAmount <= 0 || Number.isNaN(numAmount)) {
    return res.status(400).json({ message: 'A valid positive expense amount is required.' });
  }

  try {
    const validDate = isNaN(new Date(date).getTime()) ? new Date() : new Date(date);

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          userId: req.user.id,
          amount: numAmount,
          category: category.trim(),
          date: validDate,
          note: note?.trim() || '',
        },
      });

      const updatedBalance = await adjustUserBalance(req.user.id, -numAmount, tx);
      return {
        expense,
        currentBalance: Number(updatedBalance.currentAmount),
      };
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create expense error:', error);
    return res.status(500).json({ message: error.message || 'Unable to save expense.' });
  }
});

app.put('/api/expenses/:id', authMiddleware, async (req, res) => {
  const { amount, category, date, note } = req.body || {};
  const id = req.params.id;

  const existingExpense = await prisma.expense.findFirst({ where: { id, userId: req.user.id } });
  if (!existingExpense) {
    return res.status(404).json({ message: 'Expense not found.' });
  }

  const newAmount = amount !== undefined ? Number(amount) : existingExpense.amount;
  const diff = Number((newAmount - existingExpense.amount).toFixed(2));

  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.update({
      where: { id },
      data: {
        amount: newAmount,
        category: category === undefined ? existingExpense.category : category.trim(),
        date: date === undefined ? existingExpense.date : new Date(date),
        note: note === undefined ? existingExpense.note : note.trim(),
      },
    });

    let currentBalance;
    if (diff !== 0) {
      const updatedBalance = await adjustUserBalance(req.user.id, -diff, tx);
      currentBalance = Number(updatedBalance.currentAmount);
    } else {
      const balance = await getUserBalance(req.user.id);
      currentBalance = balance ? Number(balance.currentAmount) : 0;
    }

    return { expense, currentBalance };
  });

  return res.json(result);
});

app.delete('/api/expenses/:id', authMiddleware, async (req, res) => {
  const existingExpense = await prisma.expense.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existingExpense) {
    return res.status(404).json({ message: 'Expense not found.' });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id: req.params.id } });
    const updatedBalance = await adjustUserBalance(req.user.id, existingExpense.amount, tx);
    return {
      currentBalance: Number(updatedBalance.currentAmount),
      refundedAmount: existingExpense.amount,
    };
  });

  return res.json({ message: 'Expense deleted and refunded to balance.', ...result });
});

app.delete('/api/expenses', authMiddleware, async (req, res) => {
  const expenses = await prisma.expense.findMany({ where: { userId: req.user.id } });
  const totalRefund = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const result = await prisma.$transaction(async (tx) => {
    const delResult = await tx.expense.deleteMany({ where: { userId: req.user.id } });
    let updatedBalance;
    if (totalRefund > 0) {
      updatedBalance = await adjustUserBalance(req.user.id, totalRefund, tx);
    } else {
      updatedBalance = await getUserBalance(req.user.id);
    }
    return {
      deletedCount: delResult.count,
      refundedAmount: totalRefund,
      currentBalance: updatedBalance ? Number(updatedBalance.currentAmount) : 0,
    };
  });

  return res.json(result);
});

app.get('/api/incomes', authMiddleware, async (req, res) => {
  const { startDate, endDate } = req.query;
  const where = { userId: req.user.id };

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  const incomes = await prisma.income.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  return res.json(incomes);
});

app.post('/api/incomes', authMiddleware, async (req, res) => {
  const { amount, source, date, note } = req.body || {};

  if (!amount || !source || !date) {
    return res.status(400).json({ message: 'Amount, source, and date are required.' });
  }

  const numAmount = Number(amount);
  if (numAmount <= 0 || Number.isNaN(numAmount)) {
    return res.status(400).json({ message: 'A positive income amount is required.' });
  }

  try {
    const validDate = isNaN(new Date(date).getTime()) ? new Date() : new Date(date);

    const result = await prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          userId: req.user.id,
          amount: numAmount,
          source: source.trim(),
          date: validDate,
          note: note?.trim() || '',
        },
      });

      const updatedBalance = await adjustUserBalance(req.user.id, numAmount, tx);
      return {
        income,
        currentBalance: Number(updatedBalance.currentAmount),
      };
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create income error:', error);
    return res.status(500).json({ message: error.message || 'Unable to save income.' });
  }
});

app.delete('/api/incomes/:id', authMiddleware, async (req, res) => {
  const existingIncome = await prisma.income.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existingIncome) {
    return res.status(404).json({ message: 'Income entry not found.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.income.delete({ where: { id: req.params.id } });
      const updatedBalance = await adjustUserBalance(req.user.id, -existingIncome.amount, tx);
      return {
        currentBalance: Number(updatedBalance.currentAmount),
        deductedAmount: existingIncome.amount,
      };
    });

    return res.json({ message: 'Income entry removed and deducted from balance.', ...result });
  } catch (error) {
    console.error('Delete income error:', error);
    return res.status(500).json({ message: error.message || 'Unable to delete income.' });
  }
});

app.get('/api/budget', authMiddleware, async (req, res) => {
  try {
    const budget = await getUserBudget(req.user.id);
    if (!budget) {
      return res.json({ period: 'monthly', totalLimit: 0, categoryLimits: {} });
    }

    return res.json({
      id: budget.id,
      period: budget.period,
      totalLimit: Number(budget.totalLimit),
      categoryLimits: await readJsonString(budget.categoryLimits),
      updatedAt: budget.updatedAt,
    });
  } catch (error) {
    console.error('Get budget error:', error);
    return res.status(500).json({ message: error.message || 'Unable to fetch budget.' });
  }
});

app.put('/api/budget', authMiddleware, async (req, res) => {
  const { period = 'monthly', totalLimit = 0, categoryLimits = {} } = req.body || {};
  const userId = req.user.id;

  try {
    const existing = await getUserBudget(userId);
    const data = {
      userId,
      period,
      totalLimit: Number(totalLimit),
      categoryLimits: JSON.stringify(categoryLimits || {}),
    };

    const budget = existing
      ? await prisma.budget.update({ where: { id: existing.id }, data })
      : await prisma.budget.create({ data });

    return res.json({
      id: budget.id,
      period: budget.period,
      totalLimit: Number(budget.totalLimit),
      categoryLimits: await readJsonString(budget.categoryLimits),
    });
  } catch (error) {
    console.error('Update budget error:', error);
    return res.status(500).json({ message: error.message || 'Unable to save budget.' });
  }
});

app.get('/api/savings-goals', authMiddleware, async (req, res) => {
  const goals = await prisma.savingsGoal.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  return res.json(goals);
});

app.post('/api/savings-goals', authMiddleware, async (req, res) => {
  const { name, targetAmount, currentAmount, targetDate } = req.body || {};
  if (!name || targetAmount === undefined) {
    return res.status(400).json({ message: 'Goal name and target amount are required.' });
  }

  const goal = await prisma.savingsGoal.create({
    data: {
      userId: req.user.id,
      name: name.trim(),
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount || 0),
      targetDate: targetDate ? new Date(targetDate) : null,
    },
  });

  return res.status(201).json(goal);
});

app.put('/api/savings-goals/:id', authMiddleware, async (req, res) => {
  const { name, targetAmount, currentAmount, targetDate } = req.body || {};
  const existing = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) {
    return res.status(404).json({ message: 'Savings goal not found.' });
  }

  const goal = await prisma.savingsGoal.update({
    where: { id: existing.id },
    data: {
      name: name === undefined ? existing.name : name.trim(),
      targetAmount: targetAmount === undefined ? existing.targetAmount : Number(targetAmount),
      currentAmount: currentAmount === undefined ? existing.currentAmount : Number(currentAmount),
      targetDate: targetDate === undefined ? existing.targetDate : targetDate ? new Date(targetDate) : null,
    },
  });

  return res.json(goal);
});

app.delete('/api/savings-goals/:id', authMiddleware, async (req, res) => {
  const existing = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) {
    return res.status(404).json({ message: 'Savings goal not found.' });
  }

  await prisma.savingsGoal.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

app.post('/api/savings-goals/:id/deposit', authMiddleware, async (req, res) => {
  const { amount } = req.body || {};
  const numAmount = Number(amount);

  if (!numAmount || numAmount <= 0 || Number.isNaN(numAmount)) {
    return res.status(400).json({ message: 'A valid positive deposit amount is required.' });
  }

  const goal = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!goal) {
    return res.status(404).json({ message: 'Savings goal not found.' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedGoal = await tx.savingsGoal.update({
      where: { id: goal.id },
      data: { currentAmount: Number((Number(goal.currentAmount) + numAmount).toFixed(2)) },
    });

    const updatedBalance = await adjustUserBalance(req.user.id, -numAmount, tx);
    return {
      goal: updatedGoal,
      currentBalance: Number(updatedBalance.currentAmount),
      depositedAmount: numAmount,
    };
  });

  return res.json(result);
});

app.post('/api/savings-goals/:id/withdraw', authMiddleware, async (req, res) => {
  const { amount } = req.body || {};
  const numAmount = Number(amount);

  if (!numAmount || numAmount <= 0 || Number.isNaN(numAmount)) {
    return res.status(400).json({ message: 'A valid positive withdrawal amount is required.' });
  }

  const goal = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!goal) {
    return res.status(404).json({ message: 'Savings goal not found.' });
  }

  if (Number(goal.currentAmount) < numAmount) {
    return res.status(400).json({ message: 'Withdrawal amount exceeds current goal savings.' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedGoal = await tx.savingsGoal.update({
      where: { id: goal.id },
      data: { currentAmount: Number((Number(goal.currentAmount) - numAmount).toFixed(2)) },
    });

    const updatedBalance = await adjustUserBalance(req.user.id, numAmount, tx);
    return {
      goal: updatedGoal,
      currentBalance: Number(updatedBalance.currentAmount),
      withdrawnAmount: numAmount,
    };
  });

  return res.json(result);
});

app.get('/api/reports', authMiddleware, async (req, res) => {
  const { startDate, endDate } = req.query;
  const where = { userId: req.user.id };

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  const [expenses, incomes, goals] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { date: 'asc' } }),
    prisma.income.findMany({ where, orderBy: { date: 'asc' } }),
    prisma.savingsGoal.findMany({ where: { userId: req.user.id } }),
  ]);

  const categoryTotals = expenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
    return acc;
  }, {});

  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalSaved = goals.reduce((sum, goal) => sum + Number(goal.currentAmount), 0);

  const now = new Date();
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
      label: month.toLocaleDateString('en-US', { month: 'short' }),
    };
  });
  const monthlyStats = monthKeys.map(({ key, label }) => {
    const monthExpenses = expenses.filter((expense) => {
      const date = new Date(expense.date);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === key;
    });
    const monthIncomes = incomes.filter((income) => {
      const date = new Date(income.date);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === key;
    });
    const expenseTotal = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const incomeTotal = monthIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
    return {
      key,
      label,
      total: expenseTotal,
      incomeTotal,
      net: incomeTotal - expenseTotal,
      count: monthExpenses.length,
    };
  });

  return res.json({
    totals: {
      totalExpenses,
      totalIncome,
      netCashflow: totalIncome - totalExpenses,
      totalSaved,
    },
    categoryTotals,
    expenses,
    incomes,
    goals,
    monthlyStats,
  });
});

// Serve the compiled React client from the same local server.
// API routes above stay unchanged, while browser requests can use one URL.
app.use(express.static(clientDist));
app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
  res.sendFile(path.join(clientDist, 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ message: err?.message || 'Something went wrong on the server.' });
});

async function startServer() {
  if (!isRealPostgres) {
    try {
      await prisma.user.count();
      console.log('SQLite database verified.');
    } catch (err) {
      console.log('Database tables not ready (' + err.message + '). Auto-pushing schema...');
      try {
        execSync('npx prisma db push --skip-generate --accept-data-loss', {
          cwd: path.resolve(__dirname, '..'),
          stdio: 'inherit',
        });
        console.log('Database schema push completed successfully.');
      } catch (pushErr) {
        console.error('Failed to auto-push database schema:', pushErr);
      }
    }
  } else {
    try {
      await prisma.user.count();
      console.log('PostgreSQL database verified.');
    } catch (err) {
      console.error('PostgreSQL connection test failed:', err.message);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Peso server listening on http://0.0.0.0:${PORT} (port ${PORT})`);
  });
}

startServer();
