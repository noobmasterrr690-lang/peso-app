import { useEffect, useId, useRef } from 'react';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const CATEGORIES = [
  { id: 'Food', icon: '🍔', hint: 'Meals, snacks, drinks, groceries' },
  { id: 'Transport', icon: '🚌', hint: 'Jeepney, bus, tricycle, Grab, gas' },
  { id: 'Entertainment', icon: '🎮', hint: 'Movies, games, hangouts, subscriptions' },
  { id: 'Study', icon: '📚', hint: 'Books, printing, school supplies, fees' },
  { id: 'Utilities', icon: '💡', hint: 'Load, internet, bills, laundry' },
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const categoryIcon = (id) => CATEGORIES.find((c) => c.id === id)?.icon || '🧾';

export const INCOME_SOURCES = [
  { id: 'Allowance', icon: '👪' },
  { id: 'Part-time Job', icon: '💼' },
  { id: 'Scholarship', icon: '🎓' },
  { id: 'Gift', icon: '🎁' },
  { id: 'Savings', icon: '🏦' },
  { id: 'Other', icon: '➕' },
];
export const sourceIcon = (id) => INCOME_SOURCES.find((s) => s.id === id)?.icon || '💰';

export const QUICK_EXPENSE_PRESETS = [
  { label: 'Jeepney fare', amount: 15, category: 'Transport', note: 'Jeepney fare' },
  { label: 'Student meal', amount: 75, category: 'Food', note: 'Campus lunch' },
  { label: 'Coffee / drink', amount: 50, category: 'Food', note: 'Coffee / drink' },
  { label: 'Printing', amount: 20, category: 'Study', note: 'Printing / xerox' },
];

/* ------------------------------------------------------------------ */
/* Formatting & dates                                                  */
/* ------------------------------------------------------------------ */

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (what the user sees as "today"). */
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Entries are saved from a YYYY-MM-DD string, so their UTC date is the date the user picked. */
export function entryDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export const currentMonthKey = () => localDateKey().slice(0, 7);

export function monthKeyOffset(offset) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function formatMonthName(monthKey) {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export function formatDayLabel(key) {
  const today = localDateKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === today) return 'Today';
  if (key === localDateKey(yesterday)) return 'Yesterday';
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: key.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
  });
}

export function formatShortDate(value) {
  return new Date(`${entryDateKey(value)}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function daysLeftInMonth() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.max(1, end.getDate() - now.getDate() + 1);
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Can’t reach the PESO server. Make sure it is running, then try again.');
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* UI building blocks                                                  */
/* ------------------------------------------------------------------ */

export function AmbientShapes() {
  return (
    <div className="ambient-shapes" aria-hidden="true">
      <span className="shape shape-ring" />
      <span className="shape shape-diamond" />
    </div>
  );
}

export function PixelCompanion({ compact = false }) {
  return (
    <div className={`coin-stage ${compact ? 'coin-stage-compact' : ''}`} aria-hidden="true">
      <div className="coin-aura" />
      <div className="pixel-companion">
        <span className="edge-coin edge-coin-one">₱</span>
        <span className="edge-coin edge-coin-two">₱</span>
        <span className="edge-coin edge-coin-three">₱</span>
        <div className="pixel-coin-body">
          <span className="pixel-shine" />
          <span className="pixel-eye pixel-eye-left" />
          <span className="pixel-eye pixel-eye-right" />
          <span className="pixel-smile" />
          <span className="pixel-peso">₱</span>
        </div>
      </div>
    </div>
  );
}

/** Label + optional helper text wrapped around a single control. */
export function Field({ label, hint, optional = false, children, id: providedId }) {
  const autoId = useId();
  const id = providedId || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const child = typeof children === 'function' ? children({ id, 'aria-describedby': hintId }) : children;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {optional && <span className="field-optional"> (optional)</span>}
      </label>
      {child}
      {hint && <div className="field-hint" id={hintId}>{hint}</div>}
    </div>
  );
}

/** Peso amount input with a visible ₱ prefix. */
export function AmountInput({ id, value, onChange, required = true, min = '0.01', autoFocus = false, describedBy, placeholder = '0.00' }) {
  const inputRef = useRef(null);

  function handleChange(e) {
    const raw = e.target.value;
    // Allow numbers and at most one decimal point; accept comma as dot
    const sanitized = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;
    onChange(clean);
  }

  return (
    <div className="amount-input" onClick={() => inputRef.current?.focus()}>
      <span aria-hidden="true">₱</span>
      <input
        ref={inputRef}
        id={id}
        name="amount"
        type="text"
        inputMode="decimal"
        value={value ?? ''}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        aria-describedby={describedBy}
        autoComplete="off"
      />
    </div>
  );
}

/** Visible single-choice chips (radio buttons under the hood). */
export function ChoiceChips({ legend, name, options, value, onChange, hint }) {
  const hintId = useId();
  return (
    <fieldset className="field choice-fieldset" aria-describedby={hint ? hintId : undefined}>
      <legend className="field-label">{legend}</legend>
      <div className="choice-chips">
        {options.map((option) => (
          <label key={option.id} className={`choice-chip ${value === option.id ? 'selected' : ''}`} title={option.hint}>
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <span aria-hidden="true">{option.icon}</span>
            {option.id}
          </label>
        ))}
      </div>
      {hint && <div className="field-hint" id={hintId}>{hint}</div>}
    </fieldset>
  );
}

/** Native <dialog> modal: Esc closes, focus is trapped by the browser, backdrop click closes. */
export function Modal({ open, onClose, labelledBy, className = '', children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // Fallback if already opened or unhandled
      }
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

export function ToastArea({ toasts, onDismiss }) {
  return (
    <div className="toast-area" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <span className="toast-icon" aria-hidden="true">
            {toast.tone === 'error' ? '⚠️' : toast.tone === 'info' ? 'ℹ️' : '✅'}
          </span>
          <span className="toast-text">{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action.onClick();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className="toast-close" aria-label="Dismiss message" onClick={() => onDismiss(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value, max, tone = '', label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="budget-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <div className={`progress-bar ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
