import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useDialogs } from '../dialogs.jsx';
import { t } from '../i18n.js';
import { Notice, PrintButton, Voucher, money } from '../ui.jsx';

export default function Lookup() {
  const { confirm, toast } = useDialogs();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ code: sp.get('code') || '', phone: '' });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const search = async (e) => {
    e?.preventDefault(); setErr(''); setBusy(true);
    try { setRes(await api(`/public/lookup?code=${encodeURIComponent(f.code)}&phone=${encodeURIComponent(f.phone)}`)); }
    catch (ex) { setErr(ex.message); setRes(null); }
    setBusy(false);
  };

  const cancel = async () => {
    const b = res.booking;
    const ok = await confirm({
      title: t('Hủy booking {code}', { code: b.code }), danger: true, confirmText: t('Hủy booking'),
      message: t('Hủy miễn phí trước 14:00 ngày đến ít nhất 24 giờ; sau mốc đó tính phí 1 đêm ({fee}).', { fee: money(b.nightlyRate) })
    });
    if (!ok) return;
    try {
      const r = await api('/public/cancel', { method: 'POST', body: { code: f.code, phone: f.phone, reason: '' } });
      toast(r.cancellationFee > 0 ? t('Đã hủy {code}. Phí hủy: {fee}.', { code: b.code, fee: money(r.cancellationFee) }) : t('Đã hủy {code}, không mất phí.', { code: b.code }));
      search();
    } catch (ex) { toast(ex.message, 'err'); }
  };

  return (
    <div className="wrap plain-page">
      <h1>{t('Tra cứu đặt phòng')}</h1>
      <p className="muted">{t('Nhập mã xác nhận và số điện thoại đã dùng khi đặt phòng. Không cần đăng nhập.')}</p>
      <form className="searchbar" onSubmit={search}>
        <label>{t('Mã xác nhận')}<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="HBXXXXXX" required /></label>
        <label>{t('Số điện thoại')}<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></label>
        <button className="btn btn-primary btn-lg" disabled={busy}>{t('Tra cứu')}</button>
      </form>
      <Notice error={err} />
      {res && (
        <div className="panel">
          <Voucher booking={res.booking} nights={res.nights} invoice={res.invoice} />
          <div className="actions no-print">
            <PrintButton />
            {res.booking.status === 'Confirmed' && <button className="btn btn-danger" onClick={cancel}>{t('Hủy booking')}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
