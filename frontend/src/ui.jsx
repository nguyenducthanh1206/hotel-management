import { useEffect } from 'react';
import { t } from './i18n.js';
import { currency } from './prefs.js';
import { money, moneyVnd, fmtDate, fmtDay, fmtDateTime, isoToday, addDaysIso } from './format.js';

export { money, moneyVnd, fmtDate, fmtDay, fmtDateTime, isoToday, addDaysIso };

const BOOKING_VI = { Confirmed: 'Đã xác nhận', CheckedIn: 'Đang lưu trú', CheckedOut: 'Đã trả phòng', Cancelled: 'Đã hủy' };
const ROOM_VI = { Ready: 'Sẵn sàng', Occupied: 'Đang có khách', Cleaning: 'Đang dọn', Maintenance: 'Bảo trì' };
const ROLE_VI = { Guest: 'Khách hàng', Receptionist: 'Lễ tân', Housekeeping: 'Buồng phòng', Admin: 'Quản lý' };
const METHOD_VI = { Cash: 'Tiền mặt', Card: 'Thẻ', Transfer: 'Chuyển khoản' };
export const bookingLabel = (s) => t(BOOKING_VI[s] || s);
export const roomLabel = (s) => t(ROOM_VI[s] || s);
export const roleLabel = (s) => t(ROLE_VI[s] || s);
export const methodLabel = (s) => t(METHOD_VI[s] || s);

export function Chip({ kind, children }) {
  return <span className={`chip chip-${kind}`}><i />{children}</span>;
}
export const BookingChip = ({ s }) => <Chip kind={s}>{bookingLabel(s)}</Chip>;
export const RoomChip = ({ s }) => <Chip kind={s}>{roomLabel(s)}</Chip>;

export function Notice({ error, ok, onClose }) {
  if (!error && !ok) return null;
  return (
    <div className={`notice ${error ? 'notice-err' : 'notice-ok'}`} role={error ? 'alert' : 'status'}>
      <span>{error || ok}</span>
      {onClose && <button className="link" onClick={onClose}>{t('Đóng')}</button>}
    </div>
  );
}

export function Modal({ title, onClose, wide, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button className="btn btn-ghost" onClick={onClose}>{t('Đóng')}</button></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export const PrintButton = () => <button type="button" className="btn no-print" onClick={() => window.print()}>{t('In / Lưu PDF')}</button>;

/** Mô tả dòng hóa đơn (máy chủ lưu tiếng Việt) theo ngôn ngữ đang chọn. */
export function invoiceLineText(l) {
  if (l.type === 'Room') {
    const m = l.description.match(/^Phòng (\S+) \((.+?) - (.+?)\)( - ở quá hạn)?$/);
    if (m) return `${t('Phòng')} ${m[1]} (${m[2]} - ${m[3]})${m[4] ? ' - ' + t('ở quá hạn') : ''}`;
  }
  if (l.type === 'Service') {
    const m = l.description.match(/^(.*) \((\d\d\/\d\d \d\d:\d\d)\)$/);
    if (m) return `${t(m[1])} (${m[2]})`;
  }
  if (l.type === 'Surcharge' || l.type === 'Discount') return t(l.description);
  return l.description;
}

export function InvoiceView({ inv }) {
  return (
    <div className="invoice">
      <div className="inv-head"><strong>{inv.number}</strong>{inv.issuedAt && <span>{fmtDateTime(inv.issuedAt)}</span>}</div>
      <table className="table">
        <thead><tr><th>{t('Khoản mục')}</th><th className="num">{t('SL')}</th><th className="num">{t('Đơn giá')}</th><th className="num">{t('Thành tiền')}</th></tr></thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i}><td>{invoiceLineText(l)}</td><td className="num">{l.quantity}</td><td className="num">{money(l.unitPrice)}</td><td className="num">{money(l.amount)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan="3">{t('Tổng thanh toán')}</td><td className="num total">{money(inv.total)}</td></tr></tfoot>
      </table>
      {currency() !== 'VND' && (
        <p className="muted small">{t('Số tiền quy đổi tham khảo. Thanh toán bằng VND: {amount}', { amount: moneyVnd(inv.total) })}</p>
      )}
    </div>
  );
}

/** Phiếu xác nhận / chi tiết đặt phòng, in được (Ctrl+P hoặc nút In / Lưu PDF). */
export function Voucher({ booking: b, nights, invoice }) {
  const total = nights?.length ? nights.reduce((s, n) => s + n.price, 0) : b.estimatedTotal;
  return (
    <div className="voucher print-area">
      <div className="voucher-head">
        <div className="logo logo-ink">Hotel</div>
        <div className="voucher-title">{t('Phiếu xác nhận đặt phòng')}</div>
      </div>
      <div className="ticket">
        <div className="eyebrow">{t('Mã xác nhận')}</div>
        <div className="code">{b.code}</div>
        <div><BookingChip s={b.status} /></div>
      </div>
      <div className="kv">
        <div>{t('Khách')}<strong>{b.guestName}</strong></div>
        <div>{t('Phòng')}<strong>{b.roomType} · {b.roomNumber}</strong></div>
        <div>{t('Nhận phòng')}<strong>{fmtDate(b.checkIn)} ({t('từ 14:00')})</strong></div>
        <div>{t('Trả phòng')}<strong>{fmtDate(b.checkOut)} ({t('trước 12:00')})</strong></div>
        <div>{t('Số khách')}<strong>{b.guests}</strong></div>
        <div>{t('Số đêm')}<strong>{b.nights}</strong></div>
      </div>
      {nights?.length > 0 && (
        <table className="table">
          <thead><tr><th>{t('Đêm')}</th><th className="num">{t('Giá')}</th></tr></thead>
          <tbody>{nights.map((n) => <tr key={n.date}><td>{fmtDate(n.date)}</td><td className="num">{money(n.price)}</td></tr>)}</tbody>
          <tfoot><tr><td>{t('Tạm tính tiền phòng')}</td><td className="num total">{money(total)}</td></tr></tfoot>
        </table>
      )}
      {invoice && <InvoiceView inv={invoice} />}
      <p className="muted small">{t('Hủy miễn phí trước 14:00 ngày đến ít nhất 24 giờ; sau mốc đó phí hủy là 1 đêm.')}</p>
    </div>
  );
}
