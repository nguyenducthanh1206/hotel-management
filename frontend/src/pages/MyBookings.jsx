import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useDialogs } from '../dialogs.jsx';
import { t } from '../i18n.js';
import { BookingChip, Modal, Notice, PrintButton, Voucher, fmtDate, money } from '../ui.jsx';

export default function MyBookings() {
  const { confirm, toast } = useDialogs();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => api('/bookings').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const cancel = async (b) => {
    const ok = await confirm({
      title: t('Hủy booking {code}', { code: b.code }), danger: true, confirmText: t('Hủy booking'),
      message: t('Hủy miễn phí trước 14:00 ngày đến ít nhất 24 giờ; sau mốc đó tính phí 1 đêm ({fee}).', { fee: money(b.nightlyRate) })
    });
    if (!ok) return;
    try {
      const r = await api(`/bookings/${b.id}/cancel`, { method: 'POST', body: { reason: 'Khách tự hủy' } });
      toast(r.cancellationFee > 0 ? t('Đã hủy {code}. Phí hủy: {fee}.', { code: b.code, fee: money(r.cancellationFee) }) : t('Đã hủy {code}, không mất phí.', { code: b.code }));
      load();
    } catch (ex) { toast(ex.message, 'err'); }
  };

  const open = async (b) => {
    try { setDetail(await api(`/bookings/${b.id}`)); } catch (ex) { setErr(ex.message); }
  };

  return (
    <div className="wrap plain-page">
      <h1>{t('Booking của tôi')}</h1>
      <Notice error={err} />
      {rows && rows.length === 0 && <p className="muted">{t('Bạn chưa có booking nào. Hãy bắt đầu từ trang Hạng phòng.')}</p>}
      <div className="list">
        {rows?.map((b) => (
          <div key={b.id} className="item">
            <div className="item-top"><span className="code-sm">{b.code}</span><BookingChip s={b.status} /></div>
            <div className="item-title">{b.roomType} · {t('phòng')} {b.roomNumber}</div>
            <div>{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} ({t('{n} đêm', { n: b.nights })})</div>
            <div className="muted">{t('Tạm tính')} {money(b.estimatedTotal)}{b.cancellationFee > 0 ? ` · ${t('phí hủy')} ${money(b.cancellationFee)}` : ''}</div>
            <div className="actions">
              <button className="btn" onClick={() => open(b)}>{t('Chi tiết & phiếu in')}</button>
              {b.status === 'Confirmed' && <button className="btn btn-danger" onClick={() => cancel(b)}>{t('Hủy booking')}</button>}
            </div>
          </div>
        ))}
      </div>
      {detail && (
        <Modal title={`${t('Booking')} ${detail.booking.code}`} onClose={() => setDetail(null)} wide>
          <Voucher booking={detail.booking} nights={detail.nights} invoice={detail.invoice} />
          <div className="actions no-print"><PrintButton /></div>
        </Modal>
      )}
    </div>
  );
}
