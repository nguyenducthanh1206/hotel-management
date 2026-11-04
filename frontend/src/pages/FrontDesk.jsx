import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import StayModal, { useCancel, useCheckIn } from '../components/StayModal.jsx';
import { t } from '../i18n.js';
import { BookingChip, Notice, fmtDate } from '../ui.jsx';

const FILTERS = [['', 'Tất cả'], ['Confirmed', 'Đã xác nhận'], ['CheckedIn', 'Đang lưu trú'], ['CheckedOut', 'Đã trả phòng'], ['Cancelled', 'Đã hủy']];

export default function FrontDesk() {
  const [status, setStatus] = useState('Confirmed');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    const p = new URLSearchParams(); if (status) p.set('status', status); if (q.trim()) p.set('q', q.trim());
    api('/bookings?' + p).then((r) => { setRows(r); setErr(''); }).catch((e) => setErr(e.message));
  }, [status, q]);
  useEffect(() => { load(); }, [load]);

  const checkIn = useCheckIn(load);
  const cancel = useCancel(load);

  return (
    <div>
      <h1>{t('Booking')}</h1>
      <div className="toolbar">
        <div className="tabs" role="tablist">
          {FILTERS.map(([v, l]) => <button key={v} role="tab" aria-selected={status === v} className={status === v ? 'tab on' : 'tab'} onClick={() => setStatus(v)}>{t(l)}</button>)}
        </div>
        <input className="search" placeholder={t('Tìm theo mã, tên, SĐT, số phòng')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Notice error={err} />
      <table className="table">
        <thead><tr><th>{t('Mã')}</th><th>{t('Khách')}</th><th>{t('Phòng')}</th><th>{t('Lưu trú')}</th><th>{t('Trạng thái')}</th><th /></tr></thead>
        <tbody>
          {rows?.map((b) => (
            <tr key={b.id}>
              <td className="code-sm">{b.code}</td>
              <td>{b.guestName}<div className="muted">{b.phone}</div></td>
              <td>{b.roomNumber}<div className="muted">{b.roomType}</div></td>
              <td>{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}<div className="muted">{t('{n} đêm', { n: b.nights })} · {t('{n} khách', { n: b.guests })}</div></td>
              <td><BookingChip s={b.status} /></td>
              <td className="actions">
                {b.status === 'Confirmed' && <>
                  <button className="btn btn-primary" onClick={() => checkIn(b)}>{t('Check-in')}</button>
                  <button className="btn" onClick={() => setOpen(b)}>{t('Đổi phòng')}</button>
                  <button className="btn btn-danger" onClick={() => cancel(b)}>{t('Hủy')}</button>
                </>}
                {b.status === 'CheckedIn' && <button className="btn btn-primary" onClick={() => setOpen(b)}>{t('Quản lý lưu trú')}</button>}
                {b.status === 'CheckedOut' && <button className="btn" onClick={() => setOpen(b)}>{t('Hóa đơn')}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows && rows.length === 0 && <p className="muted">{t('Không có booking phù hợp bộ lọc.')}</p>}
      {open && <StayModal id={open.id} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
}
