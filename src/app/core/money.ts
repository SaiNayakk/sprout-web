/**
 * Money is a decimal string in rupees everywhere in Sprout ("1450.50"), never a float, so nothing here
 * does arithmetic on it: it is only ever shown. Indian digit grouping: ₹1,00,000.
 */
const GROUPED = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WHOLE = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** "₹1,45,000.50" from "145000.5". Missing or unreadable values show a dash, not NaN. */
export function inr(amount: string | number | null | undefined, whole = false): string {
  const n = toNumber(amount);
  if (n === null) {
    return '–';
  }
  return '₹' + (whole ? WHOLE : GROUPED).format(n);
}

/** "+₹1,200.00 ▲" or "−₹35.00 ▼": always a sign and an arrow, so a loss is never only a colour. */
export function signedInr(amount: string | number | null | undefined): string {
  const n = toNumber(amount);
  if (n === null) {
    return '–';
  }
  if (n === 0) {
    return '₹0.00';
  }
  return (n > 0 ? '+' : '−') + '₹' + GROUPED.format(Math.abs(n)) + (n > 0 ? ' ▲' : ' ▼');
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '–';
  }
  return (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value).toFixed(2) + '%';
}

/** The class that colours a change: gain, loss, or none. */
export function direction(value: string | number | null | undefined): 'gain' | 'loss' | '' {
  const n = toNumber(value);
  return n === null || n === 0 ? '' : n > 0 ? 'gain' : 'loss';
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** A rupee amount typed by a person, as the string the API wants, or null if it isn't one. "1,500" is 1500.00. */
export function amountToApi(typed: string): string | null {
  const t = typed.trim().replace(/[₹,\s]/g, '');
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(t)) {
    return null;
  }
  const [rupees, paise = ''] = t.split('.');
  return rupees.replace(/^0+(?=\d)/, '') + '.' + paise.padEnd(2, '0');
}

/**
 * Whole paise from a rupee amount, for the few sums a screen shows (a portfolio total). Display only:
 * the services work out the real numbers, and these sums are in integers so they never drift by a paisa.
 */
export function paise(amount: string | number | null | undefined): number {
  const n = toNumber(amount);
  return n === null ? 0 : Math.round(n * 100);
}

/** Rupees as the two-decimal string {@link inr} reads, from whole paise. */
export function fromPaise(p: number): string {
  const sign = p < 0 ? '-' : '';
  const abs = Math.abs(Math.round(p));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
