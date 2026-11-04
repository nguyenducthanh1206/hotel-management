import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { DateRangeField } from '../Calendar.jsx';
import { RoomArt } from '../art.jsx';
import { t } from '../i18n.js';
import { locale } from '../format.js';
import RoomDetail from '../RoomDetail.jsx';
import { Modal, Notice, PrintButton, Voucher, addDaysIso, fmtDate, isoToday, money } from '../ui.jsx';

export default function Search() {
  const { user } = useAuth();
  const nav = useNavigate();
  const staff = !!user && user.role !== 'Guest';
  const [q, setQ] = useState({ checkIn: isoToday(1), checkOut: isoToday(2), guests: 2 });
  const [types, setTypes] = useState(null);
  const [err, setErr] = useState('');
  const [pick, setPick] = useState(null);
  const [done, setDone] = useState(null);
  const [detail, setDetail] = useState(null);
  const [services, setServices] = useState([]);
  const [sort, setSort] = useState('price-asc');
  const [onlyFree, setOnlyFree] = useState(false);
  const [wanted, setWanted] = useState([]);

  const load = async (query = q) => {
    setErr('');
    try {
      const p = new URLSearchParams({ checkIn: query.checkIn, checkOut: query.checkOut, guests: query.guests });
      setTypes(await api('/public/availability?' + p));
    } catch (ex) { setErr(ex.message); setTypes(null); }
  };
  useEffect(() => { load(); }, [q.checkIn, q.checkOut, q.guests]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api('/public/services').then(setServices).catch(() => {}); }, []);

  const allAmenities = [...new Set((types || []).flatMap((x) => x.amenities))].sort();
  const toggleAmenity = (a) => setWanted(wanted.includes(a) ? wanted.filter((x) => x !== a) : [...wanted, a]);
  const visible = (types || [])
    .filter((x) => (!onlyFree || x.availableRooms > 0) && wanted.every((a) => x.amenities.includes(a)))
    .sort((a, b) => (sort === 'price-desc' ? b.avgNightly - a.avgNightly : sort === 'capacity' ? b.capacity - a.capacity : a.avgNightly - b.avgNightly));

  const book = (x) => {
    if (!user) return nav('/login', { state: { from: '/' } });
    setPick(x);
  };
  const setGuests = (n) => setQ({ ...q, guests: Math.min(10, Math.max(1, n)) });

  return (
    <div>
      {!staff && (
        <section className="hero">
          <div className="hero-inner">
            <p className="eyebrow">{t('Khách sạn')}</p>
            <h1 className="display">Hotel</h1>
            <div className="orn" aria-hidden="true"><i /></div>
            <p className="lead">{t('Không gian nghỉ ngơi yên tĩnh, dịch vụ chu đáo. Đặt phòng trực tuyến chỉ trong vài bước.')}</p>
          </div>
        </section>
      )}

      <div className="wrap">
        {staff && <h1>{t('Đặt phòng hộ khách')}</h1>}
        <div className={`finder ${staff ? 'finder-flat' : ''}`}>
          <DateRangeField value={q} guests={q.guests} onChange={(r) => { setQ({ ...q, ...r }); setDone(null); }} />
          <div className="datefield">
            <span className="lbl">{t('Số khách')}</span>
            <div className="stepper">
              <button type="button" aria-label={t('Giảm số khách')} onClick={() => setGuests(q.guests - 1)} disabled={q.guests <= 1}>−</button>
              <span aria-live="polite">{q.guests}</span>
              <button type="button" aria-label={t('Tăng số khách')} onClick={() => setGuests(q.guests + 1)} disabled={q.guests >= 10}>+</button>
            </div>
          </div>
        </div>
        <Notice error={err} />

        {!staff && (
          <div className="section-title">
            <span className="eyebrow">{t('Lưu trú')}</span>
            <h2>{t('Hạng phòng')}</h2>
            <div className="orn" aria-hidden="true"><i /></div>
          </div>
        )}
        {staff && <p className="muted">{t('Đặt hộ khách vãng lai hoặc khách gọi điện. Nhận phòng từ 14:00, trả phòng trước 12:00.')}</p>}

        {types && (
          <div className="filters">
            <label>{t('Sắp xếp')}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="price-asc">{t('Giá thấp đến cao')}</option>
                <option value="price-desc">{t('Giá cao đến thấp')}</option>
                <option value="capacity">{t('Sức chứa lớn nhất')}</option>
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> {t('Chỉ hiện hạng còn phòng')}</label>
            <div className="chips-filter" role="group" aria-label={t('Lọc theo tiện nghi')}>
              {allAmenities.map((a) => (
                <button key={a} type="button" aria-pressed={wanted.includes(a)} className={wanted.includes(a) ? 'fchip on' : 'fchip'} onClick={() => toggleAmenity(a)}>{t(a)}</button>
              ))}
            </div>
          </div>
        )}
        {types && visible.length === 0 && <p className="muted center">{t('Không có hạng phòng nào phù hợp bộ lọc hiện tại.')}</p>}
        <div className="rooms">
          {visible.map((x) => (
            <article key={x.id} className={`room ${x.availableRooms === 0 ? 'room-off' : ''}`}>
              <button type="button" className="art-btn" onClick={() => setDetail(x)} aria-label={t('Xem chi tiết {name}', { name: x.name })}>
                <RoomArt name={x.name} area={x.areaM2} capacity={x.capacity} />
                <span className="art-hint">{t('Xem chi tiết')}</span>
              </button>
              <div className="room-body">
                <h3>{x.name}</h3>
                <p className="room-desc">{t(x.description || '')}</p>
                <p className="muted small">
                  {x.areaM2 > 0 ? `${x.areaM2} m² · ` : ''}{t('Tối đa {n} khách', { n: x.capacity })}{x.bedType ? ` · ${t(x.bedType)}` : ''}
                </p>
                <div className="tags">{x.amenities.slice(0, 5).map((a) => <span className="tag" key={a}>{t(a)}</span>)}{x.amenities.length > 5 && <span className="tag">+{x.amenities.length - 5}</span>}</div>
                <div className="room-foot">
                  <div>
                    <div className="price">{money(x.avgNightly)}<small> / {t('đêm')}</small></div>
                    <div className="muted small">{t('{n} đêm', { n: x.nights })}: {money(x.total)}{x.avgNightly !== x.basePrice ? ` · ${t('giá theo mùa')}` : ''}</div>
                    <div className={`small ${x.availableRooms ? 'ok' : 'bad'}`}>
                      {x.availableRooms ? t('Còn {n} phòng', { n: x.availableRooms }) : t('Hết phòng trong khoảng ngày này')}
                    </div>
                  </div>
                  <div className="actions col">
                    <button className="btn btn-primary" disabled={!x.availableRooms || user?.role === 'Housekeeping'} onClick={() => book(x)}>{t('Đặt phòng')}</button>
                    <button className="btn" onClick={() => setDetail(x)}>{t('Chi tiết')}</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!staff && (<>
          <div className="perks">
            <div><strong>14:00</strong><span>{t('Nhận phòng')}</span></div>
            <div><strong>12:00</strong><span>{t('Trả phòng')}</span></div>
            <div><strong>{t('24 giờ')}</strong><span>{t('Hủy miễn phí trước ngày đến')}</span></div>
            <div><strong>{t('Trực tuyến')}</strong><span>{t('Nhận mã xác nhận ngay')}</span></div>
          </div>

          {services.length > 0 && (<>
            <div className="section-title">
              <span className="eyebrow">{t('Trong thời gian lưu trú')}</span>
              <h2>{t('Dịch vụ')}</h2>
              <div className="orn" aria-hidden="true"><i /></div>
            </div>
            <div className="services">
              {services.map((sv) => <div key={sv.id} className="service"><strong>{t(sv.name)}</strong><span>{money(sv.unitPrice)} / {t(sv.unit)}</span></div>)}
            </div>
            <p className="muted small center">{t('Dịch vụ được ghi nhận tại quầy lễ tân và tính vào hóa đơn khi trả phòng.')}</p>
          </>)}

          <div className="section-title">
            <span className="eyebrow">{t('Cần biết trước khi đặt')}</span>
            <h2>{t('Chính sách')}</h2>
            <div className="orn" aria-hidden="true"><i /></div>
          </div>
          <div className="faq">
            <details><summary>{t('Giờ nhận phòng và trả phòng')}</summary><p>{t('Nhận phòng từ 14:00 và trả phòng trước 12:00. Ở quá ngày đi sẽ được tính thêm đêm theo giá phòng đang áp dụng.')}</p></details>
            <details><summary>{t('Chính sách hủy đặt phòng')}</summary><p>{t('Hủy miễn phí nếu thực hiện trước 14:00 ngày đến ít nhất 24 giờ. Hủy muộn hơn sẽ tính phí 1 đêm. Booking đã nhận phòng không thể hủy.')}</p></details>
            <details><summary>{t('Giá phòng thay đổi sau khi tôi đã đặt?')}</summary><p>{t('Giá bạn thấy lúc đặt được giữ nguyên cho booking đó. Thay đổi bảng giá chỉ áp dụng cho các booking đặt sau.')}</p></details>
            <details><summary>{t('Giá thay đổi theo mùa hoặc cuối tuần?')}</summary><p>{t('Một số đêm (mùa cao điểm, cuối tuần) có thể có giá khác giá cơ bản. Bảng giá từng đêm hiển thị ở bước xác nhận.')}</p></details>
            <details><summary>{t('Trả phòng sớm có được hoàn tiền?')}</summary><p>{t('Hệ thống tính đủ số đêm đã đặt, kể cả khi bạn trả phòng sớm hơn dự kiến.')}</p></details>
          </div>
        </>)}
      </div>

      {detail && (
        <RoomDetail type={detail} q={q} disabled={user?.role === 'Housekeeping'} onClose={() => setDetail(null)}
          onChoose={(x) => { setDetail(null); book(x); }} />
      )}

      {pick && (
        <BookingWizard type={pick} q={q} user={user} onClose={() => setPick(null)}
          onDone={(b) => { setPick(null); setDone({ booking: b, nights: pick.nightPrices }); load(); }} />
      )}

      {done && (
        <Modal title={t('Đặt phòng thành công')} onClose={() => setDone(null)}>
          <Voucher booking={done.booking} nights={done.nights} />
          <div className="actions no-print"><PrintButton /><button className="btn btn-primary" onClick={() => setDone(null)}>{t('Hoàn tất')}</button></div>
        </Modal>
      )}
    </div>
  );
}

/** Đặt phòng 3 bước: kỳ lưu trú, thông tin khách, xác nhận. */
function BookingWizard({ type, q, user, onClose, onDone }) {
  const staff = user.role !== 'Guest';
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ guestName: staff ? '' : user.fullName, phone: staff ? '' : user.phone || '', email: staff ? '' : user.email || '', idNumber: '' });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const steps = [t('Kỳ lưu trú'), t('Thông tin khách'), t('Xác nhận')];

  const deadline = new Date(`${q.checkIn}T14:00:00`);
  deadline.setHours(deadline.getHours() - 24);
  const deadlineText = deadline.toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const expired = new Date() > deadline;

  const next = () => {
    if (step === 2 && (!f.guestName.trim() || !f.phone.trim())) return setErr(t('Cần họ tên và số điện thoại của khách.'));
    setErr(''); setStep(step + 1);
  };

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const b = await api('/bookings', { method: 'POST', body: { roomTypeId: type.id, checkIn: q.checkIn, checkOut: q.checkOut, guests: q.guests, ...f } });
      onDone(b);
    } catch (ex) { setErr(ex.message); setBusy(false); }
  };

  return (
    <Modal title={t('Đặt phòng {name}', { name: type.name })} onClose={onClose} wide>
      <ol className="steps" aria-label={t('Các bước đặt phòng')}>
        {steps.map((s, i) => <li key={s} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''} aria-current={i + 1 === step ? 'step' : undefined}><span>{i + 1}</span>{s}</li>)}
      </ol>

      {step === 1 && (
        <div>
          <div className="kv">
            <div>{t('Hạng phòng')}<strong>{type.name}</strong></div>
            <div>{t('Nhận phòng')}<strong>{fmtDate(q.checkIn)} ({t('từ 14:00')})</strong></div>
            <div>{t('Trả phòng')}<strong>{fmtDate(q.checkOut)} ({t('trước 12:00')})</strong></div>
            <div>{t('Số khách')}<strong>{q.guests}</strong></div>
          </div>
          <PriceTable type={type} />
        </div>
      )}

      {step === 2 && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); next(); }}>
          {staff && <p className="muted small">{t('Đặt hộ khách vãng lai hoặc qua điện thoại.')}</p>}
          <div className="row">
            <label>{t('Họ tên')}<input value={f.guestName} onChange={set('guestName')} required autoFocus /></label>
            <label>{t('Số điện thoại')}<input value={f.phone} onChange={set('phone')} required /></label>
          </div>
          <div className="row">
            <label>Email<input type="email" value={f.email} onChange={set('email')} /></label>
            <label>{t('CCCD/Hộ chiếu (không bắt buộc)')}<input value={f.idNumber} onChange={set('idNumber')} /></label>
          </div>
          <button hidden aria-hidden="true" tabIndex={-1} />
        </form>
      )}

      {step === 3 && (
        <div>
          <div className="kv">
            <div>{t('Khách')}<strong>{f.guestName}</strong></div>
            <div>{t('Số điện thoại')}<strong>{f.phone}</strong></div>
            <div>{t('Hạng phòng')}<strong>{type.name}</strong></div>
            <div>{t('Lưu trú')}<strong>{fmtDate(q.checkIn)} → {fmtDate(q.checkOut)}</strong></div>
          </div>
          <PriceTable type={type} />
          <div className="policy-box">
            <strong>{t('Chính sách hủy')}</strong>
            <p>{t('Hủy miễn phí đến {when}. Sau thời điểm này phí hủy là 1 đêm.', { when: deadlineText })}</p>
            {expired && <p className="bad">{t('Booking này đã quá hạn hủy miễn phí: nếu hủy sẽ mất phí 1 đêm.')}</p>}
          </div>
          <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {t('Tôi đã đọc và đồng ý với chính sách hủy và giá trên.')}</label>
        </div>
      )}

      <Notice error={err} />
      <div className="actions wizard-actions">
        {step > 1 && <button type="button" className="btn btn-ghost" onClick={() => { setErr(''); setStep(step - 1); }}>{t('Quay lại')}</button>}
        {step < 3 && <button type="button" className="btn btn-primary" onClick={next}>{t('Tiếp tục')}</button>}
        {step === 3 && <button type="button" className="btn btn-primary" disabled={!agree || busy} onClick={submit}>{t('Xác nhận đặt phòng')}</button>}
      </div>
    </Modal>
  );
}

function PriceTable({ type }) {
  return (
    <table className="table">
      <thead><tr><th>{t('Đêm')}</th><th className="num">{t('Giá')}</th></tr></thead>
      <tbody>{type.nightPrices.map((n) => <tr key={n.date}><td>{fmtDate(n.date)}{n.price !== type.basePrice && <span className="muted small"> · {t('giá theo mùa')}</span>}</td><td className="num">{money(n.price)}</td></tr>)}</tbody>
      <tfoot><tr><td>{t('Tổng tiền phòng')} ({t('{n} đêm', { n: type.nights })})</td><td className="num total">{money(type.total)}</td></tr></tfoot>
    </table>
  );
}
