import { useState } from 'react';
import {
  AmbientShapes,
  AnimatedCurrency,
  EmptyState,
  Field,
  Modal,
  PixelCompanion,
  ProgressBar,
  apiRequest,
  categoryIcon,
  entryDateKey,
  formatCurrency,
  formatDayLabel,
  localDateKey,
  sourceIcon,
} from './ui.jsx';

/* ------------------------------------------------------------------ */
/* Navigation metadata – one place that explains every page            */
/* ------------------------------------------------------------------ */

export const VIEWS = [
  {
    id: 'dashboard',
    label: 'Home',
    icon: '🏠',
    title: 'Home',
    description: 'Your money at a glance.',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    icon: '💸',
    title: 'Expenses',
    description: 'Write down every peso you spend so you know exactly where your money goes.',
    effect: 'Saving an expense subtracts it from your balance.',
  },
  {
    id: 'income',
    label: 'Income',
    icon: '💰',
    title: 'Income',
    description: 'Record money you receive — allowance, salary, scholarship, gifts.',
    effect: 'Saving income adds it to your balance.',
  },
  {
    id: 'budgets',
    label: 'Budget',
    icon: '📊',
    title: 'Monthly budget',
    description: 'Decide the most you want to spend this month. PESO warns you before you go over.',
    effect: 'A budget is only a limit — it does not move or lock any money.',
  },
  {
    id: 'goals',
    label: 'Savings',
    icon: '🎯',
    title: 'Savings goals',
    description: 'Set money aside for things that matter — a laptop, tuition, an emergency fund.',
    effect: 'Adding money to a goal moves it out of your balance. Taking it out moves it back.',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: '📈',
    title: 'Reports & insights',
    description: 'See your spending patterns over time and what they mean.',
  },
];

export function PageIntro({ view, actions }) {
  const meta = VIEWS.find((v) => v.id === view);
  if (!meta) return null;
  return (
    <header className="page-intro">
      <div>
        <h1>
          <span aria-hidden="true">{meta.icon}</span> {meta.title}
        </h1>
        <p>{meta.description}</p>
        {meta.effect && (
          <p className="page-effect">
            <span aria-hidden="true">ℹ️</span> {meta.effect}
          </p>
        )}
      </div>
      {actions && <div className="page-intro-actions">{actions}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

function PasswordInput({ id, value, onChange, autoComplete, minLength, describedBy }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-wrap">
      <input
        id={id}
        name="password"
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        minLength={minLength}
        aria-describedby={describedBy}
        required
      />
      <button
        type="button"
        className="password-toggle"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

const LANDING_TIPS = [
  '🪙 Tap any preset below to test how PESO tracks your allowance in real time!',
  '💡 Saving just ₱50 a day adds up to ₱1,500 every single month!',
  '🚌 Logging small jeepney & snack costs helps you spot where your money goes.',
  '🎯 Set a savings goal first so you pay your future self before spending!',
  '📊 PESO divides your remaining budget by the days left in the month automatically.',
];

const SANDBOX_PRESETS = [
  { id: 'jeep', icon: '🚌', label: 'Jeepney', amount: 15, category: 'Transport' },
  { id: 'meal', icon: '🍱', label: 'Canteen Meal', amount: 65, category: 'Food' },
  { id: 'coffee', icon: '☕', label: 'Iced Coffee', amount: 45, category: 'Food' },
  { id: 'print', icon: '📚', label: 'Xerox / Print', amount: 20, category: 'Study' },
];

export function AuthScreen({ onAuthenticated, notify, theme, toggleTheme }) {
  const [mode, setMode] = useState('login'); // login | register | reset
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [reset, setReset] = useState({ step: 1, email: '', token: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Interactive landing page state
  const [previewTab, setPreviewTab] = useState('spend'); // spend | budget | goal
  const [tipIndex, setTipIndex] = useState(0);
  const [mascotExcited, setMascotExcited] = useState(false);
  const [simBalance, setSimBalance] = useState(1850);
  const [simLogs, setSimLogs] = useState([
    { id: 1, icon: '🍱', label: 'Campus Lunch', amount: 75 },
    { id: 2, icon: '🚌', label: 'Jeepney Fare', amount: 15 },
  ]);
  const [simBudget, setSimBudget] = useState(1500);
  const [simGoalSaved, setSimGoalSaved] = useState(900);
  const simGoalTarget = 1500;

  const update = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  function triggerMascotReaction(nextTipIdx) {
    setMascotExcited(true);
    if (typeof nextTipIdx === 'number') {
      setTipIndex(nextTipIdx);
    } else {
      setTipIndex((i) => (i + 1) % LANDING_TIPS.length);
    }
    setTimeout(() => setMascotExcited(false), 750);
  }

  function handleSandboxSpend(preset) {
    setSimBalance((b) => Math.max(0, b - preset.amount));
    setSimLogs((logs) => [
      { id: Date.now() + Math.random(), icon: preset.icon, label: preset.label, amount: preset.amount },
      ...logs.slice(0, 2),
    ]);
    triggerMascotReaction();
  }

  function handleSandboxReset() {
    setSimBalance(1850);
    setSimLogs([
      { id: 1, icon: '🍱', label: 'Campus Lunch', amount: 75 },
      { id: 2, icon: '🚌', label: 'Jeepney Fare', amount: 15 },
    ]);
    triggerMascotReaction(0);
  }

  function handlePointerMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  }

  async function submit(event, override) {
    event?.preventDefault();
    setError('');
    setBusy(true);
    const credentials = override || form;
    try {
      const isLogin = override || mode === 'login';
      const payload = isLogin
        ? { email: credentials.email, password: credentials.password }
        : credentials;
      const response = await apiRequest(`/auth/${isLogin ? 'login' : 'register'}`, { method: 'POST', body: payload });
      onAuthenticated(response, !isLogin);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function startDemo() {
    setError('');
    setBusy(true);
    try {
      const response = await apiRequest('/auth/demo', { method: 'POST' });
      onAuthenticated(response, false);
    } catch {
      try {
        const response = await apiRequest('/auth/login', {
          method: 'POST',
          body: { email: 'student@peso.app', password: 'password123' },
        });
        onAuthenticated(response, false);
      } catch (err) {
        setError(err.message || 'Unable to launch demo. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (reset.step === 1) {
        const response = await apiRequest('/auth/reset-request', { method: 'POST', body: { email: reset.email } });
        setReset((r) => ({ ...r, step: 2, token: response.token || '' }));
        notify(
          response.token
            ? 'Reset code created. Because PESO runs on your computer, we filled it in for you.'
            : response.message,
          { tone: 'info' },
        );
      } else {
        const response = await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: { email: reset.email, token: reset.token, password: reset.password },
        });
        notify(`${response.message} You can sign in with your new password now.`);
        setForm((f) => ({ ...f, email: reset.email, password: '' }));
        setReset({ step: 1, email: '', token: '', password: '' });
        setMode('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const heading = {
    login: { title: 'Welcome back', sub: 'Sign in to see your balance, budget and savings.' },
    register: { title: 'Create your account', sub: 'Free, private, and built for students.' },
    reset: { title: 'Reset your password', sub: reset.step === 1 ? 'Enter the email you signed up with.' : 'Choose a new password.' },
  }[mode];

  const simSpentTotal = 1940 - simBalance;
  const simSafeDaily = Math.max(0, Math.round((simBudget - simSpentTotal) / 12));
  const simGoalPct = Math.min(100, Math.round((simGoalSaved / simGoalTarget) * 100));

  return (
    <div className="auth-shell">
      <AmbientShapes />
      <div className="auth-aside">
        <div className="auth-brand-badge">
          <PixelCompanion compact />
          <span className="eyebrow">PESO · Personal Expense &amp; Spending Organizer</span>
        </div>

        <h1 className="auth-hero-title">
          Make every peso<br />
          <em className="shimmer-text">count.</em>
        </h1>
        <p className="aside-copy">
          The smart, stress-free money companion for students. Know what you have, what you spent, and what you can safely spend today.
        </p>

        {/* Interactive Live Mini-Preview Sandbox */}
        <div className="auth-sandbox-card" onPointerMove={handlePointerMove}>
          <div className="sandbox-header">
            <span className="sandbox-live-dot" aria-hidden="true" />
            <span className="sandbox-badge-text">Interactive Live Preview · Try tapping!</span>
          </div>

          <div className="sandbox-tabs" role="tablist" aria-label="Interactive feature preview">
            <button
              type="button"
              role="tab"
              aria-selected={previewTab === 'spend'}
              className={`sandbox-tab ${previewTab === 'spend' ? 'active' : ''}`}
              onClick={() => setPreviewTab('spend')}
            >
              💸 1-Tap Spend
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={previewTab === 'budget'}
              className={`sandbox-tab ${previewTab === 'budget' ? 'active' : ''}`}
              onClick={() => setPreviewTab('budget')}
            >
              📊 Safe Daily Limit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={previewTab === 'goal'}
              className={`sandbox-tab ${previewTab === 'goal' ? 'active' : ''}`}
              onClick={() => setPreviewTab('goal')}
            >
              🎯 Savings Jar
            </button>
          </div>

          {previewTab === 'spend' && (
            <div className="sandbox-panel" key="spend">
              <div className="sandbox-balance-row">
                <div>
                  <span className="sandbox-label">Sample Wallet Balance</span>
                  <strong className="sandbox-balance-value">
                    <AnimatedCurrency value={simBalance} />
                  </strong>
                </div>
                <button type="button" className="sandbox-reset-btn" onClick={handleSandboxReset} title="Reset sample balance">
                  ↺ Reset
                </button>
              </div>
              <div className="sandbox-chip-prompt">Tap an expense to test instant logging:</div>
              <div className="sandbox-presets">
                {SANDBOX_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="sandbox-preset-btn"
                    onClick={() => handleSandboxSpend(preset)}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                    <strong>−₱{preset.amount}</strong>
                  </button>
                ))}
              </div>
              <ul className="sandbox-mini-feed" aria-label="Sample recent transactions">
                {simLogs.map((item) => (
                  <li key={item.id} className="sandbox-feed-item">
                    <span>{item.icon} {item.label}</span>
                    <span className="sandbox-feed-amount">−{formatCurrency(item.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {previewTab === 'budget' && (
            <div className="sandbox-panel" key="budget">
              <div className="sandbox-balance-row">
                <div>
                  <span className="sandbox-label">Safe to spend today</span>
                  <strong className="sandbox-balance-value">
                    <AnimatedCurrency value={simSafeDaily} />
                    <small className="sandbox-per-day"> / day</small>
                  </strong>
                </div>
                <span className="sandbox-status-pill">12 days left</span>
              </div>
              <div className="sandbox-chip-prompt">Pick a monthly budget limit:</div>
              <div className="sandbox-budget-options">
                {[1200, 1500, 2500, 3500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`sandbox-budget-btn ${simBudget === amt ? 'active' : ''}`}
                    onClick={() => { setSimBudget(amt); triggerMascotReaction(); }}
                  >
                    ₱{amt.toLocaleString()}
                  </button>
                ))}
              </div>
              <ProgressBar value={simSpentTotal} max={simBudget} label="Sample monthly budget used" />
              <div className="sandbox-meta-row">
                <span>{formatCurrency(simSpentTotal)} spent</span>
                <span>{formatCurrency(Math.max(0, simBudget - simSpentTotal))} remaining</span>
              </div>
            </div>
          )}

          {previewTab === 'goal' && (
            <div className="sandbox-panel" key="goal">
              <div className="sandbox-balance-row">
                <div>
                  <span className="sandbox-label">💻 Laptop Upgrade Goal</span>
                  <strong className="sandbox-balance-value">
                    <AnimatedCurrency value={simGoalSaved} /> <small className="sandbox-per-day">/ {formatCurrency(simGoalTarget)}</small>
                  </strong>
                </div>
                <span className="sandbox-status-pill">{simGoalPct >= 100 ? '🎉 Reached!' : `${simGoalPct}%`}</span>
              </div>
              <ProgressBar value={simGoalSaved} max={simGoalTarget} tone="success" label="Sample goal progress" />
              <div className="sandbox-goal-actions">
                <button
                  type="button"
                  className="sandbox-coin-drop-btn"
                  onClick={() => {
                    setSimGoalSaved((s) => (s >= simGoalTarget ? 450 : Math.min(simGoalTarget, s + 150)));
                    triggerMascotReaction();
                  }}
                >
                  {simGoalSaved >= simGoalTarget ? '↺ Restart Goal Jar' : '🪙 + Drop ₱150 into Savings Jar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Interactive Mascot Stage */}
        <div
          className="auth-mascot-interactive"
          role="button"
          tabIndex={0}
          onClick={() => triggerMascotReaction()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), triggerMascotReaction())}
          aria-label="PESO Coin Companion. Click for a student money tip."
        >
          <div className="auth-mascot-coin">
            <PixelCompanion mood={simGoalPct >= 100 ? 'cheering' : 'happy'} excited={mascotExcited} />
          </div>
          <div className="auth-mascot-bubble" key={tipIndex}>
            <span className="mascot-bubble-tag">PESO Companion · Tap me!</span>
            <p>{LANDING_TIPS[tipIndex]}</p>
          </div>
        </div>
      </div>

      <main className="auth-card spotlight-surface" onPointerMove={handlePointerMove}>
        <div className="auth-card-header-row">
          <div className="badge-pill">
            <span className="badge-dot" aria-hidden="true" /> PESO ACCOUNT
          </div>
          <button
            type="button"
            className="theme-toggle-btn small"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className="theme-toggle-icon" aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        <div className="auth-card-heading" key={`heading-${mode}`}>
          <h2>{heading.title}</h2>
          <p>{heading.sub}</p>
        </div>

        {mode !== 'reset' && (
          <div className="auth-toggle" role="group" aria-label="Choose sign in or sign up">
            <button type="button" className={mode === 'login' ? 'active' : ''} aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>
              I have an account
            </button>
            <button type="button" className={mode === 'register' ? 'active' : ''} aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>
              I’m new here
            </button>
          </div>
        )}

        {error && <div className="form-error" role="alert"><span aria-hidden="true">⚠️</span> {error}</div>}

        {mode === 'login' && (
          <form className="stack auth-form-panel" key="login-form" onSubmit={submit}>
            <Field label="Email">
              {(p) => <input {...p} name="email" type="email" placeholder="you@school.edu.ph" autoComplete="username" value={form.email} onChange={(e) => update('email')(e.target.value)} required />}
            </Field>
            <Field label="Password">
              {(p) => <PasswordInput id={p.id} value={form.password} onChange={update('password')} autoComplete="current-password" />}
            </Field>
            <button type="submit" className="primary-btn auth-submit-btn" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to PESO →'}
            </button>
            <button type="button" className="link-btn" onClick={() => { setMode('reset'); setError(''); setReset((r) => ({ ...r, email: form.email })); }}>
              Forgot your password?
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form className="stack auth-form-panel" key="register-form" onSubmit={submit}>
            <Field label="Your name" hint="We’ll use this to greet you.">
              {(p) => <input {...p} name="name" type="text" placeholder="e.g. Sam" autoComplete="name" value={form.name} onChange={(e) => update('name')(e.target.value)} required />}
            </Field>
            <Field label="Email">
              {(p) => <input {...p} name="email" type="email" placeholder="you@school.edu.ph" autoComplete="email" value={form.email} onChange={(e) => update('email')(e.target.value)} required />}
            </Field>
            <Field label="Password" hint="At least 6 characters.">
              {(p) => <PasswordInput id={p.id} describedBy={p['aria-describedby']} value={form.password} onChange={update('password')} autoComplete="new-password" minLength={6} />}
            </Field>
            <button type="submit" className="primary-btn auth-submit-btn" disabled={busy}>
              {busy ? 'Creating account…' : 'Create my account →'}
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form className="stack auth-form-panel" key="reset-form" onSubmit={submitReset}>
            <ol className="steps" aria-label="Reset progress">
              <li className={reset.step === 1 ? 'active' : 'done'} aria-current={reset.step === 1 ? 'step' : undefined}>1. Your email</li>
              <li className={reset.step === 2 ? 'active' : ''} aria-current={reset.step === 2 ? 'step' : undefined}>2. New password</li>
            </ol>
            {reset.step === 1 ? (
              <Field label="Email">
                {(p) => <input {...p} type="email" autoComplete="username" value={reset.email} onChange={(e) => setReset((r) => ({ ...r, email: e.target.value }))} required />}
              </Field>
            ) : (
              <>
                <Field label="Reset code" hint="Normally this would be emailed to you. In local mode it is filled in automatically.">
                  {(p) => <input {...p} type="text" value={reset.token} onChange={(e) => setReset((r) => ({ ...r, token: e.target.value }))} required />}
                </Field>
                <Field label="New password" hint="At least 6 characters.">
                  {(p) => <PasswordInput id={p.id} describedBy={p['aria-describedby']} value={reset.password} onChange={(v) => setReset((r) => ({ ...r, password: v }))} autoComplete="new-password" minLength={6} />}
                </Field>
              </>
            )}
            <button type="submit" className="primary-btn auth-submit-btn" disabled={busy}>
              {busy ? 'Please wait…' : reset.step === 1 ? 'Get reset code' : 'Save new password'}
            </button>
            <button type="button" className="link-btn" onClick={() => { setMode('login'); setError(''); setReset({ step: 1, email: '', token: '', password: '' }); }}>
              ← Back to sign in
            </button>
          </form>
        )}

        {mode !== 'reset' && (
          <div className="auth-demo">
            <div className="auth-demo-copy">
              <strong>🪙 Just looking around?</strong>
              <span>Explore PESO with preloaded sample data — no sign-up needed.</span>
            </div>
            <button
              type="button"
              className="secondary-btn auth-demo-btn"
              disabled={busy}
              onClick={startDemo}
            >
              {busy ? 'Starting demo…' : '🚀 Try the demo'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Help guide                                                          */
/* ------------------------------------------------------------------ */

const GUIDE_STEPS = [
  {
    icon: '👛',
    title: 'Balance = the money you have right now',
    text: 'Start by entering how much cash and e-wallet money you currently have. PESO keeps it up to date as you log things.',
  },
  {
    icon: '💰',
    title: 'Income adds to your balance',
    text: 'Allowance, salary, scholarship or gifts. Log it when you receive it.',
  },
  {
    icon: '💸',
    title: 'Expenses subtract from your balance',
    text: 'Log what you buy, even small things like fare and snacks — they add up. Made a mistake? Edit or delete it and your balance is corrected.',
  },
  {
    icon: '📊',
    title: 'A budget is your spending limit',
    text: 'Pick the most you want to spend this month. PESO tells you how much you can safely spend per day and warns you before you go over. It does not move money.',
  },
  {
    icon: '🎯',
    title: 'Savings goals hold money aside',
    text: '“Add money” moves pesos from your balance into a goal so you don’t accidentally spend them. “Take out” moves them back.',
  },
];

export function HelpGuide({ open, onClose, onStart }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="guide-title" className="guide-modal">
      <div className="eyebrow lime">Quick guide · 1 minute read</div>
      <h2 id="guide-title">How PESO works</h2>
      <ol className="guide-list">
        {GUIDE_STEPS.map((step) => (
          <li key={step.title}>
            <span className="guide-icon" aria-hidden="true">{step.icon}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="guide-flow" aria-label="Money flow summary">
        <span>💰 Income</span><span aria-hidden="true">→</span>
        <span>👛 Balance</span><span aria-hidden="true">→</span>
        <span>💸 Expenses</span>
        <span className="guide-flow-split">👛 Balance <span aria-hidden="true">⇄</span> 🎯 Savings</span>
      </div>
      <div className="modal-actions">
        <button type="button" className="small-btn" onClick={onClose}>Close</button>
        <button type="button" className="primary-btn" onClick={onStart}>Got it — let’s start</button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Getting-started checklist                                           */
/* ------------------------------------------------------------------ */

export function GettingStarted({ steps, onDismiss }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section className="panel checklist-panel" aria-labelledby="checklist-title">
      <div className="panel-heading-row">
        <div>
          <h2 className="panel-title" id="checklist-title">Get set up — {done} of {steps.length} done</h2>
          <p className="tiny-note">Finish these steps and PESO can give you useful advice.</p>
        </div>
        <button type="button" className="link-btn" onClick={onDismiss}>Hide</button>
      </div>
      <ProgressBar value={done} max={steps.length} tone="success" label="Setup progress" />
      <ol className="checklist">
        {steps.map((step) => (
          <li key={step.id} className={step.done ? 'done' : ''}>
            <span className="check-mark" aria-hidden="true">{step.done ? '✓' : ''}</span>
            <div className="checklist-text">
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </div>
            {step.done ? (
              <span className="checklist-status">Done</span>
            ) : (
              <button type="button" className="small-btn" onClick={step.onClick}>{step.cta}</button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard alerts                                                    */
/* ------------------------------------------------------------------ */

export function FinancialAlerts({ dashboard, onNavigate }) {
  const alerts = [];
  const budget = dashboard?.budget;
  const hasBudget = budget && budget.totalLimit > 0;

  if (hasBudget) {
    const usage = budget.usagePercent || 0;
    if (budget.remaining < 0) {
      alerts.push({ tone: 'danger', title: 'You’re over budget', detail: `You’ve spent ${formatCurrency(Math.abs(budget.remaining))} more than your monthly limit.`, action: { label: 'Review budget', view: 'budgets' } });
    } else if (usage >= 80) {
      alerts.push({ tone: 'warning', title: 'Budget almost used up', detail: `${usage.toFixed(0)}% used — only ${formatCurrency(budget.remaining)} left this month.`, action: { label: 'See spending', view: 'expenses' } });
    }

    Object.entries(budget.categoryLimits || {}).forEach(([category, limit]) => {
      const spent = Number(budget.categorySpent?.[category] || 0);
      if (Number(limit) > 0 && spent > Number(limit)) {
        alerts.push({ tone: 'danger', title: `${categoryIcon(category)} ${category} is over its limit`, detail: `${formatCurrency(spent - Number(limit))} above the ${formatCurrency(limit)} you planned.`, action: { label: 'Adjust limit', view: 'budgets' } });
      } else if (Number(limit) > 0 && spent >= Number(limit) * 0.85) {
        alerts.push({ tone: 'warning', title: `${categoryIcon(category)} ${category} is almost at its limit`, detail: `${formatCurrency(Number(limit) - spent)} left of ${formatCurrency(limit)}.` });
      }
    });
  } else {
    alerts.push({ tone: 'info', title: 'No budget yet', detail: 'Set a monthly limit and PESO will tell you how much you can spend per day.', action: { label: 'Set budget', view: 'budgets' } });
  }

  if (Number(dashboard?.balance || 0) < 0) {
    alerts.push({ tone: 'danger', title: 'Your balance is negative', detail: 'You’ve logged more spending than money. Did you forget to log some income?', action: { label: 'Add income', view: 'income' } });
  } else if (Number(dashboard?.balance || 0) === 0) {
    alerts.push({ tone: 'warning', title: 'Balance is ₱0', detail: 'Enter how much money you have now, or log your income.', action: { label: 'Add income', view: 'income' } });
  } else if (hasBudget && budget.remaining > 0 && dashboard.balance < budget.remaining) {
    alerts.push({ tone: 'warning', title: 'Budget is bigger than your balance', detail: `Your budget allows ${formatCurrency(budget.remaining)} more, but you only have ${formatCurrency(dashboard.balance)}.`, action: { label: 'Adjust budget', view: 'budgets' } });
  }

  (dashboard?.goals || []).forEach((goal) => {
    if (!goal.targetDate || Number(goal.currentAmount) >= Number(goal.targetAmount)) return;
    const daysLeft = Math.ceil((new Date(goal.targetDate) - new Date()) / 86400000);
    if (daysLeft < 0) {
      alerts.push({ tone: 'warning', title: `🎯 ${goal.name} passed its target date`, detail: 'Pick a new date or add money to finish it.', action: { label: 'Open savings', view: 'goals' } });
      return;
    }
    const perWeek = ((Number(goal.targetAmount) - Number(goal.currentAmount)) / Math.max(1, daysLeft)) * 7;
    if (daysLeft <= 30) {
      alerts.push({ tone: 'warning', title: `🎯 ${goal.name}: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`, detail: `Save about ${formatCurrency(perWeek)} per week to reach it on time.`, action: { label: 'Add money', view: 'goals' } });
    }
  });

  if (!alerts.length) {
    alerts.push({ tone: 'positive', title: 'You’re on track 👍', detail: 'Nothing needs your attention right now. Keep logging your spending.' });
  }

  return (
    <section className="alerts-panel" aria-labelledby="alerts-title">
      <div className="alerts-heading">
        <h2 className="eyebrow lime" id="alerts-title">What needs your attention</h2>
        <span>{alerts.length} item{alerts.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="alerts-list">
        {alerts.slice(0, 4).map((alert, index) => (
          <li className={`alert-item alert-${alert.tone}`} key={`${alert.title}-${index}`}>
            <span className="alert-dot" aria-hidden="true" />
            <div>
              <strong>{alert.title}</strong>
              <p>{alert.detail}</p>
              {alert.action && (
                <button type="button" className="alert-action" onClick={() => onNavigate(alert.action.view)}>
                  {alert.action.label} →
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

export function MonthlyTrendChart({ monthlyStats = [], compact = false }) {
  const stats = Array.isArray(monthlyStats) ? monthlyStats : [];
  const [selectedKey, setSelectedKey] = useState(null);
  const maxValue = Math.max(...stats.map((item) => item.total), 1);
  const width = 720;
  const height = 250;
  const padding = { top: 28, right: 24, bottom: 42, left: 24 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const points = stats.map((item, index) => {
    const x = padding.left + (stats.length === 1 ? chartWidth / 2 : (index / (stats.length - 1)) * chartWidth);
    const y = padding.top + chartHeight - (item.total / maxValue) * chartHeight;
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const currentMonth = stats[stats.length - 1];
  const previousMonth = stats[stats.length - 2];
  const hasPrevious = Boolean(previousMonth?.total);
  const change = hasPrevious ? ((currentMonth.total - previousMonth.total) / previousMonth.total) * 100 : 0;
  const focusedMonth = points.find((p) => p.key === selectedKey) || currentMonth;

  return (
    <section className={`panel trend-panel ${compact ? 'trend-panel-compact' : ''}`} aria-labelledby={`trend-title-${compact ? 'c' : 'f'}`}>
      <div className="panel-heading-row">
        <div>
          <h2 className="panel-title" id={`trend-title-${compact ? 'c' : 'f'}`}>Spending per month</h2>
          <p className="tiny-note">Last 6 months · tap a point to inspect</p>
        </div>
        {hasPrevious ? (
          <div className={`trend-change ${change > 0 ? 'negative' : 'positive'}`}>
            {change > 0 ? '▲ ' : '▼ '}{Math.abs(change).toFixed(0)}% {change > 0 ? 'more' : 'less'} than last month
          </div>
        ) : (
          <div className="trend-change positive">No data for last month yet</div>
        )}
      </div>
      <div className="trend-summary">
        <div>
          <span>{selectedKey && focusedMonth ? `${focusedMonth.label} spent` : 'This month so far'}</span>
          <strong><AnimatedCurrency value={focusedMonth?.total || 0} /></strong>
        </div>
        <div>
          <span>Last month</span>
          <strong>{formatCurrency(previousMonth?.total || 0)}</strong>
        </div>
      </div>
      <div className="line-chart-wrap">
        <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Monthly spending: ${stats.map((s) => `${s.label} ${formatCurrency(s.total)}`).join(', ')}`}>
          <defs>
            <linearGradient id={`trend-fill-${compact ? 'c' : 'f'}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => {
            const y = padding.top + (line / 3) * chartHeight;
            return <line key={line} x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid-line" />;
          })}
          {points.length > 1 && (
            <path
              d={`${path} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`}
              fill={`url(#trend-fill-${compact ? 'c' : 'f'})`}
            />
          )}
          <path d={path} className="trend-line" fill="none" />
          {points.map((point) => {
            const isSelected = selectedKey === point.key;
            return (
              <g
                key={point.key}
                className={`trend-point-group ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedKey((k) => (k === point.key ? null : point.key))}
                onMouseEnter={() => setSelectedKey(point.key)}
                onMouseLeave={() => setSelectedKey(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={point.x} cy={point.y} r="16" fill="transparent" />
                {isSelected && <circle cx={point.x} cy={point.y} r="11" className="trend-point-halo" />}
                <circle cx={point.x} cy={point.y} r={isSelected ? '7' : '5'} className="trend-point" />
                {point.total > 0 && (
                  <text x={point.x} y={point.y - 13} textAnchor="middle" className="chart-value">
                    ₱{Math.round(point.total).toLocaleString('en-PH')}
                  </text>
                )}
                <text x={point.x} y={height - 14} textAnchor="middle" className="chart-label">{point.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

export function WeeklySpendingReview({ expenses = [] }) {
  const [activeDayKey, setActiveDayKey] = useState(null);
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const todayKey = localDateKey(today);

  const weeklyStats = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = localDateKey(date);
    const dayItems = expenses.filter((e) => entryDateKey(e.date) === key);
    return {
      key,
      label: date.toLocaleDateString('en-PH', { weekday: 'short' }),
      total: dayItems.reduce((sum, e) => sum + Number(e.amount), 0),
      count: dayItems.length,
    };
  });
  const weekTotal = weeklyStats.reduce((sum, day) => sum + day.total, 0);
  const maxValue = Math.max(...weeklyStats.map((day) => day.total), 1);
  const activeDay = weeklyStats.find((d) => d.key === activeDayKey);

  return (
    <section className="panel trend-panel weekly-panel" aria-labelledby="weekly-title">
      <div className="panel-heading-row">
        <div>
          <h2 className="panel-title" id="weekly-title">This week</h2>
          <p className="tiny-note">
            {activeDay
              ? `${activeDay.key === todayKey ? 'Today' : activeDay.label}: ${formatCurrency(activeDay.total)} (${activeDay.count} expense${activeDay.count === 1 ? '' : 's'})`
              : 'Tap or hover a day (Mon–Sun)'}
          </p>
        </div>
        <div className="weekly-total"><AnimatedCurrency value={weekTotal} /></div>
      </div>
      <ul className="weekly-bars">
        {weeklyStats.map((day) => {
          const isSelected = activeDayKey === day.key;
          return (
            <li
              className={`weekly-bar-column ${day.key === todayKey ? 'is-today' : ''} ${isSelected ? 'is-active' : ''}`}
              key={day.key}
              title={`${day.label}: ${formatCurrency(day.total)}`}
              onClick={() => setActiveDayKey((k) => (k === day.key ? null : day.key))}
              onMouseEnter={() => setActiveDayKey(day.key)}
              onMouseLeave={() => setActiveDayKey(null)}
            >
              <span className="weekly-bar-amount">{day.total ? `₱${Math.round(day.total)}` : ''}</span>
              <div className="weekly-bar-track">
                <div className="weekly-bar-fill" style={{ height: `${Math.max((day.total / maxValue) * 100, day.total ? 8 : 2)}%` }} />
              </div>
              <span>{day.key === todayKey ? 'Today' : day.label}</span>
              <span className="visually-hidden">{formatCurrency(day.total)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Transaction list grouped by day                                     */
/* ------------------------------------------------------------------ */

export function TransactionGroups({ items, kind, onEdit, onDelete, emptyState }) {
  if (!items.length) return emptyState;

  const groups = [];
  items.forEach((item) => {
    const key = entryDateKey(item.date);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, items: [], total: 0 };
      groups.push(group);
    }
    group.items.push(item);
    group.total += Number(item.amount);
  });

  return (
    <div className="day-groups">
      {groups.map((group) => (
        <section key={group.key} className="day-group" aria-label={formatDayLabel(group.key)}>
          <div className="day-header">
            <span>{formatDayLabel(group.key)}</span>
            <span>{kind === 'income' ? '+' : ''}{formatCurrency(group.total)}</span>
          </div>
          <ul className="list-stack">
            {group.items.map((item) => {
              const title = kind === 'income' ? item.source : item.category;
              const icon = kind === 'income' ? sourceIcon(item.source) : categoryIcon(item.category);
              return (
                <li key={item.id} className="list-item">
                  <span className="list-icon" aria-hidden="true">{icon}</span>
                  <div className="list-item-info">
                    <div className="list-item-title">{item.note || title}</div>
                    <div className="tiny-note">{item.note ? title : 'No note'}</div>
                  </div>
                  <span className={`amount-tag ${kind === 'income' ? 'income' : ''}`}>
                    {kind === 'income' ? '+' : '−'}{formatCurrency(item.amount)}
                  </span>
                  <div className="list-actions">
                    {onEdit && (
                      <button type="button" className="small-btn" onClick={() => onEdit(item)}>
                        Edit<span className="visually-hidden"> {title} {formatCurrency(item.amount)}</span>
                      </button>
                    )}
                    <button type="button" className="small-btn danger" onClick={() => onDelete(item)}>
                      Delete<span className="visually-hidden"> {title} {formatCurrency(item.amount)}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export { EmptyState };
