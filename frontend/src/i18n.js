import { EN } from './dict.en.js';
import { lang } from './prefs.js';

const fill = (s, p) => s.replace(/\{(\w+)\}/g, (_, k) => (p && p[k] !== undefined ? p[k] : `{${k}}`));

// Khóa có {tham số} cũng dùng để dịch thông báo lỗi từ máy chủ (tiếng Việt, có chèn số liệu).
const patterns = Object.keys(EN)
  .filter((k) => k.includes('{'))
  .map((key) => ({
    key,
    names: [...key.matchAll(/\{(\w+)\}/g)].map((m) => m[1]),
    re: new RegExp('^' + key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '(.+?)') + '$', 's')
  }));

/** Văn bản tiếng Việt là khóa. Ở chế độ tiếng Anh tra từ điển, thiếu thì giữ nguyên tiếng Việt. */
export function t(key, params) {
  if (lang() === 'vi') return fill(key, params);
  const tpl = EN[key];
  return fill(tpl !== undefined ? tpl : key, params);
}

/** Dịch một thông báo của máy chủ. */
export function tr(msg) {
  if (lang() === 'vi' || !msg) return msg;
  if (EN[msg] !== undefined) return EN[msg];
  for (const p of patterns) {
    const m = msg.match(p.re);
    if (m) {
      const params = {};
      p.names.forEach((n, i) => { params[n] = t(m[i + 1]); });
      return fill(EN[p.key], params);
    }
  }
  return msg;
}
