import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import StayModal from '../components/StayModal.jsx';
import { addDaysIso, fmtDay, isoToday, weekday } from '../format.js';
import { t } from '../i18n.js';
import { Notice, RoomChip, bookingLabel, fmtDate } from '../ui.jsx';

/** Lịch phòng: mỗi hàng một phòng, mỗi thanh là một đoạn lưu trú. Không thể chồng lấn nhau trên cùng một hàng. */
export default function Timeline() {
  const [from, setFrom] = useState(isoToday(-1));
  const [days, setDays] = useState(14);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    api(`/frontdesk/timeline?from=${from}&days=${days}`).then((r) => { setD(r); setErr(''); }).catch((e) => setErr(e.message));
  }, [from, days]);
  useEffect(() => { load(); }, [load]);

  const today = isoToday();
  const cols = Array.from({ length: days }, (_, i) => addDaysIso(from, i));
  const off = (iso) => Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(from)) / 86400000);

  return (
    <div>
      <h1>{t('Lịch phòng')}</h1>
      <div className="toolbar">
        <div className="actions">
          <button className="btn" onClick={() => setFrom(addDaysIso(from, -days))}>‹ {t('Trước')}</button>
          <button className="btn" onClick={() => setFrom(isoToday(-1))}>{t('Hôm nay')}</button>
          <button className="btn" onClick={() => setFrom(addDaysIso(from, days))}>{t('Sau')} ›</button>
        </div>
        <div className="tabs">
          {[7, 14, 28].map((n) => <button key={n} className={days === n ? 'tab on' : 'tab'} onClick={() => setDays(n)}>{t('{n} ngày', { n })}</button>)}
        </div>
      </div>
      <Notice error={err} />
      <div className="legend">
        {['Confirmed', 'CheckedIn', 'CheckedOut'].map((s) => <span key={s}><i className={`swatch bar-${s}`} /> {bookingLabel(s)}</span>)}
        <span className="muted small">{t('Bấm vào một thanh để xem hoặc xử lý booking.')}</span>
      </div>

      {d && (
        <div className="tl-wrap">
          <div className="tl" style={{ '--cols': days }}>
            <div className="tl-row tl-header">
              <div className="tl-label">{t('Phòng')}</div>
              <div className="tl-days">
                {cols.map((c) => (
                  <div key={c} className={`tl-day ${c === today ? 'today' : ''} ${['Sat', 'Sun'].includes(new Date(c + 'T00:00:00').toDateString().slice(0, 3)) ? 'wknd' : ''}`}>
                    <span>{weekday(c, 'short')}</span><strong>{fmtDay(c)}</strong>
                  </div>
                ))}
              </div>
            </div>
            {d.rooms.map((r) => (
              <div key={r.id} className="tl-row">
                <div className="tl-label"><strong>{r.number}</strong><span className="muted small">{r.type}</span>{r.status !== 'Ready' && <RoomChip s={r.status} />}</div>
                <div className="tl-track">
                  {cols.map((c) => <div key={c} className={`tl-cell ${c === today ? 'today' : ''}`} />)}
                  {d.bars.filter((b) => b.roomId === r.id).map((b, i) => {
                    const s = Math.max(0, off(b.start)), e = Math.min(days, off(b.end));
                    if (e <= s) return null;
                    return (
                      <button key={`${b.bookingId}-${i}`} type="button" className={`tl-bar bar-${b.status}`} style={{ gridColumn: `${s + 1} / ${e + 1}` }}
                        title={`${b.code} · ${b.guest}\n${fmtDate(b.start)} → ${fmtDate(b.end)}\n${bookingLabel(b.status)}`} onClick={() => setOpen(b.bookingId)}>
                        {b.guest}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {open && <StayModal id={open} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
}
