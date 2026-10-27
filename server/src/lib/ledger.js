import { prisma } from './prisma.js';

export class LedgerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'LedgerError';
    this.status = status;
  }
}

export function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

function parsePositiveAmount(value, errorMessage) {
  const num = Number(value);
  if (!value || Number.isNaN(num) || num <= 0) {
    throw new LedgerError(errorMessage, 400);
  }
  return roundMoney(num);
}

function parseDateOrNow(dateInput) {
  const parsed = new Date(dateInput);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function createLedger(client = prisma) {
  async function readBalanceRow(userId, db = client) {
    return db.balance.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async function readBalanceAmount(userId, db = client) {
    const row = await readBalanceRow(userId, db);
    return row ? roundMoney(row.currentAmount) : 0;
  }

  async function applyBalanceDelta(userId, delta, db = client) {
    const latest = await readBalanceRow(userId, db);
    if (!latest) {
      return db.balance.create({
        data: { userId, currentAmount: roundMoney(delta) },
      });
    }
    const updatedAmount = roundMoney(Number(latest.currentAmount) + Number(delta));
    return db.balance.update({
      where: { id: latest.id },
      data: { currentAmount: updatedAmount },
    });
  }

  return {
    getBalanceRow(userId) {
      return readBalanceRow(userId, client);
    },

    async getBalance(userId) {
      const currentAmount = await readBalanceAmount(userId, client);
      return { currentAmount };
    },

    async setBalance(userId, currentAmount) {
      if (currentAmount === undefined || currentAmount === null || currentAmount === '' || Number.isNaN(Number(currentAmount)) || Number(currentAmount) < 0) {
        throw new LedgerError('A valid non-negative balance amount is required.', 400);
      }
      const nextAmount = roundMoney(currentAmount);

      return client.$transaction(async (tx) => {
        const latest = await readBalanceRow(userId, tx);
        const row = latest
          ? await tx.balance.update({
              where: { id: latest.id },
              data: { currentAmount: nextAmount },
            })
          : await tx.balance.create({
              data: { userId, currentAmount: nextAmount },
            });
        return { currentAmount: roundMoney(row.currentAmount) };
      });
    },

    async recordExpense(userId, { amount, category, date, note } = {}) {
      if (amount === undefined || !category || !String(category).trim() || !date) {
        throw new LedgerError('Amount, category, and date are required.', 400);
      }
      const numAmount = parsePositiveAmount(amount, 'A valid positive expense amount is required.');
      const validDate = parseDateOrNow(date);

      return client.$transaction(async (tx) => {
        const expense = await tx.expense.create({
          data: {
            userId,
            amount: numAmount,
            category: String(category).trim(),
            date: validDate,
            note: note ? String(note).trim() : '',
          },
        });
        const updatedBalance = await applyBalanceDelta(userId, -numAmount, tx);
        return {
          expense,
          currentBalance: roundMoney(updatedBalance.currentAmount),
        };
      });
    },

    async reviseExpense(userId, expenseId, { amount, category, date, note } = {}) {
      return client.$transaction(async (tx) => {
        const existing = await tx.expense.findFirst({ where: { id: expenseId, userId } });
        if (!existing) {
          throw new LedgerError('Expense not found.', 404);
        }

        const newAmount =
          amount !== undefined
            ? parsePositiveAmount(amount, 'A valid positive expense amount is required.')
            : roundMoney(existing.amount);
        const diff = roundMoney(newAmount - Number(existing.amount));

        const expense = await tx.expense.update({
          where: { id: existing.id },
          data: {
            amount: newAmount,
            category: category === undefined ? existing.category : String(category).trim(),
            date: date === undefined ? existing.date : parseDateOrNow(date),
            note: note === undefined ? existing.note : String(note).trim(),
          },
        });

        let currentBalance;
        if (diff !== 0) {
          const updatedBalance = await applyBalanceDelta(userId, -diff, tx);
          currentBalance = roundMoney(updatedBalance.currentAmount);
        } else {
          currentBalance = await readBalanceAmount(userId, tx);
        }

        return { expense, currentBalance };
      });
    },

    async removeExpense(userId, expenseId) {
      return client.$transaction(async (tx) => {
        const existing = await tx.expense.findFirst({ where: { id: expenseId, userId } });
        if (!existing) {
          throw new LedgerError('Expense not found.', 404);
        }
        const refund = roundMoney(existing.amount);
        await tx.expense.delete({ where: { id: existing.id } });
        const updatedBalance = await applyBalanceDelta(userId, refund, tx);
        return {
          currentBalance: roundMoney(updatedBalance.currentAmount),
          refundedAmount: refund,
        };
      });
    },

    async resetExpenses(userId) {
      return client.$transaction(async (tx) => {
        const expenses = await tx.expense.findMany({ where: { userId } });
        const totalRefund = roundMoney(expenses.reduce((sum, e) => sum + Number(e.amount), 0));
        const delResult = await tx.expense.deleteMany({ where: { userId } });

        let currentBalance;
        if (totalRefund > 0) {
          const updatedBalance = await applyBalanceDelta(userId, totalRefund, tx);
          currentBalance = roundMoney(updatedBalance.currentAmount);
        } else {
          currentBalance = await readBalanceAmount(userId, tx);
        }

        return {
          deletedCount: delResult.count,
          refundedAmount: totalRefund,
          currentBalance,
        };
      });
    },

    async receiveIncome(userId, { amount, source, date, note } = {}) {
      if (amount === undefined || !source || !String(source).trim() || !date) {
        throw new LedgerError('Amount, source, and date are required.', 400);
      }
      const numAmount = parsePositiveAmount(amount, 'A positive income amount is required.');
      const validDate = parseDateOrNow(date);

      return client.$transaction(async (tx) => {
        const income = await tx.income.create({
          data: {
            userId,
            amount: numAmount,
            source: String(source).trim(),
            date: validDate,
            note: note ? String(note).trim() : '',
          },
        });
        const updatedBalance = await applyBalanceDelta(userId, numAmount, tx);
        return {
          income,
          currentBalance: roundMoney(updatedBalance.currentAmount),
        };
      });
    },

    async removeIncome(userId, incomeId) {
      return client.$transaction(async (tx) => {
        const existing = await tx.income.findFirst({ where: { id: incomeId, userId } });
        if (!existing) {
          throw new LedgerError('Income entry not found.', 404);
        }
        const deductedAmount = roundMoney(existing.amount);
        await tx.income.delete({ where: { id: existing.id } });
        const updatedBalance = await applyBalanceDelta(userId, -deductedAmount, tx);
        return {
          currentBalance: roundMoney(updatedBalance.currentAmount),
          deductedAmount,
        };
      });
    },

    async createGoal(userId, { name, targetAmount, targetDate } = {}) {
      if (!name || !String(name).trim() || targetAmount === undefined) {
        throw new LedgerError('Goal name and target amount are required.', 400);
      }
      const numTarget = parsePositiveAmount(targetAmount, 'A valid positive target amount is required.');

      return client.savingsGoal.create({
        data: {
          userId,
          name: String(name).trim(),
          targetAmount: numTarget,
          currentAmount: 0,
          targetDate: targetDate ? parseDateOrNow(targetDate) : null,
        },
      });
    },

    async updateGoal(userId, goalId, { name, targetAmount, targetDate } = {}) {
      const existing = await client.savingsGoal.findFirst({ where: { id: goalId, userId } });
      if (!existing) {
        throw new LedgerError('Savings goal not found.', 404);
      }
      const nextTarget =
        targetAmount === undefined
          ? existing.targetAmount
          : parsePositiveAmount(targetAmount, 'A valid positive target amount is required.');

      return client.savingsGoal.update({
        where: { id: existing.id },
        data: {
          name: name === undefined ? existing.name : String(name).trim(),
          targetAmount: nextTarget,
          targetDate: targetDate === undefined ? existing.targetDate : targetDate ? parseDateOrNow(targetDate) : null,
        },
      });
    },

    async depositToGoal(userId, goalId, amount) {
      const numAmount = parsePositiveAmount(amount, 'A valid positive deposit amount is required.');

      return client.$transaction(async (tx) => {
        const goal = await tx.savingsGoal.findFirst({ where: { id: goalId, userId } });
        if (!goal) {
          throw new LedgerError('Savings goal not found.', 404);
        }

        const availableBalance = await readBalanceAmount(userId, tx);
        if (numAmount > availableBalance) {
          throw new LedgerError('Deposit amount exceeds your available balance.', 400);
        }

        const updatedGoal = await tx.savingsGoal.update({
          where: { id: goal.id },
          data: { currentAmount: roundMoney(Number(goal.currentAmount) + numAmount) },
        });
        const updatedBalance = await applyBalanceDelta(userId, -numAmount, tx);

        return {
          goal: updatedGoal,
          currentBalance: roundMoney(updatedBalance.currentAmount),
          depositedAmount: numAmount,
        };
      });
    },

    async withdrawFromGoal(userId, goalId, amount) {
      const numAmount = parsePositiveAmount(amount, 'A valid positive withdrawal amount is required.');

      return client.$transaction(async (tx) => {
        const goal = await tx.savingsGoal.findFirst({ where: { id: goalId, userId } });
        if (!goal) {
          throw new LedgerError('Savings goal not found.', 404);
        }

        if (roundMoney(goal.currentAmount) < numAmount) {
          throw new LedgerError('Withdrawal amount exceeds current goal savings.', 400);
        }

        const updatedGoal = await tx.savingsGoal.update({
          where: { id: goal.id },
          data: { currentAmount: roundMoney(Number(goal.currentAmount) - numAmount) },
        });
        const updatedBalance = await applyBalanceDelta(userId, numAmount, tx);

        return {
          goal: updatedGoal,
          currentBalance: roundMoney(updatedBalance.currentAmount),
          withdrawnAmount: numAmount,
        };
      });
    },

    async closeGoal(userId, goalId) {
      return client.$transaction(async (tx) => {
        const existing = await tx.savingsGoal.findFirst({ where: { id: goalId, userId } });
        if (!existing) {
          throw new LedgerError('Savings goal not found.', 404);
        }
        const refundedAmount = roundMoney(existing.currentAmount);
        await tx.savingsGoal.delete({ where: { id: existing.id } });

        let currentBalance;
        if (refundedAmount > 0) {
          const updatedBalance = await applyBalanceDelta(userId, refundedAmount, tx);
          currentBalance = roundMoney(updatedBalance.currentAmount);
        } else {
          currentBalance = await readBalanceAmount(userId, tx);
        }

        return {
          refundedAmount,
          currentBalance,
        };
      });
    },
  };
}

const ledger = createLedger(prisma);
export default ledger;
