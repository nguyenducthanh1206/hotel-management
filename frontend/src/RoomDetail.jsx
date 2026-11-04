import { Modal, fmtDate, money } from './ui.jsx';
import { Gallery } from './art.jsx';
import { t } from './i18n.js';

export default function RoomDetail({ type, q, onClose, onChoose, disabled }) {
  const paragraphs = (type.details || type.description || '').split('\n').filter(Boolean);
  return (
    <Modal title={type.name} onClose={onClose} wide>
      <Gallery name={type.name} area={type.areaM2} capacity={type.capacity} />

      <div className="detail-cols">
        <div>
          <p className="detail-lead"><strong>{t('Ở được {n} khách.', { n: type.capacity })}</strong></p>
          <ul className="facts">
            {type.areaM2 > 0 && <li><span>{t('Diện tích')}</span>{type.areaM2} m²</li>}
            {type.bedType && <li><span>{t('Giường')}</span>{t(type.bedType)}</li>}
            {type.viewName && <li><span>{t('Tầm nhìn')}</span>{t(type.viewName)}</li>}
          </ul>
          <div className="tags tags-lg">{type.amenities.map((a) => <span className="tag" key={a}>{t(a)}</span>)}</div>
        </div>
        <div className="detail-text">
          {paragraphs.map((p, i) => <p key={i}>{t(p)}</p>)}
          <p className="muted small">{t('Nhận phòng từ 14:00, trả phòng trước 12:00. Hủy miễn phí trước 14:00 ngày đến ít nhất 24 giờ.')}</p>
        </div>
      </div>

      <div className="choose-bar">
        <div>
          <div className="price">{money(type.avgNightly)}<small> / {t('đêm')}{type.avgNightly !== type.basePrice ? ` (${t('trung bình')})` : ''}</small></div>
          <div className="muted small">{fmtDate(q.checkIn)} → {fmtDate(q.checkOut)} · {t('{n} khách', { n: q.guests })} · {t('{n} đêm', { n: type.nights })}: {money(type.total)}</div>
          <div className={`small ${type.availableRooms ? 'ok' : 'bad'}`}>
            {type.availableRooms ? t('Còn {n} phòng trong khoảng ngày này', { n: type.availableRooms }) : t('Hết phòng trong khoảng ngày này')}
          </div>
        </div>
        <button className="btn btn-primary btn-lg" disabled={!type.availableRooms || disabled} onClick={() => onChoose(type)}>{t('Chọn phòng')}</button>
      </div>
    </Modal>
  );
}
