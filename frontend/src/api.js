import { t, tr } from './i18n.js';

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error(t('Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa.'));
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    if (res.status === 401 && token) { localStorage.removeItem('token'); localStorage.removeItem('user'); }
    const msg = data?.message || (res.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.' : data?.title) || `Lỗi ${res.status}`;
    throw new Error(tr(msg));
  }
  return data;
}

export function downloadCsv(filename, rows) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n'); // BOM để Excel đọc đúng tiếng Việt
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
