// Number and time formatting for the screens.

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e5) return `${(n / 1e3).toFixed(0)}k`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return Math.floor(n).toLocaleString('en-US');
}

/** Credits: one decimal under 100, so cheap items don't all read "1". */
export function money(n: number): string {
  return Math.abs(n) < 100 ? (Math.round(n * 10) / 10).toLocaleString('en-US') : fmt(n);
}

export const pct = (f: number, digits = 0): string => `${(f * 100).toFixed(digits)}%`;

export function duration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 1) return `${Math.max(0, Math.round(ms / 1000))}s`;
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

/** Escape text for HTML. Item names are ours, but the log can hold anything. */
export const esc = (t: string): string =>
  t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
