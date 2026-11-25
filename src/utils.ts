import type { DealWithTotals } from './types';

export const fmtMoney = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : 'Rs ' + Math.round(n).toLocaleString('en-US');

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseNum(s: string): number | null {
  const t = s.replace(/[^0-9.\-]/g, '');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseIntOrNull(s: string): number | null {
  const n = parseNum(s);
  return n === null ? null : Math.trunc(n);
}

export const textOrNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

export function formatCnic(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

export function formatPhone(v: string): string {
  let d = v.replace(/\D/g, '');
  if (d.startsWith('92') && d.length >= 12) d = '0' + d.slice(2);
  else if (d.startsWith('3') && d.length >= 10) d = '0' + d;
  d = d.slice(0, 11);
  return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4)}`;
}

export const normalizeReg = (s: string | null | undefined): string => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const regOf = (d: Pick<DealWithTotals, 'registration_number'>): string => d.registration_number || 'No reg #';

export function totalCost(d: DealWithTotals): number {
  return (d.purchase_price ?? 0) + (d.total_expenses ?? 0) + (d.transfer_cost ?? 0);
}

export function netProfit(d: DealWithTotals): number | null {
  if (d.status !== 'SOLD' || d.sale_price === null || d.purchase_price === null) return null;
  return d.sale_price - totalCost(d);
}

export function sellerBalanceDue(d: Pick<DealWithTotals, 'purchase_price' | 'paid_to_seller'>): number | null {
  if (d.purchase_price === null) return null;
  return Math.max(0, d.purchase_price - (d.paid_to_seller ?? 0));
}

export function buyerBalanceDue(d: Pick<DealWithTotals, 'status' | 'sale_price' | 'received_from_buyer'>): number | null {
  if (d.status !== 'SOLD' || d.sale_price === null) return null;
  return Math.max(0, d.sale_price - (d.received_from_buyer ?? 0));
}

export const carTitle = (d: Pick<DealWithTotals, 'make' | 'model' | 'variant' | 'year'>): string =>
  [d.year, d.make, d.model, d.variant].filter(Boolean).join(' ') || 'Unnamed car';

export function matchesQuery(d: DealWithTotals, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const squash = (s: string) => s.replace(/[\s\-]/g, '');
  const hay = [
    d.registration_number, `${d.make ?? ''} ${d.model ?? ''}`, d.variant, d.bought_from_location,
    d.seller_name, d.seller_contact, d.seller_address,
    d.purchaser_name, d.purchaser_contact, d.purchaser_address,
    d.chassis_number, d.engine_number,
  ]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase();
  return needle.split(/\s+/).every((w) => hay.includes(w) || squash(hay).includes(squash(w)));
}

export function formatMoneyInput(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 13).replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const moneyToInput = (n: number | null | undefined): string =>
  n === null || n === undefined ? '' : formatMoneyInput(String(Math.round(n)));

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n: number): string => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const below1000 = (n: number): string =>
  [Math.floor(n / 100) ? ONES[Math.floor(n / 100)] + ' Hundred' : '', n % 100 ? below100(n % 100) : ''].filter(Boolean).join(' ');

export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (!Number.isFinite(n) || n === 0) return '';
  const units: [number, string, string][] = [
    [1e11, 'Kharab', 'Kharab'], [1e9, 'Arab', 'Arab'], [1e7, 'Crore', 'Crore'], [1e5, 'Lac', 'Lacs'], [1e3, 'Thousand', 'Thousand'],
  ];
  const parts: string[] = [];
  for (const [size, one, many] of units) {
    const q = Math.floor(n / size);
    n %= size;
    if (q > 0) parts.push(`${below1000(q)} ${q === 1 ? one : many}`);
  }
  if (n > 0) parts.push(below1000(n));
  return parts.join(' ');
}
