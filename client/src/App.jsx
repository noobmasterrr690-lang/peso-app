import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  AmountInput,
  AmbientShapes,
  AnimatedCurrency,
  CATEGORIES,
  CATEGORY_IDS,
  ChoiceChips,
  EmptyState,
  Field,
  INCOME_SOURCES,
  Modal,
  PixelCompanion,
  ProgressBar,
  DEFAULT_QUICK_PRESETS,
  QUICK_EXPENSE_PRESETS,
  QUICK_SPEND_CLASSIFICATIONS,
  classificationIcon,
  ToastArea,
  apiRequest,
  categoryIcon,
  currentMonthKey,
  daysLeftInMonth,
  entryDateKey,
  formatCurrency,
  formatMonthName,
  formatShortDate,
  getGreeting,
  localDateKey,
  monthKeyOffset,
  sourceIcon,
} from './ui.jsx';
import {
  AuthScreen,
  FinancialAlerts,
  GettingStarted,
  HelpGuide,
  MonthlyTrendChart,
  PageIntro,
  TransactionGroups,
  VIEWS,
  WeeklySpendingReview,
} from './components.jsx';

const emptyExpense = () => ({ amount: '', category: 'Food', date: localDateKey(), note: '' });
const emptyIncome = () => ({ amount: '', source: 'Allowance', date: localDateKey(), note: '' });
const emptyGoal = () => ({ name: '', targetAmount: '', currentAmount: '', targetDate: '' });
const blankLimits = () => Object.fromEntries(CATEGORY_IDS.map((id) => [id, '']));

function StatCard({ title, value, hint, tone = 'blue', onClick, actionLabel, children }) {
  return (
    <div
      className={`stat-card tone-${tone} ${onClick ? 'is-interactive' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
    >
      <div className="stat-card-top">
        <div className="label">{title}</div>
        {actionLabel && <span className="stat-card-arrow" aria-hidden="true">{actionLabel}</span>}
      </div>
      <div className="value">{value}</div>
      <div className="hint">{hint}</div>
      {children}
    </div>
  );
}

export default function App() {
  /* ---------------- session & theme ---------------- */
  const [token, setToken] = useState(() => localStorage.getItem('peso-token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('peso-user') || 'null');
    } catch {
      return null;
    }
  });
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('peso-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  /* ---------------- data ---------------- */
  const [view, setView] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [goals, setGoals] = useState([]);
  const [reports, setReports] = useState(null);

  /* ---------------- 1-tap quick spend presets ---------------- */
  const [quickPresets, setQuickPresets] = useState(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('peso-user') || 'null');
      const key = savedUser?.id ? `peso-quick-presets-${savedUser.id}` : 'peso-quick-presets-guest';
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_QUICK_PRESETS;
  });
  const [quickFilter, setQuickFilter] = useState('All');
  const [isManagingQuick, setIsManagingQuick] = useState(false);
  const [isAddingQuick, setIsAddingQuick] = useState(false);
  const [newQuickForm, setNewQuickForm] = useState({
    label: '',
    amount: '',
    classification: 'Fare',
    note: '',
  });

  useEffect(() => {
    if (!user?.id) return;
    try {
      const key = `peso-quick-presets-${user.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuickPresets(parsed);
          return;
        }
      }
      const guestSaved = localStorage.getItem('peso-quick-presets-guest');
      if (guestSaved) {
        setQuickPresets(JSON.parse(guestSaved));
        localStorage.setItem(key, guestSaved);
      }
    } catch {}
  }, [user?.id]);

  const updateQuickPresets = useCallback((updater) => {
    setQuickPresets((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        const key = user?.id ? `peso-quick-presets-${user.id}` : 'peso-quick-presets-guest';
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [user?.id]);

  function handleAddQuickSubmit(e) {
    e.preventDefault();
    const numAmount = Number(newQuickForm.amount);
    if (!newQuickForm.label.trim()) {
      notify('Please enter a name for the 1-tap shortcut.', { tone: 'error' });
      return;
    }
    if (!numAmount || numAmount <= 0 || Number.isNaN(numAmount)) {
      notify('Please enter an amount greater than ₱0.', { tone: 'error' });
      return;
    }

    const classMeta = QUICK_SPEND_CLASSIFICATIONS.find((c) => c.id === newQuickForm.classification) || QUICK_SPEND_CLASSIFICATIONS[0];
    const newPreset = {
      id: `qp-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: newQuickForm.label.trim(),
      amount: numAmount,
      classification: classMeta.id,
      category: classMeta.defaultCategory,
      note: newQuickForm.note.trim() || newQuickForm.label.trim(),
    };

    updateQuickPresets((cur) => [...cur, newPreset]);
    notify(`Added "${newPreset.label}" (₱${newPreset.amount}) under ${classMeta.label}!`, { tone: 'success' });
    setIsAddingQuick(false);
    setNewQuickForm({ label: '', amount: '', classification: 'Fare', note: '' });
  }

  function handleDeleteQuickPreset(preset) {
    const previous = quickPresets;
    updateQuickPresets((cur) => cur.filter((p) => p.id !== preset.id && p.label !== preset.label));
    notify(`Deleted 1-tap shortcut "${preset.label}".`, {
      tone: 'info',
      action: {
        label: 'Undo',
        onClick: () => updateQuickPresets(previous),
      },
    });
  }

  function handleResetQuickPresets() {
    updateQuickPresets(DEFAULT_QUICK_PRESETS);
    notify('Reset 1-tap shortcuts back to defaults.', { tone: 'info' });
    setIsManagingQuick(false);
  }

  const displayedQuickPresets = useMemo(() => {
    if (quickFilter === 'All') return quickPresets;
    return quickPresets.filter((p) => (p.classification || 'Others') === quickFilter);
  }, [quickPresets, quickFilter]);

  /* ---------------- forms ---------------- */
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [incomeForm, setIncomeForm] = useState(emptyIncome);
  const [goalForm, setGoalForm] = useState(emptyGoal);
  const [budgetForm, setBudgetForm] = useState({ totalLimit: '', categoryLimits: blankLimits() });
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceForm, setBalanceForm] = useState('');
  const [busy, setBusy] = useState('');

  /* ---------------- filters ---------------- */
  const [expenseSearch, setExpenseSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expenseSort, setExpenseSort] = useState('newest');
  const [expensePeriod, setExpensePeriod] = useState('all');

  /* ---------------- modals & feedback ---------------- */
  const [toasts, setToasts] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState('');
  const [editExpense, setEditExpense] = useState(null);
  const [isResettingExpenses, setIsResettingExpenses] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [checklistHidden, setChecklistHidden] = useState(false);
  const [companionExcited, setCompanionExcited] = useState(false);
  const [companionSpeech, setCompanionSpeech] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('peso-theme', theme);
  }, [theme]);

  useEffect(() => {
    const meta = VIEWS.find((v) => v.id === view);
    document.title = token ? `${meta?.title || 'Home'} | PESO` : 'Sign in | PESO';
  }, [view, token]);

  useEffect(() => {
    if (user?.id) setChecklistHidden(localStorage.getItem(`peso-checklist-hidden-${user.id}`) === '1');
  }, [user?.id]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const dismissToast = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const notify = useCallback((text, { tone = 'success', action } = {}) => {
    if (!text) return;
    setToasts((list) => {
      if (list.some((t) => t.text === text)) return list;
      const id = `${Date.now()}-${Math.random()}`;
      setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), action ? 8000 : 5000);
      return [...list.slice(-2), { id, text, tone, action }];
    });
  }, []);
  /* ---------------- loading & auth ---------------- */
  const logout = useCallback((reason) => {
    localStorage.removeItem('peso-token');
    localStorage.removeItem('peso-user');
    setToken('');
    setUser(null);
    setDashboard(null);
    setReports(null);
    setGoals([]);
    setView('dashboard');
    setToasts([]);
    if (reason) {
      notify(reason, { tone: 'info' });
    }
  }, [notify]);

  const fail = useCallback((error) => {
    const msg = error?.message || '';
    if (/token|Authentication|Session|user not found|user no longer exists/i.test(msg)) {
      logout();
      return;
    }
    notify(msg || 'Something went wrong. Please try again.', { tone: 'error' });
  }, [notify, logout]);

  const loadDashboard = useCallback(async () => {
    try {
      setDashboard(await apiRequest('/dashboard', { token }));
    } catch (error) {
      if (/token|Authentication/i.test(error.message)) {
        logout();
        return;
      }
      fail(error);
    }
  }, [token, logout, fail]);

  const loadBudget = useCallback(async () => {
    try {
      const data = await apiRequest('/budget', { token });
      const limits = blankLimits();
      Object.entries(data.categoryLimits || {}).forEach(([k, v]) => {
        limits[k] = Number(v) > 0 ? String(v) : '';
      });
      setBudgetForm({ totalLimit: Number(data.totalLimit) > 0 ? String(data.totalLimit) : '', categoryLimits: limits });
    } catch (error) {
      fail(error);
    }
  }, [token, fail]);

  const loadGoals = useCallback(async () => {
    try {
      setGoals((await apiRequest('/savings-goals', { token })) || []);
    } catch (error) {
      fail(error);
    }
  }, [token, fail]);

  const loadReports = useCallback(async () => {
    try {
      setReports(await apiRequest('/reports', { token }));
    } catch (error) {
      fail(error);
    }
  }, [token, fail]);

  const refresh = useCallback(() => Promise.all([loadDashboard(), loadReports(), loadGoals()]), [loadDashboard, loadReports, loadGoals]);

  useEffect(() => {
    if (!token) return;
    localStorage.setItem('peso-token', token);
    refresh();
    loadBudget();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAuthenticated(response, isNewAccount) {
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('peso-user', JSON.stringify(response.user));
    notify(isNewAccount ? `Welcome to PESO, ${response.user.name}!` : `Welcome back, ${response.user.name}!`);
    if (isNewAccount || !localStorage.getItem('peso-guide-seen')) setGuideOpen(true);
  }

  function closeGuide() {
    localStorage.setItem('peso-guide-seen', '1');
    setGuideOpen(false);
  }

  function go(nextView) {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- derived data ---------------- */
  const expenses = dashboard?.expenses || [];
  const incomes = dashboard?.incomes || [];
  const balance = Number(dashboard?.balance || 0);
  const budget = dashboard?.budget;
  const hasBudget = Boolean(budget && budget.totalLimit > 0);
  const daysLeft = daysLeftInMonth();
  const safeDailySpend = hasBudget && budget.remaining > 0 ? Math.min(budget.remaining, Math.max(balance, 0)) / daysLeft : 0;
  const todayKey = localDateKey();

  const monthExpenses = useMemo(() => expenses.filter((e) => entryDateKey(e.date).slice(0, 7) === currentMonthKey()), [expenses]);
  const monthSpent = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const monthIncome = incomes.filter((i) => entryDateKey(i.date).slice(0, 7) === currentMonthKey()).reduce((s, i) => s + Number(i.amount), 0);
  const spentToday = expenses.filter((e) => entryDateKey(e.date) === todayKey).reduce((s, e) => s + Number(e.amount), 0);
  const savingsTotal = goals.reduce((s, g) => s + Number(g.currentAmount || 0), 0);

  const monthCategoryTotals = useMemo(() => {
    const totals = {};
    monthExpenses.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + Number(e.amount);
    });
    return totals;
  }, [monthExpenses]);

  const recentActivity = useMemo(() => {
    return [
      ...expenses.map((e) => ({ ...e, kind: 'expense' })),
      ...incomes.map((i) => ({ ...i, kind: 'income' })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6);
  }, [expenses, incomes]);

  const filteredExpenses = useMemo(() => {
    let result = [...expenses];
    if (expensePeriod !== 'all') {
      const thisMonth = currentMonthKey();
      const lastMonth = monthKeyOffset(-1);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const weekStartKey = localDateKey(weekStart);
      result = result.filter((e) => {
        const key = entryDateKey(e.date);
        if (expensePeriod === 'week') return key >= weekStartKey;
        if (expensePeriod === 'month') return key.slice(0, 7) === thisMonth;
        if (expensePeriod === 'last-month') return key.slice(0, 7) === lastMonth;
        return true;
      });
    }
    if (selectedCategory !== 'All') result = result.filter((e) => e.category === selectedCategory);
    if (expenseSearch.trim()) {
      const q = expenseSearch.toLowerCase();
      result = result.filter((e) => (e.note || '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
    }
    const sorters = {
      oldest: (a, b) => new Date(a.date) - new Date(b.date),
      highest: (a, b) => Number(b.amount) - Number(a.amount),
      lowest: (a, b) => Number(a.amount) - Number(b.amount),
      newest: (a, b) => new Date(b.date) - new Date(a.date),
    };
    return result.sort(sorters[expenseSort] || sorters.newest);
  }, [expenses, selectedCategory, expenseSearch, expenseSort, expensePeriod]);
  const filteredTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const filtersActive = expensePeriod !== 'all' || selectedCategory !== 'All' || expenseSearch.trim();

  /* ---------------- actions ---------------- */
  function startBalanceEdit() {
    setBalanceForm(String(balance || ''));
    setIsEditingBalance(true);
  }

  async function handleBalanceSubmit(event) {
    event.preventDefault();
    setBusy('balance');
    try {
      await apiRequest('/balance', { method: 'PUT', body: { currentAmount: Number(balanceForm || 0) }, token });
      await loadDashboard();
      setIsEditingBalance(false);
      notify(`Balance set to ${formatCurrency(balanceForm)}.`);
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  async function undoExpense(id) {
    try {
      await apiRequest(`/expenses/${id}`, { method: 'DELETE', token });
      await refresh();
      notify('Undone. The expense was removed and your balance restored.', { tone: 'info' });
    } catch (error) {
      fail(error);
    }
  }

  async function addExpense(body, label) {
    const response = await apiRequest('/expenses', { method: 'POST', body, token });
    await refresh();
    notify(`${label} saved. Balance is now ${formatCurrency(response.currentBalance)}.`, {
      action: { label: 'Undo', onClick: () => undoExpense(response.expense.id) },
    });
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();
    if (Number(expenseForm.amount) <= 0) {
      notify('Please enter an amount greater than zero.', { tone: 'error' });
      return;
    }
    setBusy('expense');
    try {
      await addExpense({ ...expenseForm, amount: Number(expenseForm.amount) }, `${formatCurrency(expenseForm.amount)} ${expenseForm.category} expense`);
      setExpenseForm((f) => ({ ...emptyExpense(), category: f.category, date: f.date }));
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  async function handleQuickAdd(preset) {
    const pKey = preset.id || preset.label;
    setBusy(`preset-${pKey}`);
    setCompanionExcited(true);
    setTimeout(() => setCompanionExcited(false), 750);
    try {
      await addExpense(
        {
          amount: preset.amount,
          category: preset.category || 'Other',
          date: localDateKey(),
          note: preset.note || preset.label,
        },
        `${preset.label} (${formatCurrency(preset.amount)})`
      );
      setCompanionSpeech(`Logged ${preset.label} (₱${preset.amount})! Keep it up! 🪙`);
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  async function handleEditExpenseSubmit(event) {
    event.preventDefault();
    if (Number(editExpense.amount) <= 0) {
      notify('Please enter an amount greater than zero.', { tone: 'error' });
      return;
    }
    setBusy('edit');
    try {
      await apiRequest(`/expenses/${editExpense.id}`, {
        method: 'PUT',
        body: { ...editExpense, amount: Number(editExpense.amount) },
        token,
      });
      await refresh();
      setEditExpense(null);
      notify('Expense updated. Your balance was adjusted to match.');
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  async function handleIncomeSubmit(event) {
    event.preventDefault();
    if (Number(incomeForm.amount) <= 0) {
      notify('Please enter an amount greater than zero.', { tone: 'error' });
      return;
    }
    setBusy('income');
    try {
      const response = await apiRequest('/incomes', { method: 'POST', body: { ...incomeForm, amount: Number(incomeForm.amount) }, token });
      setIncomeForm(emptyIncome());
      await refresh();
      notify(`${formatCurrency(incomeForm.amount)} income saved. Balance is now ${formatCurrency(response.currentBalance)}.`);
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  const categorySum = CATEGORY_IDS.reduce((s, id) => s + Number(budgetForm.categoryLimits[id] || 0), 0);

  async function handleBudgetSubmit(event) {
    event.preventDefault();
    const total = Number(budgetForm.totalLimit || 0) || categorySum;
    if (total <= 0) {
      notify('Enter a monthly limit, or set limits for a few categories.', { tone: 'error' });
      return;
    }
    setBusy('budget');
    try {
      await apiRequest('/budget', {
        method: 'PUT',
        body: {
          totalLimit: total,
          categoryLimits: Object.fromEntries(CATEGORY_IDS.map((id) => [id, Number(budgetForm.categoryLimits[id] || 0)])),
        },
        token,
      });
      await Promise.all([loadBudget(), loadDashboard()]);
      notify(`Budget saved: ${formatCurrency(total)} for the month (about ${formatCurrency(total / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())} per day).`);
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  function suggestBudget() {
    const previousMonths = [-1, -2, -3].map(monthKeyOffset);
    const suggestion = blankLimits();
    let anyData = false;
    CATEGORY_IDS.forEach((cat) => {
      const totals = previousMonths.map((m) =>
        expenses.filter((e) => e.category === cat && entryDateKey(e.date).slice(0, 7) === m).reduce((s, e) => s + Number(e.amount), 0),
      );
      const activeMonths = totals.filter((t) => t > 0);
      let estimate = activeMonths.length ? activeMonths.reduce((a, b) => a + b, 0) / activeMonths.length : 0;
      if (!estimate && monthCategoryTotals[cat]) {
        const dayOfMonth = new Date().getDate();
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        estimate = (monthCategoryTotals[cat] / dayOfMonth) * daysInMonth;
      }
      if (estimate > 0) {
        anyData = true;
        suggestion[cat] = String(Math.ceil(estimate / 10) * 10);
      }
    });
    if (!anyData) {
      notify('Not enough spending history yet. Log your expenses for a couple of weeks, then try again.', { tone: 'info' });
      return;
    }
    const total = CATEGORY_IDS.reduce((s, id) => s + Number(suggestion[id] || 0), 0);
    setBudgetForm({ totalLimit: String(total), categoryLimits: suggestion });
    notify('Filled in limits based on your usual spending. Adjust them, then press “Save budget”.', { tone: 'info' });
  }

  async function handleGoalSubmit(event) {
    event.preventDefault();
    if (Number(goalForm.targetAmount) <= 0) {
      notify('Please enter a target amount greater than zero.', { tone: 'error' });
      return;
    }
    setBusy('goal');
    try {
      await apiRequest('/savings-goals', {
        method: 'POST',
        body: {
          name: goalForm.name,
          targetAmount: Number(goalForm.targetAmount),
          currentAmount: Number(goalForm.currentAmount || 0),
          targetDate: goalForm.targetDate || null,
        },
        token,
      });
      setGoalForm(emptyGoal());
      await refresh();
      notify(`Goal “${goalForm.name}” created. Use “Add money” whenever you set cash aside.`);
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  async function handleTransferSubmit(event) {
    event.preventDefault();
    const amount = Number(transferAmount);
    const { goal, type } = transferModal;
    setTransferError('');
    if (amount <= 0) {
      setTransferError('Enter an amount greater than zero.');
      return;
    }
    if (type === 'deposit' && amount > balance) {
      setTransferError(`You only have ${formatCurrency(balance)} in your balance.`);
      return;
    }
    if (type === 'withdraw' && amount > Number(goal.currentAmount)) {
      setTransferError(`This goal only has ${formatCurrency(goal.currentAmount)} saved.`);
      return;
    }
    setBusy('transfer');
    try {
      await apiRequest(`/savings-goals/${goal.id}/${type}`, { method: 'POST', body: { amount }, token });
      await refresh();
      setTransferModal(null);
      setTransferAmount('');
      const reached = type === 'deposit' && Number(goal.currentAmount) + amount >= Number(goal.targetAmount);
      notify(
        type === 'deposit'
          ? reached
            ? `🎉 You reached your “${goal.name}” goal!`
            : `${formatCurrency(amount)} moved into “${goal.name}”.`
          : `${formatCurrency(amount)} moved back to your balance.`,
      );
    } catch (error) {
      setTransferError(error.message);
    } finally {
      setBusy('');
    }
  }

  async function handleConfirmDelete() {
    const { type, id } = deleteConfirm;
    const path = { expense: `/expenses/${id}`, income: `/incomes/${id}`, goal: `/savings-goals/${id}` }[type];
    setBusy('delete');
    try {
      await apiRequest(path, { method: 'DELETE', token });
      await refresh();
      setDeleteConfirm(null);
      notify(
        {
          expense: 'Expense deleted. The amount was added back to your balance.',
          income: 'Income deleted. The amount was removed from your balance.',
          goal: 'Goal deleted.',
        }[type],
      );
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  async function handleResetExpenses(event) {
    event.preventDefault();
    if (resetPhrase !== 'RESET') return;
    setBusy('reset');
    try {
      const response = await apiRequest('/expenses', { method: 'DELETE', token });
      await refresh();
      setIsResettingExpenses(false);
      setResetPhrase('');
      notify(`${response.deletedCount} expense${response.deletedCount === 1 ? '' : 's'} cleared and ${formatCurrency(response.refundedAmount)} returned to your balance.`);
    } catch (error) {
      fail(error);
    } finally {
      setBusy('');
    }
  }

  function exportExpenses(list = expenses) {
    const rows = [
      ['Date', 'Category', 'Amount (PHP)', 'Note'],
      ...list.map((e) => [entryDateKey(e.date), e.category, Number(e.amount).toFixed(2), e.note || '']),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `peso-expenses-${localDateKey()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    notify(`Downloaded ${list.length} expense${list.length === 1 ? '' : 's'} as a spreadsheet (CSV).`, { tone: 'info' });
  }

  
  async function exportFullBackup() {
    try {
      const data = await apiRequest('/backup', { token });
      const jsonStr = JSON.stringify(data, null, 2);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json;charset=utf-8' }));
      link.download = `peso-data-backup-${localDateKey()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      notify('Downloaded complete financial backup (JSON).', { tone: 'success' });
    } catch {
      const backupData = {
        user: { name: user?.name, email: user?.email },
        exportedAt: new Date().toISOString(),
        balance: dashboard?.balance || 0,
        savingsGoals: goals || [],
        expenses: dashboard?.expenses || [],
        incomes: dashboard?.incomes || [],
        budget: dashboard?.budget || null,
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json;charset=utf-8' }));
      link.download = `peso-data-backup-${localDateKey()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      notify('Downloaded financial data backup (JSON).', { tone: 'info' });
    }
  }

  function handleCompanionTap() {
    const companionQuotes = [
      'Every peso counts! You’re doing great tracking your money.',
      'Small daily habits build huge financial peace of mind.',
      'Pleased to see you budgeting today! 🪙 Keep it up.',
      'Knowing where your money goes is your superpower!',
      'Staying within your daily limit keeps you worry-free.',
    ];
    const quote = companionQuotes[Math.floor(Math.random() * companionQuotes.length)];
    setCompanionExcited(true);
    setCompanionSpeech(quote);
    setTimeout(() => setCompanionExcited(false), 750);
    notify(`🪙 PESO Companion: “${quote}”`, { tone: 'info' });
  }

  function handleSurfaceSpot(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  }

  /* ---------------- helper text ---------------- */
  function categoryBudgetHint(category, amount) {
    const meta = CATEGORIES.find((c) => c.id === category);
    const limit = Number(budget?.categoryLimits?.[category] || 0);
    if (!limit) return `${meta?.hint || ''}.`;
    const spent = monthCategoryTotals[category] || 0;
    const after = spent + Number(amount || 0);
    if (after > limit) return `⚠️ This puts ${category} ${formatCurrency(after - limit)} over its ${formatCurrency(limit)} monthly limit.`;
    return `${formatCurrency(limit - after)} left for ${category} this month after this (limit ${formatCurrency(limit)}).`;
  }

  const insights = useMemo(() => {
    if (!reports) return [];
    if (!reports.expenses?.length) return [{ icon: '📝', text: 'Log a few expenses and PESO will show you patterns here.' }];
    const list = [];
    const totalSpent = reports.totals?.totalExpenses || 0;
    const totalIncome = reports.totals?.totalIncome || 0;
    const cats = Object.entries(reports.categoryTotals || {}).sort((a, b) => b[1] - a[1]);
    if (cats.length) {
      list.push({ icon: categoryIcon(cats[0][0]), text: `Most of your money goes to ${cats[0][0]}: ${formatCurrency(cats[0][1])}, which is ${((cats[0][1] / totalSpent) * 100).toFixed(0)}% of everything you’ve spent.` });
    }
    const stats = reports.monthlyStats || [];
    const cur = stats[stats.length - 1];
    const prev = stats[stats.length - 2];
    if (cur && prev && prev.total > 0) {
      list.push({
        icon: cur.total > prev.total ? '📈' : '📉',
        text: cur.total > prev.total
          ? `You’ve already spent ${formatCurrency(cur.total - prev.total)} more this month than in all of last month.`
          : `So far this month you’ve spent ${formatCurrency(cur.total)}, compared to ${formatCurrency(prev.total)} last month. ${daysLeft} day${daysLeft === 1 ? '' : 's'} to go.`,
      });
    }
    const active = stats.filter((s) => s.total > 0);
    if (active.length) {
      list.push({ icon: '🗓️', text: `On average you spend ${formatCurrency(active.reduce((s, m) => s + m.total, 0) / active.length)} per month.` });
    }
    const small = reports.expenses.filter((e) => Number(e.amount) <= 100);
    if (small.length >= 3) {
      list.push({ icon: '🪙', text: `Small purchases (₱100 or less) happened ${small.length} times and added up to ${formatCurrency(small.reduce((s, e) => s + Number(e.amount), 0))}. Small things add up!` });
    }
    const biggest = [...reports.expenses].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
    if (biggest) {
      list.push({ icon: '🔎', text: `Your biggest single expense was ${formatCurrency(biggest.amount)} on ${biggest.category}${biggest.note ? ` (${biggest.note})` : ''}, ${formatShortDate(biggest.date)}.` });
    }
    if (totalIncome > 0) {
      const kept = totalIncome - totalSpent;
      list.push(
        kept >= 0
          ? { icon: '💪', text: `You’ve kept ${((kept / totalIncome) * 100).toFixed(0)}% of the money you received (${formatCurrency(kept)}).` }
          : { icon: '⚠️', text: `You’ve spent ${formatCurrency(-kept)} more than the income you logged. If that’s not right, add your missing income.` },
      );
    }
    return list;
  }, [reports, daysLeft]);

  /* ---------------- render: signed out ---------------- */
  if (!token) {
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} notify={notify} theme={theme} toggleTheme={toggleTheme} />
        <ToastArea toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const checklistSteps = [
    { id: 'balance', done: balance !== 0 || incomes.length > 0, title: 'Enter how much money you have', text: 'Count your cash and e-wallet money right now.', cta: 'Enter balance', onClick: () => { go('dashboard'); startBalanceEdit(); } },
    { id: 'income', done: incomes.length > 0, title: 'Log your income', text: 'Allowance, salary, scholarship — whatever you receive.', cta: 'Add income', onClick: () => go('income') },
    { id: 'budget', done: hasBudget, title: 'Set a monthly budget', text: 'The most you want to spend this month.', cta: 'Set budget', onClick: () => go('budgets') },
    { id: 'expense', done: expenses.length > 0, title: 'Log your first expense', text: 'Even small ones like fare and snacks.', cta: 'Add expense', onClick: () => go('expenses') },
    { id: 'goal', done: goals.length > 0, title: 'Create a savings goal', text: 'Something you want to save up for.', cta: 'Add goal', onClick: () => go('goals') },
  ];
  const showChecklist = !checklistHidden && checklistSteps.some((s) => !s.done);

  const expenseAfter = balance - Number(expenseForm.amount || 0);
  const incomeAfter = balance + Number(incomeForm.amount || 0);

  /* ---------------- render: signed in ---------------- */
  return (
    <div className="app-shell">
      <a href="#content" className="skip-link">Skip to content</a>
      <AmbientShapes />
      <header className="topbar">
        <div className="topbar-brand">
          <div className="header-logo-wrap">
            <img className="header-logo" src="/peso-companion.svg?v=2" alt="PESO" />
            <span className="header-particle header-particle-one" aria-hidden="true">₱</span>
            <span className="header-particle header-particle-two" aria-hidden="true">₱</span>
            <span className="header-particle header-particle-three" aria-hidden="true">₱</span>
          </div>
          <div className="topbar-brand-text">
            <div className="eyebrow brand-definition">Personal Expense &amp; Spending Organizer</div>
            <p className="topbar-greeting">{getGreeting()}, {user?.name?.split(' ')[0] || 'there'} 👋</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="topbar-tools">
            <button
              type="button"
              className="theme-toggle-btn topbar-guide-btn"
              onClick={() => setGuideOpen(true)}
              title="How PESO works"
            >
              <span className="theme-toggle-icon" aria-hidden="true">❓</span>
              <span className="theme-toggle-label">Guide</span>
            </button>
            <button
              type="button"
              className="theme-toggle-btn topbar-theme-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span className="theme-toggle-icon" aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
          <div className="topbar-user">
            <div className="user-orb" title={user?.name || 'Account'} aria-hidden="true">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <button type="button" onClick={() => logout()} className="secondary-btn topbar-signout-btn">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="tab-bar" aria-label="Main">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'tab active' : 'tab'}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => go(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span> {item.label}
          </button>
        ))}
      </nav>

      <main id="content" tabIndex={-1}>
        {/* ============================ HOME ============================ */}
        {view === 'dashboard' && !dashboard && (
          <section className="panel loading-panel" aria-busy="true">
            <div className="skeleton" /><div className="skeleton short" />
            <p className="tiny-note">Loading your money summary…</p>
          </section>
        )}

        {view === 'dashboard' && dashboard && (
          <div className="dashboard-view">
            <section className="dashboard-hero spotlight-surface" onPointerMove={handleSurfaceSpot}>
              <div className="hero-copy">
                <div className="eyebrow lime">
                  <span className="live-pulse-dot" aria-hidden="true" /> {formatMonthName(currentMonthKey())} · at a glance
                </div>
                <h1>
                  You have<br />
                  <span className="hero-balance-amount">
                    <AnimatedCurrency value={balance} />
                  </span>
                </h1>
                <p>
                  {hasBudget
                    ? <>You’ve spent <strong>{formatCurrency(budget.spent)}</strong> of your <strong>{formatCurrency(budget.totalLimit)}</strong> budget this month{budget.remaining >= 0 ? <> — <strong>{formatCurrency(budget.remaining)}</strong> left.</> : <> — that’s <strong className="text-danger">{formatCurrency(-budget.remaining)} over</strong>.</>}</>
                    : 'Set a monthly budget and PESO will tell you how much you can safely spend each day.'}
                </p>
                {safeDailySpend > 0 && (
                  <div className="safe-spend-pill">
                    <div className="safe-spend-pill-top">
                      <span>✨ Safe daily spend: <strong><AnimatedCurrency value={safeDailySpend} /></strong> / day</span>
                      <small>{daysLeft} day{daysLeft === 1 ? '' : 's'} left this month</small>
                    </div>
                  </div>
                )}
                <div className="hero-actions">
                  <button type="button" className="primary-btn hero-cta" onClick={() => go('expenses')}>− I spent money</button>
                  <button type="button" className="secondary-btn hero-cta" onClick={() => go('income')}>+ I received money</button>
                  {!hasBudget && <button type="button" className="secondary-btn hero-cta" onClick={() => go('budgets')}>Set a budget</button>}
                </div>
              </div>
              <div className="hero-bottom-strip">
                <div
                  className="hero-companion-wrap"
                  role="button"
                  tabIndex={0}
                  onClick={handleCompanionTap}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleCompanionTap())}
                  title="PESO Companion: Click for a financial tip!"
                  aria-label="PESO Companion mascot. Click for financial encouragement."
                >
                  <PixelCompanion
                    mood={hasBudget && budget.remaining < 0 ? 'alert' : safeDailySpend > 0 && spentToday <= safeDailySpend ? 'cheering' : 'happy'}
                    excited={companionExcited}
                  />
                  <div className="hero-companion-caption">
                    {companionSpeech ? (
                      <span className="companion-speech-inline" key={companionSpeech}>{companionSpeech}</span>
                    ) : (
                      <span className="companion-tap-hint">🪙 Tap companion for a tip</span>
                    )}
                  </div>
                </div>
                <div className="hero-ticket">
                  <div className="hero-ticket-top">
                    <span>Spent today</span>
                    {safeDailySpend > 0 && (
                      <span className={`ticket-status-badge ${spentToday > safeDailySpend ? 'over' : spentToday > safeDailySpend * 0.8 ? 'warn' : 'ok'}`}>
                        {spentToday > safeDailySpend ? '⚠️ Over target' : spentToday > safeDailySpend * 0.8 ? '⚡ Near limit' : '✨ On track'}
                      </span>
                    )}
                  </div>
                  <strong className={safeDailySpend > 0 && spentToday > safeDailySpend ? 'text-danger' : ''}>
                    <AnimatedCurrency value={spentToday} />
                  </strong>
                  {safeDailySpend > 0 && (
                    <ProgressBar
                      value={spentToday}
                      max={safeDailySpend}
                      tone={spentToday > safeDailySpend ? 'over' : 'success'}
                      label="Today's spending against daily safe limit"
                    />
                  )}
                  <small>
                    {safeDailySpend > 0
                      ? spentToday > safeDailySpend
                        ? `${formatCurrency(spentToday - safeDailySpend)} over today’s target`
                        : `${formatCurrency(safeDailySpend - spentToday)} left for today`
                      : 'Log expenses to track your day'}
                  </small>
                </div>
              </div>
            </section>

            {/* Interactive 1-Tap Quick Spend Strip on Home */}
            <section className="home-quick-bar panel" aria-label="Quick 1-tap expense logging">
              <div className="home-quick-header">
                <div className="home-quick-info">
                  <span className="home-quick-badge">⚡ 1-Tap Quick Spend</span>
                  <span className="tiny-note">
                    {isManagingQuick
                      ? 'Tap ✕ to remove any shortcut, or reset to defaults below:'
                      : 'Log common expenses for today in one tap (with instant Undo):'}
                  </span>
                </div>
                <div className="home-quick-actions">
                  <button
                    type="button"
                    className={`small-btn ${isManagingQuick ? 'active-manage-btn' : ''}`}
                    onClick={() => setIsManagingQuick((v) => !v)}
                    title={isManagingQuick ? 'Done managing shortcuts' : 'Manage and delete shortcuts'}
                  >
                    {isManagingQuick ? '✓ Done' : '⚙️ Manage'}
                  </button>
                  <button
                    type="button"
                    className="small-btn primary-quick-btn"
                    onClick={() => setIsAddingQuick(true)}
                    title="Add a custom 1-tap quick spend shortcut"
                  >
                    ➕ Add
                  </button>
                </div>
              </div>

              {/* Classification Filter Tabs */}
              <div className="quick-category-tabs" role="tablist" aria-label="Classify quick spend">
                <button
                  type="button"
                  className={`quick-category-tab ${quickFilter === 'All' ? 'active' : ''}`}
                  onClick={() => setQuickFilter('All')}
                >
                  All ({quickPresets.length})
                </button>
                {QUICK_SPEND_CLASSIFICATIONS.map((c) => {
                  const count = quickPresets.filter((p) => p.classification === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`quick-category-tab ${quickFilter === c.id ? 'active' : ''}`}
                      onClick={() => setQuickFilter(c.id)}
                    >
                      <span aria-hidden="true">{c.icon}</span> {c.label} {count > 0 && <span className="cat-count">({count})</span>}
                    </button>
                  );
                })}
              </div>

              <div className="home-quick-chips">
                {displayedQuickPresets.length > 0 ? (
                  displayedQuickPresets.map((preset) => (
                    <div key={preset.id || preset.label} className="quick-chip-container">
                      <button
                        type="button"
                        className={`preset-chip home-preset-btn ${busy === `preset-${preset.id || preset.label}` ? 'is-saving' : ''} ${isManagingQuick ? 'manage-mode' : ''}`}
                        disabled={Boolean(busy) || isManagingQuick}
                        onClick={() => handleQuickAdd(preset)}
                        title={isManagingQuick ? `Click ✕ to remove ${preset.label}` : `1-Tap log: ₱${preset.amount}`}
                      >
                        <span aria-hidden="true">{classificationIcon(preset.classification) || categoryIcon(preset.category)}</span>
                        <span className="preset-label-text">{preset.label}</span>
                        <strong className="preset-chip-price">−₱{preset.amount}</strong>
                      </button>
                      {isManagingQuick && (
                        <button
                          type="button"
                          className="quick-chip-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuickPreset(preset);
                          }}
                          aria-label={`Delete ${preset.label}`}
                          title={`Delete ${preset.label}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="quick-empty-hint">
                    <p className="tiny-note">No {quickFilter} shortcuts yet. Click <strong>➕ Add</strong> to create one!</p>
                  </div>
                )}
                {!isManagingQuick && (
                  <button type="button" className="preset-chip home-preset-custom" onClick={() => go('expenses')}>
                    ➕ Custom expense →
                  </button>
                )}
              </div>

              {isManagingQuick && (
                <div className="quick-manage-footer">
                  <span className="tiny-note">Managing shortcuts: Click ✕ on any shortcut above to delete.</span>
                  <button type="button" className="link-btn small" onClick={handleResetQuickPresets}>
                    ↺ Reset to defaults
                  </button>
                </div>
              )}
            </section>

            {showChecklist && (
              <GettingStarted
                steps={checklistSteps}
                onDismiss={() => {
                  localStorage.setItem(`peso-checklist-hidden-${user?.id}`, '1');
                  setChecklistHidden(true);
                }}
              />
            )}

            <div className="grid-layout">
              <div className="stat-card tone-blue balance-card">
                <div className="balance-card-heading">
                  <div className="label">👛 Balance</div>
                  {!isEditingBalance && <button className="edit-balance-btn" type="button" onClick={startBalanceEdit}>Correct it</button>}
                </div>
                {isEditingBalance ? (
                  <form className="balance-edit-form" onSubmit={handleBalanceSubmit}>
                    <label className="field-hint" htmlFor="balance-input">How much cash + e-wallet money do you have right now?</label>
                    <AmountInput id="balance-input" value={balanceForm} onChange={setBalanceForm} min="0" autoFocus />
                    <div className="balance-edit-actions">
                      <button className="primary-btn" type="submit" disabled={busy === 'balance'}>{busy === 'balance' ? 'Saving…' : 'Save'}</button>
                      <button className="small-btn" type="button" onClick={() => setIsEditingBalance(false)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="value"><AnimatedCurrency value={balance} /></div>
                    <div className="hint">Money you have right now. Doesn’t match your wallet? Correct it.</div>
                  </>
                )}
              </div>
              <StatCard
                title="💸 Spent this month"
                value={<AnimatedCurrency value={monthSpent} />}
                hint={`${monthExpenses.length} expense${monthExpenses.length === 1 ? '' : 's'} logged`}
                tone="amber"
                actionLabel="View →"
                onClick={() => go('expenses')}
              />
              <StatCard
                title="💰 Received this month"
                value={<AnimatedCurrency value={monthIncome} />}
                hint={monthIncome - monthSpent >= 0 ? `${formatCurrency(monthIncome - monthSpent)} more in than out` : `${formatCurrency(monthSpent - monthIncome)} more out than in`}
                tone="green"
                actionLabel="View →"
                onClick={() => go('income')}
              />
              <StatCard
                title="🎯 In savings goals"
                value={<AnimatedCurrency value={savingsTotal} />}
                hint={goals.length ? `Across ${goals.length} goal${goals.length === 1 ? '' : 's'}` : 'Tap to create a goal'}
                tone="blue"
                actionLabel="Goals →"
                onClick={() => go('goals')}
              />
            </div>

            <FinancialAlerts dashboard={dashboard} onNavigate={go} />

            <div className="content-grid">
              <section className="panel" aria-labelledby="where-title">
                <div className="panel-heading-row">
                  <div>
                    <h2 className="panel-title" id="where-title">Where your money went</h2>
                    <p className="tiny-note">This month, by category · tap a category to filter</p>
                  </div>
                  <button type="button" className="small-btn" onClick={() => go('budgets')}>{hasBudget ? 'Edit limits' : 'Set limits'}</button>
                </div>
                {hasBudget && (
                  <div className="overall-budget">
                    <div className="label-row">
                      <span>Whole budget ({Math.min(100, Math.round((budget.spent / Math.max(1, budget.totalLimit)) * 100))}%)</span>
                      <span>{formatCurrency(budget.spent)} / {formatCurrency(budget.totalLimit)}</span>
                    </div>
                    <ProgressBar value={budget.spent} max={budget.totalLimit} tone={budget.remaining < 0 ? 'over' : ''} label="Monthly budget used" />
                  </div>
                )}
                {monthExpenses.length ? (
                  <ul className="bar-chart">
                    {CATEGORIES.filter((c) => monthCategoryTotals[c.id] || Number(budget?.categoryLimits?.[c.id]) > 0)
                      .sort((a, b) => (monthCategoryTotals[b.id] || 0) - (monthCategoryTotals[a.id] || 0))
                      .map((c) => {
                        const spent = monthCategoryTotals[c.id] || 0;
                        const limit = Number(budget?.categoryLimits?.[c.id] || 0);
                        const maxSpent = Math.max(...Object.values(monthCategoryTotals), 1);
                        const over = limit > 0 && spent > limit;
                        const sharePct = monthSpent > 0 ? Math.round((spent / monthSpent) * 100) : 0;
                        return (
                          <li
                            key={c.id}
                            className="chart-row interactive-chart-row"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedCategory(c.id);
                              go('expenses');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedCategory(c.id);
                                go('expenses');
                              }
                            }}
                            title={`Filter expenses by ${c.id}`}
                          >
                            <div className="label-row">
                              <span>
                                <span aria-hidden="true">{c.icon}</span> {c.id}
                                {sharePct > 0 && <small className="category-share-badge">{sharePct}%</small>}
                              </span>
                              <span className={over ? 'text-danger' : ''}>
                                {formatCurrency(spent)}{limit > 0 && <span className="muted"> / {formatCurrency(limit)}</span>}
                              </span>
                            </div>
                            <div className="bar-track">
                              <div className={`bar-fill ${over ? 'over' : ''}`} style={{ width: `${limit > 0 ? Math.min((spent / limit) * 100, 100) : (spent / maxSpent) * 100}%` }} />
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                ) : (
                  <EmptyState icon="🧾" title="Nothing spent this month yet" text="When you log expenses, you’ll see which categories take most of your money." action={<button type="button" className="primary-btn" onClick={() => go('expenses')}>Log an expense</button>} />
                )}
              </section>

              <section className="panel" aria-labelledby="recent-title">
                <div className="panel-heading-row">
                  <div>
                    <h2 className="panel-title" id="recent-title">Recent activity</h2>
                    <p className="tiny-note">Your latest money in and out · tap an item to view</p>
                  </div>
                  <button type="button" className="small-btn" onClick={() => go('expenses')}>See all</button>
                </div>
                {recentActivity.length ? (
                  <ul className="recent-list">
                    {recentActivity.map((item) => (
                      <li
                        key={`${item.kind}-${item.id}`}
                        className="interactive-recent-item"
                        role="button"
                        tabIndex={0}
                        onClick={() => go(item.kind === 'income' ? 'income' : 'expenses')}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go(item.kind === 'income' ? 'income' : 'expenses'))}
                      >
                        <span className="list-icon" aria-hidden="true">{item.kind === 'income' ? sourceIcon(item.source) : categoryIcon(item.category)}</span>
                        <div className="list-item-info">
                          <div className="list-item-title">{item.note || (item.kind === 'income' ? item.source : item.category)}</div>
                          <div className="tiny-note">{formatShortDate(item.date)} · {item.kind === 'income' ? item.source : item.category}</div>
                        </div>
                        <span className={`amount-tag ${item.kind === 'income' ? 'income' : ''}`}>
                          {item.kind === 'income' ? '+' : '−'}{formatCurrency(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon="📭" title="No activity yet" text="Start by logging money you received or spent." />
                )}
              </section>
            </div>

            <section className="panel savings-overview" aria-labelledby="savings-ov-title">
              <div className="panel-heading-row">
                <div>
                  <h2 className="panel-title" id="savings-ov-title">Savings goals</h2>
                  <p className="tiny-note">How close you are to the things you’re saving for</p>
                </div>
                <button className="small-btn" type="button" onClick={() => go('goals')}>{goals.length ? 'Manage goals' : 'Add a goal'}</button>
              </div>
              {goals.length ? (
                <div className="savings-goal-grid">
                  {goals.slice(0, 3).map((goal) => {
                    const current = Number(goal.currentAmount || 0);
                    const target = Number(goal.targetAmount || 1);
                    const progress = Math.min((current / target) * 100, 100);
                    const complete = progress >= 100;
                    return (
                      <div className={`savings-goal-summary ${complete ? 'is-complete' : ''}`} key={goal.id}>
                        <div className="savings-goal-topline">
                          <strong>🎯 {goal.name}</strong>
                          <span>{complete ? '🎉 Done' : `${progress.toFixed(0)}%`}</span>
                        </div>
                        <ProgressBar value={current} max={target} tone="success" label={`${goal.name} progress`} />
                        <div className="savings-goal-meta">
                          <span>{formatCurrency(current)} saved</span>
                          <span>{formatCurrency(Math.max(target - current, 0))} to go</span>
                        </div>
                        {!complete && (
                          <button
                            type="button"
                            className="home-goal-deposit-btn"
                            onClick={() => {
                              setTransferModal({ goal, type: 'deposit' });
                              setTransferAmount('');
                              setTransferError('');
                            }}
                          >
                            + Add money
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon="🎯" title="No savings goals yet" text="Saving for a laptop, a trip or emergencies? Create a goal and track your progress." />
              )}
            </section>

            <div className="trend-grid">
              <WeeklySpendingReview expenses={expenses} />
              <MonthlyTrendChart monthlyStats={reports?.monthlyStats} compact />
            </div>
          </div>
        )}

        {/* ============================ EXPENSES ============================ */}
        {view === 'expenses' && (
          <>
            <PageIntro view="expenses" />
            <div className="transaction-view">
              <section className="panel" aria-labelledby="add-expense-title">
                <div className="panel-heading-row add-panel-heading">
                  <h2 className="panel-title" id="add-expense-title">Add an expense</h2>
                  {expenses.length > 0 && (
                    <a href="#expense-history-title" className="mobile-only-jump-btn" aria-label="Jump down to expense history">
                      History ({expenses.length}) ↓
                    </a>
                  )}
                </div>
                <div className="quick-presets-wrap">
                  <div className="quick-presets-header">
                    <p className="tiny-note">1-Tap Quick Spend (saved for today — instant Undo):</p>
                    <div className="quick-presets-actions">
                      <button
                        type="button"
                        className={`small-btn ${isManagingQuick ? 'active-manage-btn' : ''}`}
                        onClick={() => setIsManagingQuick((v) => !v)}
                      >
                        {isManagingQuick ? '✓ Done' : '⚙️ Manage'}
                      </button>
                      <button
                        type="button"
                        className="small-btn primary-quick-btn"
                        onClick={() => setIsAddingQuick(true)}
                      >
                        ➕ Add
                      </button>
                    </div>
                  </div>

                  {/* Filter chips */}
                  <div className="quick-category-tabs" role="tablist" aria-label="Classify quick spend">
                    <button
                      type="button"
                      className={`quick-category-tab ${quickFilter === 'All' ? 'active' : ''}`}
                      onClick={() => setQuickFilter('All')}
                    >
                      All ({quickPresets.length})
                    </button>
                    {QUICK_SPEND_CLASSIFICATIONS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`quick-category-tab ${quickFilter === c.id ? 'active' : ''}`}
                        onClick={() => setQuickFilter(c.id)}
                      >
                        <span aria-hidden="true">{c.icon}</span> {c.label}
                      </button>
                    ))}
                  </div>

                  <div className="preset-chips">
                    {displayedQuickPresets.map((preset) => (
                      <div key={preset.id || preset.label} className="quick-chip-container">
                        <button
                          type="button"
                          className={`preset-chip ${isManagingQuick ? 'manage-mode' : ''}`}
                          disabled={Boolean(busy) || isManagingQuick}
                          onClick={() => handleQuickAdd(preset)}
                        >
                          <span aria-hidden="true">{classificationIcon(preset.classification) || categoryIcon(preset.category)}</span> {preset.label} · ₱{preset.amount}
                        </button>
                        {isManagingQuick && (
                          <button
                            type="button"
                            className="quick-chip-delete"
                            onClick={() => handleDeleteQuickPreset(preset)}
                            aria-label={`Delete ${preset.label}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isManagingQuick && (
                    <div className="quick-manage-footer">
                      <button type="button" className="link-btn small" onClick={handleResetQuickPresets}>
                        ↺ Reset to defaults
                      </button>
                    </div>
                  )}
                </div>
                <div className="divider"><span>or enter the details</span></div>
                <form className="stack" onSubmit={handleExpenseSubmit}>
                  <Field label="How much did you spend?">
                    {(p) => <AmountInput id={p.id} value={expenseForm.amount} onChange={(v) => setExpenseForm((f) => ({ ...f, amount: v }))} />}
                  </Field>
                  <ChoiceChips
                    legend="What was it for?"
                    name="expense-category"
                    options={CATEGORIES}
                    value={expenseForm.category}
                    onChange={(v) => setExpenseForm((f) => ({ ...f, category: v }))}
                    hint={categoryBudgetHint(expenseForm.category, expenseForm.amount)}
                  />
                  <Field label="Note" optional hint="A few words to help you remember, e.g. “Lunch with classmates”.">
                    {(p) => <input {...p} type="text" maxLength={120} value={expenseForm.note} onChange={(e) => setExpenseForm((f) => ({ ...f, note: e.target.value }))} />}
                  </Field>
                  <Field label="When?">
                    {(p) => (
                      <div className="date-row">
                        <input {...p} type="date" max={todayKey} value={expenseForm.date} onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))} required />
                        {expenseForm.date !== todayKey && <button type="button" className="small-btn" onClick={() => setExpenseForm((f) => ({ ...f, date: todayKey }))}>Today</button>}
                      </div>
                    )}
                  </Field>
                  {Number(expenseForm.amount) > 0 && (
                    <p className={`impact-note ${expenseAfter < 0 ? 'warn' : ''}`} aria-live="polite">
                      Your balance will go from <strong>{formatCurrency(balance)}</strong> to <strong>{formatCurrency(expenseAfter)}</strong>.
                      {expenseAfter < 0 && ' That’s below zero — did you forget to log some income?'}
                    </p>
                  )}
                  <button type="submit" className="primary-btn" disabled={busy === 'expense'}>{busy === 'expense' ? 'Saving…' : 'Save expense'}</button>
                </form>
              </section>

              <section className="panel" aria-labelledby="expense-history-title">
                <div className="panel-heading-row expense-list-heading">
                  <div className="expense-title-wrap">
                    <div>
                      <h2 className="panel-title" id="expense-history-title">Your expenses</h2>
                      <p className="tiny-note">
                        {filtersActive ? `Showing ${filteredExpenses.length} of ${expenses.length}` : `${expenses.length} total`} · {formatCurrency(filteredTotal)}
                      </p>
                    </div>
                    <a href="#add-expense-title" className="mobile-only-jump-btn" aria-label="Jump up to add expense form">
                      + Add expense ↑
                    </a>
                  </div>
                  <div className="expense-tools">
                    <button className="small-btn" type="button" onClick={() => exportExpenses(filteredExpenses)} disabled={!filteredExpenses.length}>⬇ Download CSV</button>
                    <button className="small-btn danger" type="button" onClick={() => setIsResettingExpenses(true)} disabled={!expenses.length}>Delete all</button>
                  </div>
                </div>
                <div className="expense-filters">
                  <label className="visually-hidden" htmlFor="expense-search">Search expenses</label>
                  <input id="expense-search" className="search-input" type="search" value={expenseSearch} onChange={(e) => setExpenseSearch(e.target.value)} placeholder="🔍 Search notes or categories…" />
                  <div className="filter-row">
                    <div className="category-chips" role="group" aria-label="Filter by category">
                      {['All', ...CATEGORY_IDS].map((cat) => (
                        <button key={cat} type="button" aria-pressed={selectedCategory === cat} className={`filter-chip ${selectedCategory === cat ? 'active' : ''}`} onClick={() => setSelectedCategory(cat)}>
                          {cat === 'All' ? 'All' : <><span aria-hidden="true">{categoryIcon(cat)}</span> {cat}</>}
                        </button>
                      ))}
                    </div>
                    <div className="select-row">
                      <label className="visually-hidden" htmlFor="expense-period">Time period</label>
                      <select id="expense-period" className="sort-select" value={expensePeriod} onChange={(e) => setExpensePeriod(e.target.value)}>
                        <option value="all">All time</option>
                        <option value="week">This week</option>
                        <option value="month">This month</option>
                        <option value="last-month">Last month</option>
                      </select>
                      <label className="visually-hidden" htmlFor="expense-sort">Sort by</label>
                      <select id="expense-sort" className="sort-select" value={expenseSort} onChange={(e) => setExpenseSort(e.target.value)}>
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="highest">Biggest first</option>
                        <option value="lowest">Smallest first</option>
                      </select>
                    </div>
                  </div>
                  {filtersActive && (
                    <button type="button" className="link-btn" onClick={() => { setExpensePeriod('all'); setSelectedCategory('All'); setExpenseSearch(''); }}>
                      Clear filters
                    </button>
                  )}
                </div>
                <TransactionGroups
                  items={filteredExpenses}
                  kind="expense"
                  onEdit={(e) => setEditExpense({ id: e.id, amount: String(e.amount), category: e.category, date: entryDateKey(e.date), note: e.note || '' })}
                  onDelete={(e) => setDeleteConfirm({ type: 'expense', id: e.id, label: `${e.note || e.category} — ${formatCurrency(e.amount)}` })}
                  emptyState={
                    expenses.length
                      ? <EmptyState icon="🔍" title="No expenses match your filters" text="Try a different category, period or search word." />
                      : <EmptyState icon="🧾" title="No expenses yet" text="Add your first one using the form. Small things count too!" />
                  }
                />
              </section>
            </div>
          </>
        )}

        {/* ============================ INCOME ============================ */}
        {view === 'income' && (
          <>
            <PageIntro view="income" />
            <div className="transaction-view">
              <section className="panel" aria-labelledby="add-income-title">
                <div className="panel-heading-row add-panel-heading">
                  <h2 className="panel-title" id="add-income-title">Add money you received</h2>
                  {incomes.length > 0 && (
                    <a href="#income-history-title" className="mobile-only-jump-btn" aria-label="Jump down to money received history">
                      History ({incomes.length}) ↓
                    </a>
                  )}
                </div>
                <form className="stack" onSubmit={handleIncomeSubmit}>
                  <Field label="How much did you receive?">
                    {(p) => <AmountInput id={p.id} value={incomeForm.amount} onChange={(v) => setIncomeForm((f) => ({ ...f, amount: v }))} />}
                  </Field>
                  <ChoiceChips legend="Where did it come from?" name="income-source" options={INCOME_SOURCES} value={incomeForm.source} onChange={(v) => setIncomeForm((f) => ({ ...f, source: v }))} />
                  <Field label="Note" optional hint="e.g. “Weekly allowance from Mom”.">
                    {(p) => <input {...p} type="text" maxLength={120} value={incomeForm.note} onChange={(e) => setIncomeForm((f) => ({ ...f, note: e.target.value }))} />}
                  </Field>
                  <Field label="When?">
                    {(p) => <input {...p} type="date" max={todayKey} value={incomeForm.date} onChange={(e) => setIncomeForm((f) => ({ ...f, date: e.target.value }))} required />}
                  </Field>
                  {Number(incomeForm.amount) > 0 && (
                    <p className="impact-note" aria-live="polite">
                      Your balance will go from <strong>{formatCurrency(balance)}</strong> to <strong>{formatCurrency(incomeAfter)}</strong>.
                    </p>
                  )}
                  <button type="submit" className="primary-btn" disabled={busy === 'income'}>{busy === 'income' ? 'Saving…' : 'Save income'}</button>
                </form>
              </section>

              <section className="panel" aria-labelledby="income-history-title">
                <div className="panel-heading-row income-list-heading">
                  <div className="expense-title-wrap">
                    <div>
                      <h2 className="panel-title" id="income-history-title">Money you’ve received</h2>
                      <p className="tiny-note">{incomes.length} entr{incomes.length === 1 ? 'y' : 'ies'} · {formatCurrency(incomes.reduce((s, i) => s + Number(i.amount), 0))} total</p>
                    </div>
                    <a href="#add-income-title" className="mobile-only-jump-btn" aria-label="Jump up to add money form">
                      + Add money ↑
                    </a>
                  </div>
                </div>
                <TransactionGroups
                  items={incomes}
                  kind="income"
                  onDelete={(i) => setDeleteConfirm({ type: 'income', id: i.id, label: `${i.note || i.source} — ${formatCurrency(i.amount)}` })}
                  emptyState={<EmptyState icon="💰" title="No income logged yet" text="Add your allowance or pay so PESO knows how much you have to work with." />}
                />
              </section>
            </div>
          </>
        )}

        {/* ============================ BUDGET ============================ */}
        {view === 'budgets' && (
          <>
            <PageIntro
              view="budgets"
              actions={<button type="button" className="secondary-btn" onClick={suggestBudget}>✨ Suggest from my spending</button>}
            />
            <form className="budget-layout" onSubmit={handleBudgetSubmit}>
              <section className="panel" aria-labelledby="budget-total-title">
                <h2 className="panel-title" id="budget-total-title">1. Your monthly limit</h2>
                <p className="tiny-note">The most you want to spend in {formatMonthName(currentMonthKey())}.</p>
                <div className="stack budget-total">
                  <Field
                    label="Monthly spending limit"
                    hint={
                      Number(budgetForm.totalLimit) > 0
                        ? `That’s about ${formatCurrency(Number(budgetForm.totalLimit) / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())} per day.`
                        : categorySum > 0
                          ? `Leave blank to use the total of your category limits (${formatCurrency(categorySum)}).`
                          : 'Tip: start with how much you usually receive in a month, minus what you want to save.'
                    }
                  >
                    {(p) => <AmountInput id={p.id} describedBy={p['aria-describedby']} value={budgetForm.totalLimit} onChange={(v) => setBudgetForm((f) => ({ ...f, totalLimit: v }))} min="0" required={false} />}
                  </Field>
                  {Number(budgetForm.totalLimit) > 0 && categorySum > Number(budgetForm.totalLimit) && (
                    <div className="impact-note warn">
                      Your category limits add up to {formatCurrency(categorySum)}, which is more than your monthly limit.
                      <button type="button" className="link-btn" onClick={() => setBudgetForm((f) => ({ ...f, totalLimit: String(categorySum) }))}>Use {formatCurrency(categorySum)} as the limit</button>
                    </div>
                  )}
                  {hasBudget && (
                    <div className="budget-now">
                      <div className="label-row"><span>Spent so far this month</span><span>{formatCurrency(budget.spent)} / {formatCurrency(budget.totalLimit)}</span></div>
                      <ProgressBar value={budget.spent} max={budget.totalLimit} tone={budget.remaining < 0 ? 'over' : ''} label="Monthly budget used" />
                    </div>
                  )}
                </div>
              </section>

              <section className="panel" aria-labelledby="budget-cat-title">
                <h2 className="panel-title" id="budget-cat-title">2. Limits per category <span className="field-optional">(optional)</span></h2>
                <p className="tiny-note">Get a warning when one type of spending gets too high. Leave blank for no limit.</p>
                <ul className="budget-cat-list">
                  {CATEGORIES.map((c) => {
                    const limit = Number(budgetForm.categoryLimits[c.id] || 0);
                    const spent = monthCategoryTotals[c.id] || 0;
                    return (
                      <li key={c.id} className="budget-cat-row">
                        <label htmlFor={`limit-${c.id}`} className="budget-cat-name">
                          <span aria-hidden="true">{c.icon}</span>
                          <span>
                            <strong>{c.id}</strong>
                            <small>{c.hint}</small>
                          </span>
                        </label>
                        <AmountInput
                          id={`limit-${c.id}`}
                          describedBy={`limit-${c.id}-status`}
                          value={budgetForm.categoryLimits[c.id]}
                          onChange={(v) => setBudgetForm((f) => ({ ...f, categoryLimits: { ...f.categoryLimits, [c.id]: v } }))}
                          min="0"
                          required={false}
                          placeholder="No limit"
                        />
                        <div className="budget-cat-status" id={`limit-${c.id}-status`}>
                          {limit > 0 ? (
                            <>
                              <ProgressBar value={spent} max={limit} tone={spent > limit ? 'over' : ''} label={`${c.id} limit used`} />
                              <span className={spent > limit ? 'text-danger' : ''}>
                                {formatCurrency(spent)} spent · {spent > limit ? `${formatCurrency(spent - limit)} over` : `${formatCurrency(limit - spent)} left`}
                              </span>
                            </>
                          ) : (
                            <span>{formatCurrency(spent)} spent this month</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="budget-footer">
                  <span className="tiny-note">Categories total: <strong>{formatCurrency(categorySum)}</strong></span>
                  <button type="submit" className="primary-btn" disabled={busy === 'budget'}>{busy === 'budget' ? 'Saving…' : 'Save budget'}</button>
                </div>
              </section>
            </form>
          </>
        )}

        {/* ============================ SAVINGS ============================ */}
        {view === 'goals' && (
          <>
            <PageIntro view="goals" />
            <div className="transaction-view">
              <section className="panel" aria-labelledby="add-goal-title">
                <h2 className="panel-title" id="add-goal-title">Start a new goal</h2>
                <form className="stack" onSubmit={handleGoalSubmit}>
                  <Field label="What are you saving for?" hint="e.g. New laptop, Emergency fund, Tuition">
                    {(p) => <input {...p} type="text" maxLength={60} value={goalForm.name} onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))} required />}
                  </Field>
                  <Field label="How much do you need?">
                    {(p) => <AmountInput id={p.id} value={goalForm.targetAmount} onChange={(v) => setGoalForm((f) => ({ ...f, targetAmount: v }))} />}
                  </Field>
                  <Field label="Already saved" optional hint="Money you’ve already put aside somewhere else. This is NOT taken from your balance.">
                    {(p) => <AmountInput id={p.id} describedBy={p['aria-describedby']} value={goalForm.currentAmount} onChange={(v) => setGoalForm((f) => ({ ...f, currentAmount: v }))} min="0" required={false} />}
                  </Field>
                  <Field label="Target date" optional hint="Add a date and PESO will tell you how much to save each week.">
                    {(p) => <input {...p} type="date" min={todayKey} value={goalForm.targetDate} onChange={(e) => setGoalForm((f) => ({ ...f, targetDate: e.target.value }))} />}
                  </Field>
                  {Number(goalForm.targetAmount) > 0 && goalForm.targetDate && (
                    <p className="impact-note">
                      To reach it, save about <strong>{formatCurrency(Math.max(Number(goalForm.targetAmount) - Number(goalForm.currentAmount || 0), 0) / Math.max(1, Math.ceil((new Date(`${goalForm.targetDate}T00:00:00`) - new Date()) / 86400000)) * 7)}</strong> per week.
                    </p>
                  )}
                  <button type="submit" className="primary-btn" disabled={busy === 'goal'}>{busy === 'goal' ? 'Saving…' : 'Create goal'}</button>
                </form>
              </section>

              <section className="panel" aria-labelledby="goal-list-title">
                <div className="panel-heading-row">
                  <div>
                    <h2 className="panel-title" id="goal-list-title">Your goals</h2>
                    <p className="tiny-note">{formatCurrency(savingsTotal)} saved in total · {formatCurrency(balance)} available to add</p>
                  </div>
                </div>
                {goals.length ? (
                  <ul className="list-stack">
                    {goals.map((goal) => {
                      const current = Number(goal.currentAmount);
                      const target = Number(goal.targetAmount || 1);
                      const remaining = Math.max(target - current, 0);
                      const complete = current >= target;
                      const daysToGo = goal.targetDate ? Math.ceil((new Date(goal.targetDate) - new Date()) / 86400000) : null;
                      let plan = 'No target date — save whenever you can.';
                      if (complete) plan = '🎉 Goal reached! Great job.';
                      else if (daysToGo !== null && daysToGo < 0) plan = `Target date passed (${formatShortDate(goal.targetDate)}).`;
                      else if (daysToGo !== null) plan = `Save ${formatCurrency((remaining / Math.max(1, daysToGo)) * 7)}/week to finish by ${formatShortDate(goal.targetDate)} (${daysToGo} days).`;
                      return (
                        <li key={goal.id} className={`goal-card ${complete ? 'complete' : ''}`}>
                          <div className="goal-card-header">
                            <span className="list-item-title">🎯 {goal.name}</span>
                            <span className="goal-pct">{Math.min((current / target) * 100, 100).toFixed(0)}%</span>
                          </div>
                          <div className="amount-row small-gap">
                            <strong>{formatCurrency(current)}</strong>
                            <span>of {formatCurrency(target)}{!complete && ` · ${formatCurrency(remaining)} to go`}</span>
                          </div>
                          <ProgressBar value={current} max={target} tone="success" label={`${goal.name} progress`} />
                          <p className={`tiny-note goal-plan ${daysToGo !== null && daysToGo < 0 && !complete ? 'text-danger' : ''}`}>{plan}</p>
                          <div className="goal-card-btns">
                            {!complete && (
                              <button type="button" className="small-btn deposit-btn" onClick={() => { setTransferModal({ goal, type: 'deposit' }); setTransferAmount(''); setTransferError(''); }}>
                                + Add money<span className="visually-hidden"> to {goal.name}</span>
                              </button>
                            )}
                            <button type="button" className="small-btn withdraw-btn" disabled={current <= 0} onClick={() => { setTransferModal({ goal, type: 'withdraw' }); setTransferAmount(''); setTransferError(''); }}>
                              − Take out<span className="visually-hidden"> from {goal.name}</span>
                            </button>
                            <button type="button" className="small-btn danger" onClick={() => setDeleteConfirm({ type: 'goal', id: goal.id, label: goal.name, amount: current })}>
                              Delete<span className="visually-hidden"> {goal.name}</span>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState icon="🎯" title="No goals yet" text="Create your first goal with the form. Even ₱20 a day becomes ₱600 a month!" />
                )}
              </section>
            </div>
          </>
        )}

        {/* ============================ REPORTS ============================ */}
        {view === 'reports' && (
          <>
            <PageIntro
              view="reports"
              actions={
                <div className="report-actions-row">
                  <button type="button" className="secondary-btn" onClick={() => exportExpenses()} disabled={!expenses.length}>⬇ Download expenses (CSV)</button>
                  <button type="button" className="secondary-btn" onClick={exportFullBackup}>💾 Backup all data (JSON)</button>
                </div>
              }
            />
            {!reports ? (
              <section className="panel loading-panel" aria-busy="true"><div className="skeleton" /><p className="tiny-note">Loading reports…</p></section>
            ) : (
              <div className="reports-view">
                <div className="grid-layout">
                  <StatCard title="💰 Total received" value={formatCurrency(reports.totals?.totalIncome)} hint="All income you’ve logged" tone="green" />
                  <StatCard title="💸 Total spent" value={formatCurrency(reports.totals?.totalExpenses)} hint="All expenses you’ve logged" tone="amber" />
                  <StatCard
                    title="⚖️ Difference"
                    value={formatCurrency(reports.totals?.netCashflow)}
                    hint={(reports.totals?.netCashflow || 0) >= 0 ? 'You received more than you spent' : 'You spent more than you received'}
                    tone={(reports.totals?.netCashflow || 0) >= 0 ? 'blue' : 'danger'}
                  />
                  <StatCard title="🎯 Saved in goals" value={formatCurrency(reports.totals?.totalSaved)} hint="Set aside for later" tone="blue" />
                </div>

                <section className="panel" aria-labelledby="insights-title">
                  <h2 className="panel-title" id="insights-title">What your numbers say</h2>
                  <p className="tiny-note">Plain-language insights from everything you’ve logged.</p>
                  <ul className="insight-list">
                    {insights.map((insight) => (
                      <li key={insight.text}><span aria-hidden="true">{insight.icon}</span><p>{insight.text}</p></li>
                    ))}
                  </ul>
                </section>

                <MonthlyTrendChart monthlyStats={reports.monthlyStats} />

                <div className="content-grid">
                  <section className="panel" aria-labelledby="month-table-title">
                    <h2 className="panel-title" id="month-table-title">Month by month</h2>
                    <div className="table-wrap">
                      <table className="report-table">
                        <caption className="visually-hidden">Money received and spent per month, last 6 months</caption>
                        <thead>
                          <tr><th scope="col">Month</th><th scope="col">Received</th><th scope="col">Spent</th><th scope="col">Difference</th></tr>
                        </thead>
                        <tbody>
                          {[...(reports.monthlyStats || [])].reverse().map((m) => (
                            <tr key={m.key}>
                              <th scope="row">{formatMonthName(m.key)}</th>
                              <td className="income">{formatCurrency(m.incomeTotal)}</td>
                              <td>{formatCurrency(m.total)}</td>
                              <td className={m.net < 0 ? 'text-danger' : 'income'}>{m.net >= 0 ? '+' : ''}{formatCurrency(m.net)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="panel" aria-labelledby="cat-report-title">
                    <h2 className="panel-title" id="cat-report-title">Spending by category</h2>
                    <p className="tiny-note">All time</p>
                    {Object.keys(reports.categoryTotals || {}).length ? (
                      <ul className="bar-chart">
                        {Object.entries(reports.categoryTotals).sort((a, b) => b[1] - a[1]).map(([category, total]) => {
                          const pct = reports.totals?.totalExpenses ? (total / reports.totals.totalExpenses) * 100 : 0;
                          return (
                            <li key={category} className="chart-row">
                              <div className="label-row">
                                <span><span aria-hidden="true">{categoryIcon(category)}</span> {category}</span>
                                <span>{formatCurrency(total)} <span className="muted">({pct.toFixed(0)}%)</span></span>
                              </div>
                              <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <EmptyState icon="📊" title="No spending yet" text="Your category breakdown will appear here." />
                    )}
                  </section>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ============================ MODALS ============================ */}
      {/* Add 1-Tap Quick Spend Modal */}
      <Modal open={isAddingQuick} onClose={() => setIsAddingQuick(false)} labelledBy="add-quick-title">
        <h2 id="add-quick-title" className="modal-title">⚡ Add 1-Tap Quick Spend</h2>
        <p className="tiny-note">Create a personalized shortcut for common student purchases.</p>
        <form className="stack" onSubmit={handleAddQuickSubmit}>
          <Field label="Shortcut name" hint="e.g. Jeep to School, Campus Meal, Iced Coffee, Yellow Pad">
            {(p) => (
              <input
                {...p}
                type="text"
                placeholder="e.g. Jeepney to Campus"
                maxLength={40}
                value={newQuickForm.label}
                onChange={(e) => setNewQuickForm((f) => ({ ...f, label: e.target.value }))}
                required
                autoFocus
              />
            )}
          </Field>

          <Field label="Amount (₱)" hint="The amount deducted in 1 tap.">
            {(p) => (
              <AmountInput
                id={p.id}
                value={newQuickForm.amount}
                onChange={(v) => setNewQuickForm((f) => ({ ...f, amount: v }))}
                placeholder="0.00"
              />
            )}
          </Field>

          <div className="field">
            <label className="field-label">Classification</label>
            <div className="quick-class-picker" role="radiogroup" aria-label="Select classification">
              {QUICK_SPEND_CLASSIFICATIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`quick-class-chip ${newQuickForm.classification === c.id ? 'active' : ''}`}
                  onClick={() => setNewQuickForm((f) => ({ ...f, classification: c.id }))}
                  aria-pressed={newQuickForm.classification === c.id}
                >
                  <span className="quick-class-icon" aria-hidden="true">{c.icon}</span>
                  <span className="quick-class-name">{c.label}</span>
                </button>
              ))}
            </div>
            <p className="field-hint">Classified as: <strong>{newQuickForm.classification}</strong></p>
          </div>

          <Field label="Note" optional hint="Saved with the expense (defaults to the shortcut name).">
            {(p) => (
              <input
                {...p}
                type="text"
                maxLength={80}
                placeholder={newQuickForm.label || 'Optional note'}
                value={newQuickForm.note}
                onChange={(e) => setNewQuickForm((f) => ({ ...f, note: e.target.value }))}
              />
            )}
          </Field>

          <div className="modal-actions">
            <button className="small-btn" type="button" onClick={() => setIsAddingQuick(false)}>Cancel</button>
            <button className="primary-btn" type="submit">Save 1-Tap Shortcut</button>
          </div>
        </form>
      </Modal>

      <HelpGuide open={guideOpen} onClose={closeGuide} onStart={() => { closeGuide(); go('dashboard'); }} />

      <Modal open={Boolean(editExpense)} onClose={() => setEditExpense(null)} labelledBy="edit-expense-title">
        {editExpense && (
          <>
            <h2 id="edit-expense-title" className="modal-title">Edit expense</h2>
            <p className="tiny-note">Your balance will be adjusted automatically if you change the amount.</p>
            <form className="stack" onSubmit={handleEditExpenseSubmit}>
              <Field label="Amount">
                {(p) => <AmountInput id={p.id} value={editExpense.amount} onChange={(v) => setEditExpense((f) => ({ ...f, amount: v }))} />}
              </Field>
              <Field label="Category">
                {(p) => (
                  <select {...p} value={editExpense.category} onChange={(e) => setEditExpense((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.id}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Note" optional>
                {(p) => <input {...p} type="text" maxLength={120} value={editExpense.note} onChange={(e) => setEditExpense((f) => ({ ...f, note: e.target.value }))} />}
              </Field>
              <Field label="Date">
                {(p) => <input {...p} type="date" max={todayKey} value={editExpense.date} onChange={(e) => setEditExpense((f) => ({ ...f, date: e.target.value }))} required />}
              </Field>
              <div className="modal-actions">
                <button className="small-btn" type="button" onClick={() => setEditExpense(null)}>Cancel</button>
                <button className="primary-btn" type="submit" disabled={busy === 'edit'}>{busy === 'edit' ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </>
        )}
      </Modal>

      <Modal open={Boolean(transferModal)} onClose={() => setTransferModal(null)} labelledBy="transfer-title">
        {transferModal && (() => {
          const { goal, type } = transferModal;
          const isDeposit = type === 'deposit';
          const amount = Number(transferAmount || 0);
          const remaining = Math.max(Number(goal.targetAmount) - Number(goal.currentAmount), 0);
          const quick = isDeposit
            ? [50, 100, 500, remaining].filter((v, i, arr) => v > 0 && v <= Math.max(balance, 0) && arr.indexOf(v) === i)
            : [Number(goal.currentAmount)].filter((v) => v > 0);
          return (
            <>
              <div className="eyebrow lime">{isDeposit ? 'Add money to goal' : 'Take money out of goal'}</div>
              <h2 id="transfer-title" className="modal-title">🎯 {goal.name}</h2>
              <p className="tiny-note">
                {isDeposit
                  ? 'This moves money from your balance into this goal, so you won’t accidentally spend it.'
                  : 'This moves money from this goal back into your balance so you can spend it.'}
              </p>
              <form className="stack" onSubmit={handleTransferSubmit}>
                <Field label="Amount">
                  {(p) => <AmountInput id={p.id} value={transferAmount} onChange={(v) => { setTransferAmount(v); setTransferError(''); }} autoFocus />}
                </Field>
                {quick.length > 0 && (
                  <div className="preset-chips" role="group" aria-label="Quick amounts">
                    {quick.map((v) => (
                      <button key={v} type="button" className="preset-chip" onClick={() => setTransferAmount(String(v))}>
                        {v === remaining && isDeposit ? `Finish it (${formatCurrency(v)})` : !isDeposit ? `Everything (${formatCurrency(v)})` : formatCurrency(v)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="transfer-preview">
                  <div><span>👛 Balance</span><strong>{formatCurrency(balance)} → {formatCurrency(isDeposit ? balance - amount : balance + amount)}</strong></div>
                  <div><span>🎯 Goal</span><strong>{formatCurrency(goal.currentAmount)} → {formatCurrency(isDeposit ? Number(goal.currentAmount) + amount : Number(goal.currentAmount) - amount)}</strong></div>
                </div>
                {transferError && <div className="form-error" role="alert"><span aria-hidden="true">⚠️</span> {transferError}</div>}
                <div className="modal-actions">
                  <button className="small-btn" type="button" onClick={() => setTransferModal(null)}>Cancel</button>
                  <button className="primary-btn" type="submit" disabled={busy === 'transfer'}>
                    {busy === 'transfer' ? 'Moving…' : isDeposit ? `Add ${amount > 0 ? formatCurrency(amount) : 'money'}` : `Take out ${amount > 0 ? formatCurrency(amount) : 'money'}`}
                  </button>
                </div>
              </form>
            </>
          );
        })()}
      </Modal>

      <Modal open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} labelledBy="delete-title" className="confirm-modal">
        {deleteConfirm && (
          <>
            <div className="danger-kicker">Please confirm</div>
            <h2 id="delete-title" className="modal-title">Delete this {deleteConfirm.type === 'goal' ? 'goal' : deleteConfirm.type}?</h2>
            <p className="confirm-label-text">{deleteConfirm.label}</p>
            <p className="tiny-note">
              {deleteConfirm.type === 'expense' && 'The amount will be added back to your balance.'}
              {deleteConfirm.type === 'income' && 'The amount will be removed from your balance.'}
              {deleteConfirm.type === 'goal' && (deleteConfirm.amount > 0
                ? `⚠️ This goal has ${formatCurrency(deleteConfirm.amount)} saved. Deleting it will NOT return that money to your balance — use “Take out” first if you want it back.`
                : 'This goal will be removed permanently.')}
            </p>
            <div className="modal-actions">
              <button className="small-btn" type="button" onClick={() => setDeleteConfirm(null)}>Keep it</button>
              <button className="small-btn danger confirm-danger" type="button" disabled={busy === 'delete'} onClick={handleConfirmDelete}>
                {busy === 'delete' ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={isResettingExpenses} onClose={() => { setIsResettingExpenses(false); setResetPhrase(''); }} labelledBy="reset-expenses-title" className="confirm-modal">
        <div className="danger-kicker">This can’t be undone</div>
        <h2 id="reset-expenses-title" className="modal-title">Delete all {expenses.length} expenses?</h2>
        <p className="tiny-note">Every logged expense will be removed and {formatCurrency(expenses.reduce((s, e) => s + Number(e.amount), 0))} added back to your balance. Your income, budget and goals stay the same.</p>
        <form className="stack" onSubmit={handleResetExpenses}>
          <label className="confirm-label" htmlFor="reset-phrase">Type RESET to confirm</label>
          <input id="reset-phrase" value={resetPhrase} onChange={(event) => setResetPhrase(event.target.value.toUpperCase())} placeholder="RESET" autoComplete="off" />
          <div className="modal-actions">
            <button className="small-btn" type="button" onClick={() => { setIsResettingExpenses(false); setResetPhrase(''); }}>Cancel</button>
            <button className="small-btn danger confirm-danger" type="submit" disabled={resetPhrase !== 'RESET' || busy === 'reset'}>Delete all expenses</button>
          </div>
        </form>
      </Modal>

      <ToastArea toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
