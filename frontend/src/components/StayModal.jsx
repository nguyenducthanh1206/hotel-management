import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useDialogs } from '../dialogs.jsx';
import { t } from '../i18n.js';
import { BookingChip, InvoiceView, Modal, Notice, PrintButton, fmtDate, fmtDateTime, methodLabel, money } from '../ui.jsx';

export function useCheckIn(onDone) {
  const { ask, toast } = useDialogs();
  return async (b) => {
    const idNumber = await ask({
      title: t('Check-in {code}', { code: b.code }),
      message: `${b.guestName} · ${t('Phòng')} ${b.roomNumber}`,
      label: t('CCCD/Hộ chiếu (bỏ trống nếu đã có)'), defaultValue: b.idNumber || '', confirmText: t('Check-in')
    });
    if (idNumber === null) return;
    try {
      await api(`/frontdesk/bookings/${b.id}/check-in`, { method: 'POST', body: { idNumber } });
      toast(t('Đã check-in {code}, phòng {room}.', { code: b.code, room: b.roomNumber }));
      onDone?.();
    } catch (ex) { toast(ex.message, 'err'); }
  };
}

export function useCancel(onDone) {
  const { ask, toast } = useDialogs();
  return async (b) => {
    const reason = await ask({ title: t('Hủy booking {code}', { code: b.code }), label: t('Lý do hủy'), confirmText: t('Hủy booking'), message: b.guestName });
    if (reason === null) return;
    try {
      const r = await api(`/bookings/${b.id}/cancel`, { method: 'POST', body: { reason } });
      toast(r.cancellationFee > 0 ? t('Đã hủy {code}. Phí hủy: {fee}.', { code: b.code, fee: money(r.cancellationFee) }) : t('Đã hủy {code}.', { code: b.code }));
      onDone?.();
    } catch (ex) { toast(ex.message, 'err'); }
  };
}

export default function StayModal({ id, onClose, onChanged }) {
  const { confirm, toast } = useDialogs();
  const [d, setD] = useState(null);
  const [services, setServices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [err, setErr] = useState('');
  const [svc, setSvc] = useState({ serviceId: '', quantity: 1 });
  const [move, setMove] = useState({ newRoomId: '', reason: '' });
  const [bill, setBill] = useState({ surcharge: 0, surchargeNote: '', discount: 0, paymentMethod: 'Cash' });
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    try {
      const det = await api(`/bookings/${id}`);
      setD(det);
      const st = det.booking.status;
      if (st === 'CheckedIn' || st === 'Confirmed') setRooms(await api(`/frontdesk/bookings/${id}/available-rooms`));
      if (st === 'CheckedIn') setServices(await api('/frontdesk/services'));
    } catch (ex) { setErr(ex.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okMsg) => {
    setErr('');
    try { await fn(); toast(okMsg); setPreview(null); await load(); onChanged?.(); } catch (ex) { setErr(ex.message); }
  };

  const showPreview = async () => {
    setErr('');
    try {
      const p = new URLSearchParams({ surcharge: bill.surcharge || 0, note: bill.surchargeNote, discount: bill.discount || 0 });
      const r = await api(`/frontdesk/bookings/${id}/invoice-preview?` + p);
      setPreview({ number: t('Tạm tính'), lines: r.lines, total: r.total });
    } catch (ex) { setErr(ex.message); }
  };

  const checkOut = async () => {
    const ok = await confirm({ title: t('Check-out và xuất hóa đơn'), message: t('Xác nhận check-out và xuất hóa đơn?'), confirmText: t('Check-out') });
    if (!ok) return;
    await act(async () => {
      const r = await api(`/frontdesk/bookings/${id}/check-out`, { method: 'POST', body: bill });
      setPreview({ number: r.number, lines: r.lines, total: r.total });
    }, t('Đã check-out. Phòng chuyển sang trạng thái Đang dọn.'));
  };

  if (!d) return <Modal title={t('Đang tải...')} onClose={onClose}><Notice error={err} /></Modal>;
  const b = d.booking;
  const inHouse = b.status === 'CheckedIn';
  const confirmed = b.status === 'Confirmed';

  return (
    <Modal title={`${b.code} · ${b.guestName}`} onClose={onClose} wide>
      <Notice error={err} />
      <div className="kv">
        <div>{t('Trạng thái')}<strong><BookingChip s={b.status} /></strong></div>
        <div>{t('Phòng hiện tại')}<strong>{b.roomNumber} ({b.roomType})</strong></div>
        <div>{t('Lưu trú')}<strong>{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}</strong></div>
        <div>{t('Giá/đêm (trung bình)')}<strong>{money(b.nightlyRate)}</strong></div>
        <div>{t('Tiền phòng dự kiến')}<strong>{money(b.estimatedTotal)}</strong></div>
        <div>{t('Nhận phòng thực tế')}<strong>{fmtDateTime(b.actualCheckIn) || '—'}</strong></div>
      </div>

      <h3>{t('Lịch sử phòng')}</h3>
      <ul className="plain">{d.segments.map((s, i) => <li key={i}>{t('Phòng')} {s.room}: {fmtDate(s.from)} → {s.to ? fmtDate(s.to) : t('hiện tại')} · {money(s.nightlyRate)}/{t('đêm')}</li>)}</ul>

      {(inHouse || confirmed) && (
        <section>
          <h3>{t('Đổi phòng')}</h3>
          {rooms.length === 0 ? <p className="muted">{t('Hiện không có phòng nào khả dụng để chuyển.')}</p> : (
            <div className="row">
              <label>{t('Phòng mới')}
                <select value={move.newRoomId} onChange={(e) => setMove({ ...move, newRoomId: e.target.value })}>
                  <option value="">{t('— Chọn phòng —')}</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.type} · {money(r.price)}</option>)}
                </select>
              </label>
              <label>{t('Lý do')}<input value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} /></label>
              <button className="btn" disabled={!move.newRoomId}
                onClick={() => act(() => api(`/frontdesk/bookings/${id}/change-room`, { method: 'POST', body: { newRoomId: +move.newRoomId, reason: move.reason } }), t('Đã đổi phòng.'))}>{t('Đổi phòng')}</button>
            </div>
          )}
        </section>
      )}

      {(inHouse || d.services.length > 0) && (
        <section>
          <h3>{t('Dịch vụ phát sinh')}</h3>
          {d.services.length > 0 && (
            <table className="table"><thead><tr><th>{t('Dịch vụ')}</th><th className="num">{t('SL')}</th><th className="num">{t('Đơn giá')}</th><th className="num">{t('Thành tiền')}</th><th>{t('Thời điểm')}</th></tr></thead>
              <tbody>{d.services.map((s) => <tr key={s.id}><td>{t(s.name)}</td><td className="num">{s.quantity} {t(s.unit)}</td><td className="num">{money(s.unitPrice)}</td><td className="num">{money(s.amount)}</td><td>{fmtDateTime(s.usedAt)}</td></tr>)}</tbody></table>
          )}
          {inHouse && (
            <div className="row">
              <label>{t('Dịch vụ')}
                <select value={svc.serviceId} onChange={(e) => setSvc({ ...svc, serviceId: e.target.value })}>
                  <option value="">{t('— Chọn dịch vụ —')}</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{t(s.name)} · {money(s.unitPrice)}/{t(s.unit)}</option>)}
                </select>
              </label>
              <label>{t('Số lượng')}<input type="number" min="1" value={svc.quantity} onChange={(e) => setSvc({ ...svc, quantity: +e.target.value })} /></label>
              <button className="btn" disabled={!svc.serviceId}
                onClick={() => act(() => api(`/frontdesk/bookings/${id}/services`, { method: 'POST', body: { serviceId: +svc.serviceId, quantity: svc.quantity } }), t('Đã ghi nhận dịch vụ.'))}>{t('Thêm dịch vụ')}</button>
            </div>
          )}
        </section>
      )}

      {inHouse && (
        <section>
          <h3>{t('Check-out và thanh toán')}</h3>
          <div className="row">
            <label>{t('Phụ thu (VND)')}<input type="number" min="0" value={bill.surcharge} onChange={(e) => setBill({ ...bill, surcharge: +e.target.value })} /></label>
            <label>{t('Lý do phụ thu')}<input value={bill.surchargeNote} onChange={(e) => setBill({ ...bill, surchargeNote: e.target.value })} /></label>
            <label>{t('Giảm trừ (VND)')}<input type="number" min="0" value={bill.discount} onChange={(e) => setBill({ ...bill, discount: +e.target.value })} /></label>
            <label>{t('Thanh toán')}
              <select value={bill.paymentMethod} onChange={(e) => setBill({ ...bill, paymentMethod: e.target.value })}>
                {['Cash', 'Card', 'Transfer'].map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
              </select>
            </label>
          </div>
          <div className="actions">
            <button className="btn" onClick={showPreview}>{t('Xem tạm tính')}</button>
            <button className="btn btn-primary" onClick={checkOut}>{t('Check-out & xuất hóa đơn')}</button>
          </div>
          {preview && <InvoiceView inv={preview} />}
        </section>
      )}

      {b.status === 'CheckedOut' && d.invoice && (
        <section className="print-area">
          <h3>{t('Hóa đơn')} · {b.code} · {b.guestName}</h3>
          <InvoiceView inv={d.invoice} />
          <div className="actions"><PrintButton /></div>
        </section>
      )}
    </Modal>
  );
}
