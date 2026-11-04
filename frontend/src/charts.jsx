import { fmtDay, money, moneyCompact } from './format.js';
import { t } from './i18n.js';

const W = 640, H = 220, L = 52, R = 12, T = 12, B = 30;

function Axes({ max, fmt, labels, step }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <g>
      {ticks.map((v) => {
        const y = T + (H - T - B) * (1 - v / max);
        return <g key={v}><line x1={L} x2={W - R} y1={y} y2={y} className="grid" /><text x={L - 6} y={y + 4} textAnchor="end" className="axis">{fmt(v)}</text></g>;
      })}
      {labels.map((lb, i) => (i % step === 0 ? <text key={i} x={lb.x} y={H - 10} textAnchor="middle" className="axis">{lb.text}</text> : null))}
    </g>
  );
}

const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };

/** Cột doanh thu theo ngày. */
export function RevenueChart({ data }) {
  const max = niceMax(Math.max(...data.map((d) => d.revenue), 0));
  const n = data.length, bw = (W - L - R) / Math.max(n, 1);
  const labels = data.map((d, i) => ({ x: L + bw * i + bw / 2, text: fmtDay(d.date) }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t('Biểu đồ doanh thu theo ngày')}>
      <Axes max={max} fmt={moneyCompact} labels={labels} step={Math.ceil(n / 10)} />
      {data.map((d, i) => {
        const h = (H - T - B) * (d.revenue / max);
        return <rect key={d.date} x={L + bw * i + bw * 0.15} y={H - B - h} width={bw * 0.7} height={Math.max(h, d.revenue ? 1 : 0)} className="cbar"><title>{`${fmtDay(d.date)}: ${money(d.revenue)}`}</title></rect>;
      })}
    </svg>
  );
}

/** Đường công suất phòng (% phòng có khách mỗi ngày). */
export function OccupancyChart({ data, rooms }) {
  const n = data.length, step = (W - L - R) / Math.max(n - 1, 1);
  const pct = (d) => (rooms ? (100 * d.occupiedRooms) / rooms : 0);
  const pts = data.map((d, i) => [n === 1 ? (L + W - R) / 2 : L + step * i, T + (H - T - B) * (1 - pct(d) / 100)]);
  const labels = data.map((d, i) => ({ x: pts[i][0], text: fmtDay(d.date) }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t('Biểu đồ công suất phòng theo ngày')}>
      <Axes max={100} fmt={(v) => `${Math.round(v)}%`} labels={labels} step={Math.ceil(n / 10)} />
      <polyline points={pts.map((p) => p.join(',')).join(' ')} className="cline" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" className="cdot"><title>{`${fmtDay(data[i].date)}: ${Math.round(pct(data[i]))}% (${data[i].occupiedRooms}/${rooms})`}</title></circle>)}
    </svg>
  );
}
