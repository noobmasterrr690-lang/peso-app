import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma.js';
import { createLedger, LedgerError } from '../src/lib/ledger.js';

describe('Ledger module', () => {
  const ledger = createLedger(prisma);
  let userId;
  let otherUserId;

  before(async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Ledger Test Student',
        email: `ledger-test-${Date.now()}@peso.test`,
        passwordHash: 'test-hash',
      },
    });
    userId = user.id;

    const other = await prisma.user.create({
      data: {
        name: 'Other Student',
        email: `ledger-other-${Date.now()}@peso.test`,
        passwordHash: 'test-hash',
      },
    });
    otherUserId = other.id;
  });

  beforeEach(async () => {
    await prisma.expense.deleteMany({ where: { userId } });
    await prisma.income.deleteMany({ where: { userId } });
    await prisma.savingsGoal.deleteMany({ where: { userId } });
    await prisma.balance.deleteMany({ where: { userId } });
  });

  after(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    if (otherUserId) await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('starts at 0 and sets manual Balance accurately', async () => {
    assert.deepEqual(await ledger.getBalance(userId), { currentAmount: 0 });

    const updated = await ledger.setBalance(userId, 1500.556);
    assert.equal(updated.currentAmount, 1500.56);
    assert.deepEqual(await ledger.getBalance(userId), { currentAmount: 1500.56 });

    await assert.rejects(
      () => ledger.setBalance(userId, -10),
      (err) => err instanceof LedgerError && err.status === 400
    );
  });

  it('records, revises, removes, and resets Expenses while conserving Balance', async () => {
    await ledger.setBalance(userId, 500);

    const { expense, currentBalance: afterCreate } = await ledger.recordExpense(userId, {
      amount: 120.5,
      category: 'Food',
      date: '2026-10-27',
      note: 'Campus lunch',
    });
    assert.equal(afterCreate, 379.5);

    // Revise amount upward (+29.5 -> balance drops by 29.5)
    const { currentBalance: afterRevise } = await ledger.reviseExpense(userId, expense.id, {
      amount: 150,
      note: 'Lunch + drink',
    });
    assert.equal(afterRevise, 350);

    // Revise note only (diff === 0 -> balance stays 350)
    const { expense: noteOnly, currentBalance: afterNoteRevise } = await ledger.reviseExpense(userId, expense.id, {
      note: 'Updated note',
    });
    assert.equal(noteOnly.note, 'Updated note');
    assert.equal(afterNoteRevise, 350);

    // Reject negative revision
    await assert.rejects(
      () => ledger.reviseExpense(userId, expense.id, { amount: -50 }),
      (err) => err instanceof LedgerError && err.status === 400
    );

    // Reject cross-user access
    await assert.rejects(
      () => ledger.removeExpense(otherUserId, expense.id),
      (err) => err instanceof LedgerError && err.status === 404
    );

    // Remove expense refunds full revised amount
    const { currentBalance: afterRemove, refundedAmount } = await ledger.removeExpense(userId, expense.id);
    assert.equal(refundedAmount, 150);
    assert.equal(afterRemove, 500);

    // Reset multiple expenses refunds sum
    await ledger.recordExpense(userId, { amount: 40, category: 'Transport', date: '2026-10-27' });
    await ledger.recordExpense(userId, { amount: 60, category: 'Study', date: '2026-10-27' });
    assert.equal((await ledger.getBalance(userId)).currentAmount, 400);

    const resetRes = await ledger.resetExpenses(userId);
    assert.equal(resetRes.deletedCount, 2);
    assert.equal(resetRes.refundedAmount, 100);
    assert.equal(resetRes.currentBalance, 500);
  });

  it('receives and removes Income while keeping Balance in sync', async () => {
    await ledger.setBalance(userId, 200);

    const { income, currentBalance: afterReceive } = await ledger.receiveIncome(userId, {
      amount: 1000,
      source: 'Allowance',
      date: '2026-10-27',
      note: 'Weekly allowance',
    });
    assert.equal(afterReceive, 1200);

    const { currentBalance: afterRemove, deductedAmount } = await ledger.removeIncome(userId, income.id);
    assert.equal(deductedAmount, 1000);
    assert.equal(afterRemove, 200);
  });

  it('conserves money across Savings Goal creation, deposit, withdraw, and deletion', async () => {
    await ledger.setBalance(userId, 1000);

    // Goal always starts at 0 even if caller passes currentAmount
    const goal = await ledger.createGoal(userId, {
      name: 'New Laptop',
      targetAmount: 5000,
      currentAmount: 9999,
    });
    assert.equal(goal.currentAmount, 0);

    // Metadata update cannot forge currentAmount
    const updatedMeta = await ledger.updateGoal(userId, goal.id, {
      name: 'Gaming Laptop',
      currentAmount: 9999,
    });
    assert.equal(updatedMeta.name, 'Gaming Laptop');
    assert.equal(updatedMeta.currentAmount, 0);

    // Cannot deposit more than available Balance
    await assert.rejects(
      () => ledger.depositToGoal(userId, goal.id, 1500),
      (err) => err instanceof LedgerError && err.status === 400
    );

    // Deposit 400 -> Balance 600, Goal 400
    const dep = await ledger.depositToGoal(userId, goal.id, 400);
    assert.equal(dep.currentBalance, 600);
    assert.equal(dep.goal.currentAmount, 400);

    // Cannot withdraw more than goal.currentAmount
    await assert.rejects(
      () => ledger.withdrawFromGoal(userId, goal.id, 500),
      (err) => err instanceof LedgerError && err.status === 400
    );

    // Withdraw 150 -> Balance 750, Goal 250
    const wd = await ledger.withdrawFromGoal(userId, goal.id, 150);
    assert.equal(wd.currentBalance, 750);
    assert.equal(wd.goal.currentAmount, 250);

    // Closing goal with 250 remaining refunds 250 back to Balance -> 1000
    const closed = await ledger.closeGoal(userId, goal.id);
    assert.equal(closed.refundedAmount, 250);
    assert.equal(closed.currentBalance, 1000);
    assert.equal((await ledger.getBalance(userId)).currentAmount, 1000);
  });
});
