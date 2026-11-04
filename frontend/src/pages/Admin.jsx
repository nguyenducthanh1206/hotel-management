import { useCallback, useEffect, useState } from 'react';
import { api, downloadCsv } from '../api.js';
import { OccupancyChart, RevenueChart } from '../charts.jsx';
import { useDialogs } from '../dialogs.jsx';
import { weekday } from '../format.js';
import { t } from '../i18n.js';
import { Notice, fmtDate, fmtDateTime, isoToday, money, roleLabel } from '../ui.jsx';

const TABS = [['dash', 'Thống kê'], ['types', 'Loại phòng'], ['rooms', 'Phòng'], ['rates', 'Giá theo mùa'], ['services', 'Dịch vụ'], ['users', 'Tài khoản'], ['logs', 'Nhật ký']];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Admin() {
  const [tab, setTab] = useState('dash');
  return (
    <div>
      <h1>{t('Quản trị')}</h1>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)}>{t(l)}</button>)}</div>
      {tab === 'dash' && <Dashboard />}
      {tab === 'types' && <RoomTypes />}
      {tab === 'rooms' && <Rooms />}
      {tab === 'rates' && <Rates />}
      {tab === 'services' && <Services />}
      {tab === 'users' && <Users />}
      {tab === 'logs' && <Logs />}
    </div>
  );
}

function useLoad(path) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api(path).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message)), [path]);
  useEffect(() => { load(); }, [load]);
  return [data, load, err, setErr];
}

function FormActions({ onCancel }) {
  return <div className="actions"><button className="btn btn-primary">{t('Lưu')}</button><button type="button" className="btn btn-ghost" onClick={onCancel}>{t('Hủy bỏ')}</button></div>;
}

function Dashboard() {
  const [range, setRange] = useState({ from: isoToday(1 - +isoToday().slice(8)), to: isoToday() });
  const [d, , err] = useLoad(`/admin/dashboard?from=${range.from}&to=${range.to}`);
  const max = d ? Math.max(1, ...d.byDay.map((x) => x.revenue)) : 1;
  const exportCsv = () => downloadCsv(`dashboard_${range.from}_${range.to}.csv`, [
    ['date', 'revenue_vnd', 'occupied_rooms', 'occupancy_percent'],
    ...d.byDay.map((x) => [x.date.slice(0, 10), x.revenue, x.occupiedRooms, d.activeRooms ? Math.round((1000 * x.occupiedRooms) / d.activeRooms) / 10 : 0])
  ]);
  return (
    <div>
      <div className="searchbar">
        <label>{t('Từ ngày')}<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label>{t('Đến ngày')}<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        <button className="btn" disabled={!d} onClick={exportCsv}>{t('Xuất CSV')}</button>
      </div>
      <Notice error={err} />
      {d && <>
        <div className="stats">
          <div><span>{t('Doanh thu')}</span><strong>{money(d.revenue)}</strong><small>{t('{n} hóa đơn', { n: d.invoiceCount })}</small></div>
          <div><span>{t('Công suất phòng')}</span><strong>{d.occupancyPercent}%</strong><small>{t('{a} đêm-phòng / {b} phòng', { a: d.occupiedNights, b: d.activeRooms })}</small></div>
          <div><span>{t('Booking mới')}</span><strong>{d.bookingsCreated}</strong><small>{t('{n} đã hủy', { n: d.bookingsCancelled })}</small></div>
        </div>
        <div className="charts">
          <div className="panel"><h3>{t('Doanh thu theo ngày')}</h3><RevenueChart data={d.byDay} /></div>
          <div className="panel"><h3>{t('Công suất phòng theo ngày')}</h3><OccupancyChart data={d.byDay} rooms={d.activeRooms} /></div>
        </div>
        <table className="table">
          <thead><tr><th>{t('Ngày')}</th><th className="num">{t('Phòng có khách')}</th><th className="num">{t('Doanh thu')}</th><th /></tr></thead>
          <tbody>{d.byDay.map((x) => (
            <tr key={x.date}><td>{fmtDate(x.date)}</td><td className="num">{x.occupiedRooms}</td><td className="num">{money(x.revenue)}</td>
              <td className="barcell"><div className="bar" style={{ width: `${(x.revenue / max) * 100}%` }} /></td></tr>
          ))}</tbody>
        </table>
      </>}
    </div>
  );
}

function RoomTypes() {
  const { toast } = useDialogs();
  const [rows, load, err, setErr] = useLoad('/admin/room-types');
  const [f, setF] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setErr('');
    const body = { ...f, capacity: +f.capacity, basePrice: +f.basePrice, areaM2: +(f.areaM2 || 0), amenities: f.amenitiesText.split(',').map((s) => s.trim()).filter(Boolean) };
    try {
      await api(f.id ? `/admin/room-types/${f.id}` : '/admin/room-types', { method: f.id ? 'PUT' : 'POST', body });
      toast(t('Đã lưu loại phòng.')); setF(null); load();
    } catch (ex) { setErr(ex.message); }
  };
  return (
    <div>
      <Notice error={err} />
      <button className="btn btn-primary" onClick={() => setF({ name: '', description: '', capacity: 2, basePrice: 500000, areaM2: 25, bedType: '', viewName: '', details: '', isActive: true, amenitiesText: 'Wi-Fi, Điều hòa' })}>{t('Thêm loại phòng')}</button>
      <table className="table">
        <thead><tr><th>{t('Tên')}</th><th className="num">{t('Sức chứa')}</th><th className="num">{t('Diện tích')}</th><th className="num">{t('Giá cơ bản')}</th><th>{t('Tiện ích')}</th><th>{t('Số phòng')}</th><th>{t('Trạng thái')}</th><th /></tr></thead>
        <tbody>{rows?.map((x) => (
          <tr key={x.id}><td>{x.name}</td><td className="num">{x.capacity}</td><td className="num">{x.areaM2 ? `${x.areaM2} m²` : '—'}</td><td className="num">{money(x.basePrice)}</td><td>{x.amenities.map((a) => t(a)).join(', ')}</td><td>{x.roomCount}</td><td>{x.isActive ? t('Đang bán') : t('Ngừng bán')}</td>
            <td><button className="btn" onClick={() => setF({ ...x, amenitiesText: x.amenities.join(', ') })}>{t('Sửa')}</button></td></tr>
        ))}</tbody>
      </table>
      {f && (
        <form className="panel form" onSubmit={save}>
          <h2>{f.id ? t('Sửa loại phòng') : t('Thêm loại phòng')}</h2>
          <div className="row">
            <label>{t('Tên')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
            <label>{t('Sức chứa')}<input type="number" min="1" max="10" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></label>
            <label>{t('Giá cơ bản (VND/đêm)')}<input type="number" min="1" value={f.basePrice} onChange={(e) => setF({ ...f, basePrice: e.target.value })} /></label>
          </div>
          <div className="row">
            <label>{t('Diện tích (m²)')}<input type="number" min="0" value={f.areaM2 ?? 0} onChange={(e) => setF({ ...f, areaM2: e.target.value })} /></label>
            <label>{t('Loại giường')}<input value={f.bedType || ''} onChange={(e) => setF({ ...f, bedType: e.target.value })} /></label>
            <label>{t('Tầm nhìn')}<input value={f.viewName || ''} onChange={(e) => setF({ ...f, viewName: e.target.value })} /></label>
          </div>
          <label>{t('Mô tả ngắn (hiện trên thẻ phòng)')}<input value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
          <label>{t('Mô tả chi tiết (xuống dòng để tách đoạn)')}<textarea rows="4" value={f.details || ''} onChange={(e) => setF({ ...f, details: e.target.value })} /></label>
          <label>{t('Tiện ích (cách nhau bằng dấu phẩy)')}<input value={f.amenitiesText} onChange={(e) => setF({ ...f, amenitiesText: e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> {t('Đang bán')}</label>
          <p className="muted">{t('Đổi giá chỉ áp dụng cho booking mới; booking đã tạo giữ giá đã chốt.')}</p>
          <FormActions onCancel={() => setF(null)} />
        </form>
      )}
    </div>
  );
}

function Rooms() {
  const { toast } = useDialogs();
  const [rows, load, err, setErr] = useLoad('/rooms');
  const [types] = useLoad('/admin/room-types');
  const [f, setF] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setErr('');
    const body = { number: f.number, floor: +f.floor, roomTypeId: +f.roomTypeId, isActive: f.isActive };
    try {
      await api(f.id ? `/admin/rooms/${f.id}` : '/admin/rooms', { method: f.id ? 'PUT' : 'POST', body });
      toast(t('Đã lưu phòng.')); setF(null); load();
    } catch (ex) { setErr(ex.message); }
  };
  const typeId = (name) => types?.find((x) => x.name === name)?.id ?? '';
  return (
    <div>
      <Notice error={err} />
      <button className="btn btn-primary" onClick={() => setF({ number: '', floor: 1, roomTypeId: types?.[0]?.id ?? '', isActive: true })}>{t('Thêm phòng')}</button>
      <table className="table">
        <thead><tr><th>{t('Số phòng')}</th><th>{t('Tầng')}</th><th>{t('Loại')}</th><th>{t('Trạng thái')}</th><th>{t('Hoạt động')}</th><th /></tr></thead>
        <tbody>{rows?.map((r) => (
          <tr key={r.id}><td>{r.number}</td><td>{r.floor}</td><td>{r.type}</td><td>{t(r.statusLabel)}</td><td>{r.isActive ? t('Có') : t('Không')}</td>
            <td><button className="btn" onClick={() => setF({ id: r.id, number: r.number, floor: r.floor, roomTypeId: typeId(r.type), isActive: r.isActive })}>{t('Sửa')}</button></td></tr>
        ))}</tbody>
      </table>
      {f && (
        <form className="panel form" onSubmit={save}>
          <h2>{f.id ? t('Sửa phòng {n}', { n: f.number }) : t('Thêm phòng')}</h2>
          <div className="row">
            <label>{t('Số phòng')}<input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} required /></label>
            <label>{t('Tầng')}<input type="number" min="1" value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} /></label>
            <label>{t('Loại phòng')}
              <select value={f.roomTypeId} onChange={(e) => setF({ ...f, roomTypeId: e.target.value })} required>
                <option value="">{t('— Chọn —')}</option>{types?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          </div>
          <label className="check"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> {t('Đang hoạt động')}</label>
          <FormActions onCancel={() => setF(null)} />
        </form>
      )}
    </div>
  );
}

/** Quy tắc giá theo mùa / ngày trong tuần: mỗi đêm áp dụng quy tắc đang bật có độ ưu tiên cao nhất (không cộng dồn). */
function Rates() {
  const { toast } = useDialogs();
  const [rows, load, err, setErr] = useLoad('/admin/rates');
  const [types] = useLoad('/admin/room-types');
  const [f, setF] = useState(null);
  const [pv, setPv] = useState({ roomTypeId: '' });
  const [prev, setPrev] = useState(null);

  useEffect(() => {
    const id = pv.roomTypeId || types?.[0]?.id;
    if (!id) return;
    api(`/admin/rates/preview?roomTypeId=${id}&from=${isoToday()}&days=14`).then(setPrev).catch(() => {});
  }, [pv, types, rows]);

  const toggleDay = (d) => {
    const cur = (f.daysOfWeek || '').split(',').filter(Boolean);
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    setF({ ...f, daysOfWeek: DOW.filter((x) => next.includes(x)).join(',') });
  };
  const save = async (e) => {
    e.preventDefault(); setErr('');
    const body = { ...f, roomTypeId: f.roomTypeId ? +f.roomTypeId : null, value: +f.value, priority: +f.priority, startDate: f.startDate || null, endDate: f.endDate || null, daysOfWeek: f.daysOfWeek || null };
    try {
      await api(f.id ? `/admin/rates/${f.id}` : '/admin/rates', { method: f.id ? 'PUT' : 'POST', body });
      toast(t('Đã lưu quy tắc giá.')); setF(null); load();
    } catch (ex) { setErr(ex.message); }
  };
  const toggleActive = async (r) => {
    try { await api(`/admin/rates/${r.id}`, { method: 'PUT', body: { ...r, isActive: !r.isActive } }); load(); } catch (ex) { setErr(ex.message); }
  };
  const describe = (r) => (r.mode === 'Percent' ? `${r.value > 0 ? '+' : ''}${r.value}%` : `${money(r.value)} / ${t('đêm')}`);
  const when = (r) => [r.startDate ? `${fmtDate(r.startDate)} → ${r.endDate ? fmtDate(r.endDate) : '…'}` : '', r.daysOfWeek ? r.daysOfWeek.split(',').map((d) => weekday(`2024-01-0${DOW.indexOf(d) + 1}`)).join(', ') : ''].filter(Boolean).join(' · ') || t('Mọi ngày');

  return (
    <div>
      <Notice error={err} />
      <p className="muted">{t('Mỗi đêm áp dụng một quy tắc đang bật có độ ưu tiên cao nhất, không cộng dồn. Booking đã đặt giữ giá đã chốt.')}</p>
      <button className="btn btn-primary" onClick={() => setF({ name: '', roomTypeId: '', startDate: '', endDate: '', daysOfWeek: '', mode: 'Percent', value: 10, priority: 1, isActive: true })}>{t('Thêm quy tắc giá')}</button>
      <table className="table">
        <thead><tr><th>{t('Tên')}</th><th>{t('Áp dụng cho')}</th><th>{t('Thời gian')}</th><th className="num">{t('Điều chỉnh')}</th><th className="num">{t('Ưu tiên')}</th><th>{t('Trạng thái')}</th><th /></tr></thead>
        <tbody>{rows?.map((r) => (
          <tr key={r.id}><td>{t(r.name)}</td><td>{r.roomType || t('Mọi hạng phòng')}</td><td>{when(r)}</td><td className="num">{describe(r)}</td><td className="num">{r.priority}</td>
            <td><button className="btn" onClick={() => toggleActive(r)}>{r.isActive ? t('Đang bật') : t('Đang tắt')}</button></td>
            <td><button className="btn" onClick={() => setF({ ...r, roomTypeId: r.roomTypeId || '', startDate: r.startDate?.slice(0, 10) || '', endDate: r.endDate?.slice(0, 10) || '', daysOfWeek: r.daysOfWeek || '' })}>{t('Sửa')}</button></td></tr>
        ))}</tbody>
      </table>
      {rows && rows.length === 0 && <p className="muted">{t('Chưa có quy tắc giá nào.')}</p>}

      {f && (
        <form className="panel form" onSubmit={save}>
          <h2>{f.id ? t('Sửa quy tắc giá') : t('Thêm quy tắc giá')}</h2>
          <div className="row">
            <label>{t('Tên')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
            <label>{t('Áp dụng cho')}
              <select value={f.roomTypeId} onChange={(e) => setF({ ...f, roomTypeId: e.target.value })}>
                <option value="">{t('Mọi hạng phòng')}</option>{types?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <label>{t('Từ ngày (để trống = không giới hạn)')}<input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
            <label>{t('Đến ngày')}<input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
          </div>
          <div>
            <div className="lbl-sm">{t('Ngày trong tuần (không chọn = mọi ngày)')}</div>
            <div className="chips-filter">
              {DOW.map((d, i) => <button key={d} type="button" aria-pressed={(f.daysOfWeek || '').split(',').includes(d)} className={(f.daysOfWeek || '').split(',').includes(d) ? 'fchip on' : 'fchip'} onClick={() => toggleDay(d)}>{weekday(`2024-01-0${i + 1}`)}</button>)}
            </div>
          </div>
          <div className="row">
            <label>{t('Kiểu điều chỉnh')}
              <select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
                <option value="Percent">{t('Phần trăm so với giá cơ bản')}</option><option value="Fixed">{t('Giá cố định mỗi đêm')}</option>
              </select>
            </label>
            <label>{f.mode === 'Percent' ? t('Phần trăm (ví dụ 25 hoặc -10)') : t('Giá mỗi đêm (VND)')}<input type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required /></label>
            <label>{t('Độ ưu tiên (số lớn thắng)')}<input type="number" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> {t('Đang bật')}</label>
          <FormActions onCancel={() => setF(null)} />
        </form>
      )}

      <h3>{t('Xem trước giá 14 đêm tới')}</h3>
      <label className="inline-sel">{t('Hạng phòng')}
        <select value={pv.roomTypeId || types?.[0]?.id || ''} onChange={(e) => setPv({ roomTypeId: e.target.value })}>
          {types?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      {prev && (
        <div className="preview-grid">{prev.map((x) => (
          <div key={x.date} className={`pv ${x.isBase ? '' : 'pv-diff'}`}><span>{weekday(x.date)} {fmtDate(x.date)}</span><strong>{money(x.price)}</strong></div>
        ))}</div>
      )}
    </div>
  );
}

function Services() {
  const { toast } = useDialogs();
  const [rows, load, err, setErr] = useLoad('/admin/services');
  const [f, setF] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await api(f.id ? `/admin/services/${f.id}` : '/admin/services', { method: f.id ? 'PUT' : 'POST', body: { ...f, unitPrice: +f.unitPrice } });
      toast(t('Đã lưu dịch vụ.')); setF(null); load();
    } catch (ex) { setErr(ex.message); }
  };
  return (
    <div>
      <Notice error={err} />
      <button className="btn btn-primary" onClick={() => setF({ name: '', unit: 'lần', unitPrice: 0, isActive: true })}>{t('Thêm dịch vụ')}</button>
      <table className="table">
        <thead><tr><th>{t('Dịch vụ')}</th><th>{t('Đơn vị')}</th><th className="num">{t('Đơn giá')}</th><th>{t('Trạng thái')}</th><th /></tr></thead>
        <tbody>{rows?.map((s) => (
          <tr key={s.id}><td>{t(s.name)}</td><td>{t(s.unit)}</td><td className="num">{money(s.unitPrice)}</td><td>{s.isActive ? t('Đang cung cấp') : t('Ngừng')}</td>
            <td><button className="btn" onClick={() => setF({ ...s })}>{t('Sửa')}</button></td></tr>
        ))}</tbody>
      </table>
      {f && (
        <form className="panel form" onSubmit={save}>
          <h2>{f.id ? t('Sửa dịch vụ') : t('Thêm dịch vụ')}</h2>
          <div className="row">
            <label>{t('Tên')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
            <label>{t('Đơn vị')}<input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
            <label>{t('Đơn giá (VND)')}<input type="number" min="0" value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> {t('Đang cung cấp')}</label>
          <FormActions onCancel={() => setF(null)} />
        </form>
      )}
    </div>
  );
}

function Users() {
  const { toast, confirm } = useDialogs();
  const [rows, load, err, setErr] = useLoad('/admin/users');
  const [f, setF] = useState(null);
  const [temp, setTemp] = useState(null);
  const create = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/admin/users', { method: 'POST', body: f }); toast(t('Đã tạo tài khoản.')); setF(null); load(); } catch (ex) { setErr(ex.message); }
  };
  const lock = async (u) => {
    setErr('');
    try { await api(`/admin/users/${u.id}/active`, { method: 'PUT', body: { isActive: !u.isActive } }); load(); } catch (ex) { setErr(ex.message); }
  };
  const reset = async (u) => {
    const ok = await confirm({ title: t('Cấp lại mật khẩu'), message: t('Cấp lại mật khẩu cho {name}?', { name: u.username }), confirmText: t('Cấp lại') });
    if (!ok) return;
    setErr('');
    try { setTemp(await api(`/admin/users/${u.id}/reset-password`, { method: 'POST' })); } catch (ex) { setErr(ex.message); }
  };
  return (
    <div>
      <Notice error={err} />
      {temp && <Notice ok={t('Mật khẩu tạm của {name}: {pw} (chỉ hiện một lần, hãy chuyển cho người dùng).', { name: temp.username, pw: temp.tempPassword })} onClose={() => setTemp(null)} />}
      <button className="btn btn-primary" onClick={() => setF({ username: '', password: '', fullName: '', role: 'Receptionist' })}>{t('Thêm nhân viên')}</button>
      <table className="table">
        <thead><tr><th>{t('Tên đăng nhập')}</th><th>{t('Họ tên')}</th><th>{t('Vai trò')}</th><th>{t('Trạng thái')}</th><th /></tr></thead>
        <tbody>{rows?.map((u) => (
          <tr key={u.id}><td>{u.username}</td><td>{u.fullName}</td><td>{roleLabel(u.role)}</td><td>{u.isActive ? t('Hoạt động') : t('Đã khóa')}</td>
            <td className="actions"><button className="btn" onClick={() => lock(u)}>{u.isActive ? t('Khóa') : t('Mở khóa')}</button><button className="btn" onClick={() => reset(u)}>{t('Cấp lại mật khẩu')}</button></td></tr>
        ))}</tbody>
      </table>
      {f && (
        <form className="panel form" onSubmit={create}>
          <h2>{t('Thêm nhân viên')}</h2>
          <div className="row">
            <label>{t('Tên đăng nhập')}<input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /></label>
            <label>{t('Mật khẩu')}<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
            <label>{t('Họ tên')}<input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required /></label>
            <label>{t('Vai trò')}
              <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                {['Receptionist', 'Housekeeping', 'Admin'].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </label>
          </div>
          <div className="actions"><button className="btn btn-primary">{t('Tạo tài khoản')}</button><button type="button" className="btn btn-ghost" onClick={() => setF(null)}>{t('Hủy bỏ')}</button></div>
        </form>
      )}
    </div>
  );
}

function Logs() {
  const [q, setQ] = useState('');
  const [rows, , err] = useLoad(`/admin/logs?q=${encodeURIComponent(q)}`);
  const exportCsv = () => downloadCsv('system_log.csv', [['time', 'user', 'action', 'detail'], ...rows.map((l) => [l.at, l.username, l.action, l.detail])]);
  return (
    <div>
      <div className="toolbar">
        <input className="search" placeholder={t('Lọc theo thao tác, người dùng, nội dung')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" disabled={!rows} onClick={exportCsv}>{t('Xuất CSV')}</button>
      </div>
      <Notice error={err} />
      <table className="table">
        <thead><tr><th>{t('Thời điểm')}</th><th>{t('Người thực hiện')}</th><th>{t('Thao tác')}</th><th>{t('Chi tiết')}</th></tr></thead>
        <tbody>{rows?.map((l) => <tr key={l.id}><td>{fmtDateTime(l.at)}</td><td>{l.username}</td><td className="code-sm">{l.action}</td><td>{l.detail}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
