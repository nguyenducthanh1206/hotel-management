import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { t } from './i18n.js';
import { addDaysIso, daysBetween, fmtDate, isoToday, monthTitle, weekday } from './format.js';

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function cellsOf(y, m) {
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // tuần bắt đầu từ thứ Hai
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(y, m, i + 1))];
}
const WEEK = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-06', '2024-01-07'];

/** Lịch chọn khoảng ngày; ngày hết phòng bị làm mờ. */
export function RangeCalendar({ guests, value, onPick }) {
  const today = isoToday();
  const [view, setView] = useState(() => { const d = value.checkIn || today; return { y: +d.slice(0, 4), m: +d.slice(5, 7) - 1 }; });
  const [avail, setAvail] = useState({});
  const [anchor, setAnchor] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const from = iso(view.y, view.m, 1);
    const to = new Date(Date.UTC(view.y, view.m + 2, 1)).toISOString().slice(0, 10);
    let alive = true;
    api(`/public/calendar?from=${from}&to=${to}&guests=${guests}`)
      .then((rows) => { if (alive) { const map = {}; rows.forEach((r) => { map[r.date.slice(0, 10)] = r.available; }); setAvail(map); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [view, guests]);

  // Ngày trả phòng xa nhất kể từ ngày nhận a: mọi đêm từ a trở đi phải còn phòng.
  const limitFor = (a) => {
    let last = a;
    for (let i = 1; i <= 30; i++) {
      if (avail[addDaysIso(a, i - 1)] === 0) break;
      last = addDaysIso(a, i);
    }
    return last;
  };
  const limit = anchor ? limitFor(anchor) : null;

  const disabled = (d) => {
    if (!anchor || d <= anchor) return d < today || avail[d] === 0;
    return d > limit;
  };

  const click = (d) => {
    if (disabled(d)) return;
    if (!anchor || d <= anchor) { setAnchor(d); setHover(null); }
    else { onPick({ checkIn: anchor, checkOut: d }); setAnchor(null); }
  };

  const rangeEnd = anchor ? hover : value.checkOut;
  const rangeStart = anchor || value.checkIn;
  const inRange = (d) => rangeStart && rangeEnd && d > rangeStart && d < rangeEnd;

  const shift = (n) => setView(({ y, m }) => { const x = new Date(Date.UTC(y, m + n, 1)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() }; });
  const canPrev = view.y * 12 + view.m > +today.slice(0, 4) * 12 + (+today.slice(5, 7) - 1);

  return (
    <div className="cal">
      <div className="cal-nav">
        <button type="button" className="btn btn-ghost" disabled={!canPrev} onClick={() => shift(-1)} aria-label={t('Tháng trước')}>‹</button>
        <button type="button" className="btn btn-ghost" onClick={() => shift(1)} aria-label={t('Tháng sau')}>›</button>
      </div>
      <div className="cal-months">
        {[0, 1].map((off) => {
          const x = new Date(Date.UTC(view.y, view.m + off, 1));
          const y = x.getUTCFullYear(), m = x.getUTCMonth();
          return (
            <div key={off} className="cal-month">
              <div className="cal-title">{monthTitle(y, m)}</div>
              <div className="cal-grid">
                {WEEK.map((w) => <div key={w} className="cal-dow">{weekday(w, 'narrow')}</div>)}
                {cellsOf(y, m).map((d, i) => {
                  if (!d) return <div key={`e${i}`} />;
                  const off2 = disabled(d);
                  const cls = ['day', off2 ? 'off' : '', d === today ? 'today' : '', d === rangeStart ? 'start' : '', d === rangeEnd ? 'end' : '', inRange(d) ? 'mid' : '', avail[d] > 0 && avail[d] <= 2 ? 'low' : ''].join(' ');
                  const title = avail[d] === undefined ? '' : avail[d] === 0 ? t('Hết phòng') : t('Còn {n} phòng', { n: avail[d] });
                  return <button key={d} type="button" className={cls} disabled={off2} title={title} onClick={() => click(d)} onMouseEnter={() => anchor && setHover(d)}>{+d.slice(8)}</button>;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="cal-legend"><span><i className="dot low" /> {t('Sắp hết phòng')}</span><span><i className="dot off" /> {t('Hết phòng')}</span></div>
    </div>
  );
}

export function DateRangeField({ value, guests, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const nights = daysBetween(value.checkIn, value.checkOut);
  return (
    <div className="datefield" ref={ref}>
      <span className="lbl">{t('Nhận phòng - Trả phòng')}</span>
      <button type="button" className="datebtn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        {fmtDate(value.checkIn)} → {fmtDate(value.checkOut)} <span className="muted">· {t('{n} đêm', { n: nights })}</span>
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label={t('Chọn ngày')}>
          <RangeCalendar guests={guests} value={value} onPick={(r) => { onChange(r); setOpen(false); }} />
          <p className="muted small">{t('Bấm ngày nhận phòng, rồi bấm ngày trả phòng.')}</p>
        </div>
      )}
    </div>
  );
}
