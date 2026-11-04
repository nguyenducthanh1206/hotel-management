import { currency as curNow, lang as langNow } from './prefs.js';

// Tỷ giá THAM KHẢO để hiển thị (VND cho 1 đơn vị ngoại tệ). Giá gốc và hóa đơn luôn tính bằng VND.
export const VND_PER_UNIT = { VND: 1, USD: 25500, EUR: 29500, JPY: 170 };
export const CURRENCIES = Object.keys(VND_PER_UNIT);
const LOCALE = { vi: 'vi-VN', en: 'en-US' };
export const locale = () => LOCALE[langNow()] || 'vi-VN';

export function money(n, cur = curNow()) {
  const v = (n ?? 0) / VND_PER_UNIT[cur];
  const d = cur === 'USD' || cur === 'EUR' ? 2 : 0;
  return new Intl.NumberFormat(locale(), { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
}
export const moneyVnd = (n) => money(n, 'VND');
export const moneyCompact = (n) =>
  new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format((n ?? 0) / VND_PER_UNIT[curNow()]);

const parse = (iso) => new Date(iso.slice(0, 10) + 'T00:00:00');
const dloc = () => (langNow() === 'en' ? 'en-GB' : 'vi-VN');
export const fmtDate = (d) =>
  d ? parse(d).toLocaleDateString(dloc(), langNow() === 'en' ? { day: '2-digit', month: 'short', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
export const fmtDay = (d) => (d ? parse(d).toLocaleDateString(dloc(), { day: '2-digit', month: '2-digit' }) : '');
export const fmtDateTime = (d) => (d ? `${fmtDate(d)} ${d.slice(11, 16)}` : '');
export const weekday = (d, style = 'short') => parse(d).toLocaleDateString(dloc(), { weekday: style });
export const monthTitle = (y, m) => new Date(Date.UTC(y, m, 1)).toLocaleDateString(dloc(), { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const isoToday = (add = 0) => new Date(Date.now() + 7 * 3600 * 1000 + add * 86400000).toISOString().slice(0, 10); // giờ Việt Nam
export const addDaysIso = (iso, n) => new Date(Date.parse(iso.slice(0, 10)) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);
