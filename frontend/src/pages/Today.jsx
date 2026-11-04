import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import StayModal, { useCheckIn } from '../components/StayModal.jsx';
import { useDialogs } from '../dialogs.jsx';
import { t } from '../i18n.js';
import { Notice, fmtDate } from '../ui.jsx';

export default function Today() {
  const { toast } = useDialogs();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(() => api('/frontdesk/today').then((r) => { setD(r); setErr(''); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [load]);
  const checkIn = useCheckIn(load);

  const cleaned = async (r) => {
    try { await api(`/rooms/${r.id}/status`, { method: 'PATCH', body: { status: 'Ready', note: null } }); toast(t('Phòng {room} đã sẵn sàng.', { room: r.number })); load(); }
    catch (ex) { toast(ex.message, 'err'); }
  };

  if (!d) return <div><h1>{t('Hôm nay')}</h1><Notice error={err} /></div>;
  const c = d.counts;
  const departures = d.inHouse.filter((b) => b.checkOut <= d.date);
  const stats = [
    [t('Khách đến'), c.arrivals], [t('Khách đi'), c.departures], [t('Đang lưu trú'), c.inHouse],
    [t('Phòng cần dọn'), c.toClean], [t('Phòng sẵn sàng'), `${c.ready}/${c.totalRooms}`]
  ];

  return (
    <div>
      <h1>{t('Hôm nay')} · {fmtDate(d.date)}</h1>
      <Notice error={err} />
      <div className="stats">{stats.map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>

      <section>
        <h3>{t('Khách đến hôm nay')} ({d.arrivals.length})</h3>
        {d.arrivals.length === 0 ? <p className="muted">{t('Không có khách đến.')}</p> : (
          <table className="table"><tbody>{d.arrivals.map((b) => (
            <tr key={b.id}>
              <td className="code-sm">{b.code}</td>
              <td>{b.guestName}<div className="muted">{b.phone}</div></td>
              <td>{t('Phòng')} {b.roomNumber}<div className="muted">{b.roomType}</div></td>
              <td>{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}{b.checkIn < d.date && <div className="bad small">{t('Đến muộn')}</div>}</td>
              <td className="actions"><button className="btn btn-primary" onClick={() => checkIn(b)}>{t('Check-in')}</button><button className="btn" onClick={() => setOpen(b)}>{t('Đổi phòng')}</button></td>
            </tr>))}</tbody></table>
        )}
      </section>

      <section>
        <h3>{t('Khách trả phòng hôm nay')} ({departures.length})</h3>
        {departures.length === 0 ? <p className="muted">{t('Không có khách trả phòng.')}</p> : (
          <table className="table"><tbody>{departures.map((b) => (
            <tr key={b.id}>
              <td className="code-sm">{b.code}</td>
              <td>{b.guestName}</td>
              <td>{t('Phòng')} {b.roomNumber}</td>
              <td>{fmtDate(b.checkOut)}{b.checkOut < d.date && <div className="bad small">{t('Ở quá hạn')}</div>}</td>
              <td className="actions"><button className="btn btn-primary" onClick={() => setOpen(b)}>{t('Check-out')}</button></td>
            </tr>))}</tbody></table>
        )}
      </section>

      <section>
        <h3>{t('Đang lưu trú')} ({d.inHouse.length})</h3>
        {d.inHouse.length === 0 ? <p className="muted">{t('Chưa có khách lưu trú.')}</p> : (
          <table className="table"><tbody>{d.inHouse.map((b) => (
            <tr key={b.id}>
              <td className="code-sm">{b.code}</td><td>{b.guestName}</td><td>{t('Phòng')} {b.roomNumber}</td>
              <td>{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}</td>
              <td className="actions"><button className="btn" onClick={() => setOpen(b)}>{t('Quản lý lưu trú')}</button></td>
            </tr>))}</tbody></table>
        )}
      </section>

      <section>
        <h3>{t('Phòng cần dọn')} ({d.toClean.length})</h3>
        {d.toClean.length === 0 ? <p className="muted">{t('Không có phòng nào đang chờ dọn.')}</p> : (
          <div className="tiles">{d.toClean.map((r) => (
            <div key={r.id} className="tile tile-Cleaning"><div className="tile-no">{r.number}</div><div className="muted">{r.type}</div>
              <button className="btn" onClick={() => cleaned(r)}>{t('Dọn xong, sẵn sàng')}</button></div>))}</div>
        )}
      </section>

      {open && <StayModal id={open.id} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
}
