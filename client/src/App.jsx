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
  formatDayLabel,
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
  InstallAppModal,
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

  
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(() =>
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone === true)
  );

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    }
    function onAppInstalled() {
      setIsAppInstalled(true);
      setDeferredInstallPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  async function handleTriggerInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredInstallPrompt(null);
        setIsAppInstalled(true);
        notify('PESO app installed on your device!');
      }
    }
  }

  async function handleShareApp() {
    const shareUrl = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PESO — Personal Expense & Spending Organizer',
          text: 'Join me on PESO to track our daily allowance, expenses, and savings goals!',
          url: shareUrl,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      notify('App link copied! Send it to your friends so they can install PESO.');
    } catch {
      notify('Share this link with friends: ' + shareUrl);
    }
  }

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountProfile, setAccountProfile] = useState(null);

  const openAccountModal = useCallback(async () => {
    setAccountModalOpen(true);
    try {
      const data = await apiRequest('/user/profile', { token });
      setAccountProfile(data);
    } catch {}
  }, [token]);

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
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all'); // all | expense | income
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

  async function handleAddQuickSubmit(e) {
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
      label: newQuickForm.label.trim(),
      amount: numAmount,
      classification: classMeta.id,
      category: classMeta.defaultCategory,
      note: newQuickForm.note.trim() || newQuickForm.label.trim(),
    };

    const tempId = 'qp-temp-' + Date.now();
    updateQuickPresets((cur) => [...cur, { ...newPreset, id: tempId }]);
    notify(`Added "${newPreset.label}" (₱${newPreset.amount}) under ${classMeta.label}!`, { tone: 'success' });
    setIsAddingQuick(false);
    setNewQuickForm({ label: '', amount: '', classification: 'Fare', note: '' });

    try {
      const savedInDb = await apiRequest('/quick-presets', { method: 'POST', body: newPreset, token });
      if (savedInDb?.id) {
        updateQuickPresets((cur) => cur.map((p) => p.id === tempId ? savedInDb : p));
      }
    } catch (err) {
      console.warn('Could not save preset to server database:', err);
    }
  }

  async function handleDeleteQuickPreset(preset) {
    const previous = quickPresets;
    updateQuickPresets((cur) => cur.filter((p) => p.id !== preset.id && p.label !== preset.label));
    notify(`Deleted 1-tap shortcut "${preset.label}".`, {
      tone: 'info',
      action: {
        label: 'Undo',
        onClick: () => {
          updateQuickPresets(previous);
          apiRequest('/quick-presets', { method: 'POST', body: preset, token }).catch(() => {});
        },
      },
    });
    if (preset.id && !preset.id.startsWith('qp-temp-')) {
      try {
        await apiRequest('/quick-presets/' + preset.id, { method: 'DELETE', token });
      } catch (err) {
        console.warn('Could not delete preset on server:', err);
      }
    }
  }

  async function handleResetQuickPresets() {
    updateQuickPresets(DEFAULT_QUICK_PRESETS);
    notify('Reset 1-tap shortcuts back to defaults.', { tone: 'info' });
    setIsManagingQuick(false);
    try {
      const resetList = await apiRequest('/quick-presets/reset', { method: 'POST', token });
      if (Array.isArray(resetList) && resetList.length > 0) {
        updateQuickPresets(resetList);
      }
    } catch (err) {
      console.warn('Could not reset presets on server:', err);
    }
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
      const d = await apiRequest('/dashboard', { token });
      setDashboard(d);
      if (Array.isArray(d?.quickPresets) && d.quickPresets.length > 0) {
        setQuickPresets(d.quickPresets);
      }
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
    if (nextView === 'expenses') {
      setIsAddExpenseOpen(true);
      return;
    }
    if (nextView === 'income') {
      setIsAddIncomeOpen(true);
      return;
    }
    if (nextView === 'budgets') {
      setView('goals');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
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

  
  const filteredActivityList = useMemo(() => {
    let list = recentActivity;
    if (activityFilter === 'expense') {
      list = list.filter((i) => i.kind === 'expense');
    } else if (activityFilter === 'income') {
      list = list.filter((i) => i.kind === 'income');
    }
    if (expenseSearch.trim()) {
      const q = expenseSearch.toLowerCase();
      list = list.filter(
        (i) => (i.note || '').toLowerCase().includes(q) || (i.category || i.source || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [recentActivity, activityFilter, expenseSearch]);

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
      setIsAddExpenseOpen(false);
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
      setCompanionSpeech(`Logged ${preset.label} (₱${preset.amount})! Keep it up!`);
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
        <AuthScreen onAuthenticated={handleAuthenticated} notify={notify} theme={theme} toggleTheme={toggleTheme} onOpenInstall={() => setInstallModalOpen(true)} />
        <InstallAppModal
          open={installModalOpen}
          onClose={() => setInstallModalOpen(false)}
          deferredPrompt={deferredInstallPrompt}
          onTriggerInstall={handleTriggerInstall}
          isInstalled={isAppInstalled}
          onShare={handleShareApp}
          notify={notify}
        />
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
              className="theme-toggle-btn topbar-install-btn install-pill-btn"
              onClick={() => setInstallModalOpen(true)}
              title="Install PESO on your phone or share with friends"
            >
              <span className="theme-toggle-label">{isAppInstalled ? 'Share App' : 'Get App'}</span>
            </button>
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
            <button
              type="button"
              className="topbar-user-badge"
              onClick={openAccountModal}
              title="View account profile and database info"
            >
              <div className="user-orb" aria-hidden="true">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
              </div>
              <div className="topbar-user-meta">
                <span className="topbar-user-name">{user?.name || 'Account'}</span>
                <span className="topbar-user-sub">Account details</span>
              </div>
            </button>
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
          <div className="dashboard-view simplified-dashboard">
            {/* Clean Balance Hero Card */}
            <section className="clean-hero-card panel">
              <div className="clean-hero-header">
                <span className="clean-hero-date">{formatDayLabel(todayKey)}</span>
                {!isEditingBalance && (
                  <button type="button" className="link-btn small" onClick={startBalanceEdit}>
                    Correct cash
                  </button>
                )}
              </div>

              {isEditingBalance ? (
                <form className="balance-edit-form" onSubmit={handleBalanceSubmit}>
                  <label className="field-hint" htmlFor="balance-input">How much cash + e-wallet money do you actually have?</label>
                  <AmountInput id="balance-input" value={balanceForm} onChange={setBalanceForm} min="0" autoFocus />
                  <div className="balance-edit-actions">
                    <button className="primary-btn" type="submit" disabled={busy === 'balance'}>
                      {busy === 'balance' ? 'Saving…' : 'Save Balance'}
                    </button>
                    <button className="small-btn" type="button" onClick={() => setIsEditingBalance(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="clean-hero-body">
                  <span className="clean-hero-label">Available Balance</span>
                  <div className="clean-hero-amount">
                    <AnimatedCurrency value={balance} />
                  </div>
                  {hasBudget ? (
                    <div className="clean-budget-status">
                      <div className="clean-budget-text">
                        <span>Spent {formatCurrency(budget.spent)} of {formatCurrency(budget.totalLimit)} budget</span>
                        {safeDailySpend > 0 && (
                          <span className="safe-spend-badge">
                            Safe spend: {formatCurrency(safeDailySpend)}/day
                          </span>
                        )}
                      </div>
                      <ProgressBar
                        value={budget.spent}
                        max={budget.totalLimit}
                        tone={budget.remaining < 0 ? 'over' : 'success'}
                        label="Monthly budget used"
                      />
                    </div>
                  ) : (
                    <p className="clean-hero-hint">
                      Your total money on hand. Tap <strong>Budget &amp; Goals</strong> below to set your monthly limit.
                    </p>
                  )}
                </div>
              )}

              {/* Two Big Primary Action Buttons */}
              <div className="clean-hero-actions">
                <button
                  type="button"
                  className="primary-btn hero-action-btn spend-btn"
                  onClick={() => setIsAddExpenseOpen(true)}
                >
                  − Log Expense
                </button>
                <button
                  type="button"
                  className="primary-btn hero-action-btn income-btn"
                  onClick={() => setIsAddIncomeOpen(true)}
                >
                  + Add Money
                </button>
              </div>
            </section>

            {/* 1-Tap Quick Spend Strip */}
            <section className="home-quick-bar panel" aria-label="Quick 1-tap expense logging">
              <div className="home-quick-header">
                <div className="home-quick-info">
                  <span className="home-quick-badge">1-Tap Quick Spend</span>
                  <span className="tiny-note">
                    {isManagingQuick
                      ? 'Tap × to remove any shortcut, or reset to defaults below:'
                      : 'Common student expenses (tap to log in one tap with instant Undo):'}
                  </span>
                </div>
                <div className="home-quick-actions">
                  <button
                    type="button"
                    className={`small-btn ${isManagingQuick ? 'active-manage-btn' : ''}`}
                    onClick={() => setIsManagingQuick((v) => !v)}
                    title={isManagingQuick ? 'Done managing shortcuts' : 'Manage and delete shortcuts'}
                  >
                    {isManagingQuick ? 'Done' : 'Manage'}
                  </button>
                  <button
                    type="button"
                    className="small-btn primary-quick-btn"
                    onClick={() => setIsAddingQuick(true)}
                    title="Add a custom 1-tap quick spend shortcut"
                  >
                    + Add
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
                      {c.label} {count > 0 && <span className="cat-count">({count})</span>}
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
                        title={isManagingQuick ? `Click × to remove ${preset.label}` : `1-Tap log: ₱${preset.amount}`}
                      >
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
                          ×
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="quick-empty-hint">
                    <p className="tiny-note">No {quickFilter} shortcuts yet. Click <strong>+ Add</strong> to create one!</p>
                  </div>
                )}
              </div>

              {isManagingQuick && (
                <div className="quick-manage-footer">
                  <span className="tiny-note">Managing shortcuts: Click × on any shortcut above to delete.</span>
                  <button type="button" className="link-btn small" onClick={handleResetQuickPresets}>
                    Reset to defaults
                  </button>
                </div>
              )}
            </section>

            {/* Clean Recent Activity Section */}
            <section className="panel clean-activity-panel" aria-labelledby="activity-title">
              <div className="panel-heading-row">
                <div>
                  <h2 className="panel-title" id="activity-title">Recent Transactions</h2>
                  <p className="tiny-note">Tap any transaction to view, edit, or delete</p>
                </div>
                <div className="activity-filter-pills" role="tablist">
                  <button
                    type="button"
                    className={`small-btn ${activityFilter === 'all' ? 'primary-quick-btn' : ''}`}
                    onClick={() => setActivityFilter('all')}
                  >
                    All ({recentActivity.length})
                  </button>
                  <button
                    type="button"
                    className={`small-btn ${activityFilter === 'expense' ? 'primary-quick-btn' : ''}`}
                    onClick={() => setActivityFilter('expense')}
                  >
                    Expenses ({expenses.length})
                  </button>
                  <button
                    type="button"
                    className={`small-btn ${activityFilter === 'income' ? 'primary-quick-btn' : ''}`}
                    onClick={() => setActivityFilter('income')}
                  >
                    Income ({incomes.length})
                  </button>
                </div>
              </div>

              {filteredActivityList.length > 0 ? (
                <ul className="recent-list">
                  {filteredActivityList.map((item) => (
                    <li
                      key={`${item.kind}-${item.id}`}
                      className="interactive-recent-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (item.kind === 'expense') {
                          setEditExpense(item);
                        } else {
                          setDeleteConfirm({ type: 'income', item, amount: item.amount, label: item.source });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (item.kind === 'expense') setEditExpense(item);
                          else setDeleteConfirm({ type: 'income', item, amount: item.amount, label: item.source });
                        }
                      }}
                    >
                      <span className="list-icon" aria-hidden="true">
                        {item.kind === 'income' ? sourceIcon(item.source) : categoryIcon(item.category)}
                      </span>
                      <div className="list-item-info">
                        <div className="list-item-title">
                          {item.note || (item.kind === 'income' ? item.source : item.category)}
                        </div>
                        <div className="tiny-note">
                          {formatShortDate(item.date)} · {item.kind === 'income' ? item.source : item.category}
                        </div>
                      </div>
                      <span className={`amount-tag ${item.kind === 'income' ? 'income' : ''}`}>
                        {item.kind === 'income' ? '+' : '−'}{formatCurrency(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon="📭"
                  title="No transactions yet"
                  text={
                    activityFilter === 'income'
                      ? 'No income logged yet. Click "+ Add Money" to add your allowance or earnings.'
                      : activityFilter === 'expense'
                      ? 'No expenses logged yet. Tap any 1-Tap shortcut above or click "− Log Expense".'
                      : 'Start by recording your cash balance or logging your first transaction.'
                  }
                  action={
                    <button type="button" className="primary-btn" onClick={() => setIsAddExpenseOpen(true)}>
                      − Log First Expense
                    </button>
                  }
                />
              )}
            </section>
          </div>
        )}

        {/* ============================ BUDGET & GOALS ============================ */}
        {view === 'goals' && (
          <div className="goals-budget-view stack">
            <PageIntro view="goals" />

            {/* Monthly Budget Section */}
            <section className="panel" aria-labelledby="budget-summary-title">
              <div className="panel-heading-row">
                <div>
                  <h2 className="panel-title" id="budget-summary-title">Monthly Budget Limit</h2>
                  <p className="tiny-note">Set a target limit so PESO can calculate your daily safe spend</p>
                </div>
              </div>

              {hasBudget ? (
                <div className="overall-budget" style={{ marginTop: '8px' }}>
                  <div className="label-row">
                    <span>
                      Spent {formatCurrency(budget.spent)} of {formatCurrency(budget.totalLimit)} ({Math.min(100, Math.round((budget.spent / Math.max(1, budget.totalLimit)) * 100))}%)
                    </span>
                    <span className={budget.remaining < 0 ? 'text-danger' : 'text-success'}>
                      {budget.remaining >= 0 ? `${formatCurrency(budget.remaining)} left` : `${formatCurrency(-budget.remaining)} over`}
                    </span>
                  </div>
                  <ProgressBar value={budget.spent} max={budget.totalLimit} tone={budget.remaining < 0 ? 'over' : 'success'} label="Monthly budget usage" />
                  {safeDailySpend > 0 && (
                    <div className="field-hint" style={{ marginTop: '10px' }}>
                      ✨ You can safely spend <strong>{formatCurrency(safeDailySpend)}/day</strong> for the remaining {daysLeft} days of this month.
                    </div>
                  )}
                </div>
              ) : (
                <p className="tiny-note">You haven’t set a budget yet. Enter your target monthly spending below to get daily limits.</p>
              )}

              <form className="stack" style={{ marginTop: '16px' }} onSubmit={handleBudgetSubmit}>
                <Field label="Total Monthly Budget (₱)" hint="The maximum you plan to spend this month.">
                  {(p) => (
                    <AmountInput
                      id={p.id}
                      value={budgetForm.totalLimit}
                      onChange={(v) => setBudgetForm((f) => ({ ...f, totalLimit: v }))}
                      placeholder="e.g. 3000"
                    />
                  )}
                </Field>
                <button type="submit" className="primary-btn" disabled={busy === 'budget'}>
                  {busy === 'budget' ? 'Saving…' : hasBudget ? 'Update Monthly Budget' : 'Set Monthly Budget'}
                </button>
              </form>
            </section>

            {/* Savings Goals Section */}
            <section className="panel" aria-labelledby="savings-goals-title">
              <div className="panel-heading-row">
                <div>
                  <h2 className="panel-title" id="savings-goals-title">Savings Goals</h2>
                  <p className="tiny-note">Set money aside for things you want (laptop, emergency fund, tuition)</p>
                </div>
              </div>

              {goals.length > 0 ? (
                <div className="savings-goal-grid" style={{ marginTop: '12px' }}>
                  {goals.map((goal) => {
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
                        <div className="goal-card-actions" style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button
                            type="button"
                            className="small-btn primary-quick-btn"
                            onClick={() => {
                              setTransferModal({ goal, type: 'deposit' });
                              setTransferAmount('');
                              setTransferError('');
                            }}
                          >
                            + Deposit
                          </button>
                          {current > 0 && (
                            <button
                              type="button"
                              className="small-btn"
                              onClick={() => {
                                setTransferModal({ goal, type: 'withdraw' });
                                setTransferAmount('');
                                setTransferError('');
                              }}
                            >
                              Withdraw
                            </button>
                          )}
                          <button
                            type="button"
                            className="link-btn small text-danger"
                            onClick={() => setDeleteConfirm({ type: 'goal', goal, amount: current, label: goal.name })}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon="🎯"
                  title="No savings goals yet"
                  text="Create a savings goal below to set aside money and track your progress."
                />
              )}

              {/* Add New Goal Form */}
              <div className="divider" style={{ margin: '20px 0' }}><span>Create a new savings goal</span></div>
              <form className="stack" onSubmit={handleGoalSubmit}>
                <Field label="What are you saving for?">
                  {(p) => <input {...p} type="text" placeholder="e.g. Emergency fund, New laptop, School trip" value={goalForm.name} onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))} required />}
                </Field>
                <Field label="Target amount (₱)">
                  {(p) => <AmountInput id={p.id} value={goalForm.targetAmount} onChange={(v) => setGoalForm((f) => ({ ...f, targetAmount: v }))} />}
                </Field>
                <button type="submit" className="primary-btn" disabled={busy === 'goal'}>
                  {busy === 'goal' ? 'Saving…' : 'Create Savings Goal'}
                </button>
              </form>
            </section>
          </div>
        )}

        {/* ============================ INSIGHTS ============================ */}
        {view === 'reports' && (
          <div className="insights-view stack">
            <PageIntro view="reports" />

            {/* Month Summary Cards */}
            <div className="grid-layout">
              <StatCard
                title="Total received this month"
                value={<AnimatedCurrency value={monthIncome} />}
                hint={monthIncome >= monthSpent ? `${formatCurrency(monthIncome - monthSpent)} net positive` : `${formatCurrency(monthSpent - monthIncome)} deficit`}
                tone="green"
              />
              <StatCard
                title="Total spent this month"
                value={<AnimatedCurrency value={monthSpent} />}
                hint={`${monthExpenses.length} expense${monthExpenses.length === 1 ? '' : 's'} recorded`}
                tone="amber"
              />
              <StatCard
                title="Saved in goals"
                value={<AnimatedCurrency value={savingsTotal} />}
                hint={`Across ${goals.length} active goal${goals.length === 1 ? '' : 's'}`}
                tone="blue"
              />
            </div>

            {/* Category Breakdown */}
            <section className="panel" aria-labelledby="cat-breakdown-title">
              <div className="panel-heading-row">
                <div>
                  <h2 className="panel-title" id="cat-breakdown-title">Where your money went this month</h2>
                  <p className="tiny-note">Category spending breakdown and percentage share</p>
                </div>
              </div>
              {monthExpenses.length > 0 ? (
                <ul className="bar-chart" style={{ marginTop: '12px' }}>
                  {CATEGORIES.filter((c) => monthCategoryTotals[c.id])
                    .sort((a, b) => (monthCategoryTotals[b.id] || 0) - (monthCategoryTotals[a.id] || 0))
                    .map((c) => {
                      const spent = monthCategoryTotals[c.id] || 0;
                      const maxSpent = Math.max(...Object.values(monthCategoryTotals), 1);
                      const sharePct = monthSpent > 0 ? Math.round((spent / monthSpent) * 100) : 0;
                      return (
                        <li key={c.id} className="chart-row">
                          <div className="label-row">
                            <span>
                              <span aria-hidden="true">{c.icon}</span> {c.id}
                              <small className="category-share-badge">{sharePct}%</small>
                            </span>
                            <strong>{formatCurrency(spent)}</strong>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${(spent / maxSpent) * 100}%` }} />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <EmptyState
                  icon="🧾"
                  title="No spending recorded this month"
                  text="When you log expenses, your category breakdown will automatically appear here."
                />
              )}
            </section>

            {/* Weekly & Monthly Charts */}
            <div className="trend-grid">
              <WeeklySpendingReview expenses={expenses} />
              {reports?.monthlyStats && <MonthlyTrendChart monthlyStats={reports.monthlyStats} />}
            </div>
          </div>
        )}
      </main>

      {/* ============================ MODALS ============================ */}
      {/* Add 1-Tap Quick Spend Modal */}
      <Modal open={isAddingQuick} onClose={() => setIsAddingQuick(false)} labelledBy="add-quick-title">
        <h2 id="add-quick-title" className="modal-title">Add 1-Tap Quick Spend</h2>
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

      
      {/* Account Details & Database Status Modal */}
      <Modal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} labelledBy="account-modal-title">
        <h2 id="account-modal-title" className="modal-title">Account Details</h2>
        <div className="account-modal-content stack">
          <div className="account-hero-card">
            <div className="account-hero-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="account-hero-info">
              <h3>{user?.name || 'User'}</h3>
              <p className="account-email-label">{user?.email}</p>
              <span className="account-status-pill">Active Account</span>
            </div>
          </div>

          <div className="account-stats-grid">
            <div className="account-stat-box">
              <span className="stat-label">Logged Expenses</span>
              <strong>{accountProfile?.stats?.expenseCount ?? expenses.length}</strong>
            </div>
            <div className="account-stat-box">
              <span className="stat-label">Income Records</span>
              <strong>{accountProfile?.stats?.incomeCount ?? incomes.length}</strong>
            </div>
            <div className="account-stat-box">
              <span className="stat-label">Savings Goals</span>
              <strong>{accountProfile?.stats?.goalCount ?? goals.length}</strong>
            </div>
            <div className="account-stat-box">
              <span className="stat-label">Current Balance</span>
              <strong>{formatCurrency(balance)}</strong>
            </div>
          </div>

          <div className="account-db-card">
            <div className="account-db-header">
              <h4>Database Status</h4>
              <span className={accountProfile?.database?.isPersistentCloud ? 'db-status-pill green' : 'db-status-pill blue'}>
                {accountProfile?.database?.isPersistentCloud ? 'PostgreSQL Cloud Database' : 'SQLite Local Database'}
              </span>
            </div>
            <p className="tiny-note">
              {accountProfile?.database?.isPersistentCloud
                ? 'All your transactions, balance, and quick spend shortcuts are stored permanently in the PostgreSQL cloud database.'
                : 'All transactions are currently stored under your account. To keep data permanently across server restarts in the cloud, link your cloud database URL in Render.'}
            </p>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={exportFullBackup}>
              Download Backup
            </button>
            <button type="button" className="secondary-btn" onClick={() => { setAccountModalOpen(false); logout(); }}>
              Sign out
            </button>
            <button type="button" className="primary-btn" onClick={() => setAccountModalOpen(false)}>
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Install & Share App Modal */}
      <InstallAppModal
        open={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        deferredPrompt={deferredInstallPrompt}
        onTriggerInstall={handleTriggerInstall}
        isInstalled={isAppInstalled}
        onShare={handleShareApp}
        notify={notify}
      />

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
