import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useDialogs } from '../dialogs.jsx';
import { t } from '../i18n.js';
import { Notice, RoomChip, fmtDate } from '../ui.jsx';

// Các chuyển trạng thái thủ công mà giao diện cho phép (máy chủ kiểm tra lại).
const NEXT = {
  Ready: [['Cleaning', 'Cần dọn'], ['Maintenance', 'Đưa vào bảo trì']],
  Cleaning: [['Ready', 'Dọn xong, sẵn sàng'], ['Maintenance', 'Báo hỏng / bảo trì']],
  Maintenance: [['Cleaning', 'Sửa xong, chuyển dọn']],
  Occupied: []
};
const FILTERS = [['', 'Tất cả'], ['Ready', 'Sẵn sàng'], ['Occupied', 'Đang có khách'], ['Cleaning', 'Đang dọn'], ['Maintenance', 'Bảo trì']];

export default function RoomBoard() {
  const { user } = useAuth();
  const { toast } = useDialogs();
  const [rooms, setRooms] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('');

  const load = () => api('/rooms').then((r) => { setRooms(r); setErr(''); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const move = async (r, status) => {
    try {
      await api(`/rooms/${r.id}/status`, { method: 'PATCH', body: { status, note: null } });
      toast(t('Phòng {room} đã cập nhật.', { room: r.number })); load();
    } catch (ex) { toast(ex.message, 'err'); }
  };

  const floors = [...new Set((rooms || []).map((r) => r.floor))].sort();
  const housekeeping = user.role === 'Housekeeping';

  return (
    <div>
      <h1>{t('Sơ đồ phòng')}</h1>
      <div className="tabs">
        {FILTERS.map(([v, l]) => <button key={v} className={filter === v ? 'tab on' : 'tab'} onClick={() => setFilter(v)}>{t(l)}</button>)}
      </div>
      <Notice error={err} />
      {floors.map((fl) => (
        <section key={fl}>
          <h3>{t('Tầng {n}', { n: fl })}</h3>
          <div className="tiles">
            {rooms.filter((r) => r.floor === fl && (!filter || r.status === filter)).map((r) => {
              const actions = NEXT[r.status].filter(() => !housekeeping || r.status === 'Cleaning');
              return (
                <div key={r.id} className={`tile tile-${r.status}`}>
                  <div className="tile-no">{r.number}</div>
                  <div className="muted">{r.type}{r.isActive ? '' : ` · ${t('ngừng hoạt động')}`}</div>
                  <RoomChip s={r.status} />
                  {r.guest && <div className="small">{r.guest.name}<br />{t('trả')} {fmtDate(r.guest.checkOut)}</div>}
                  {!r.guest && r.nextArrival && <div className="small muted">{t('Sắp đến')}: {r.nextArrival.name} ({fmtDate(r.nextArrival.checkIn)})</div>}
                  <div className="actions col">
                    {actions.map(([to, label]) => <button key={to} className="btn" onClick={() => move(r, to)}>{t(label)}</button>)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
