import { CURRENCIES } from './format.js';
import { t } from './i18n.js';
import { setPref, usePrefs } from './prefs.js';

const ICON = {
  light: <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.4-1.4M4.94 19.06l1.4-1.4m0-11.32-1.4-1.4m14.12 14.12-1.4-1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />,
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  system: <path d="M3 5h18v11H3zM8 20h8m-4-4v4" />
};
const NEXT = { light: 'dark', dark: 'system', system: 'light' };

export default function PrefsBar({ onDark = false }) {
  const p = usePrefs();
  const themeName = { light: t('Sáng'), dark: t('Tối'), system: t('Theo hệ thống') }[p.theme];
  return (
    <div className={`prefs ${onDark ? 'prefs-dark' : ''}`}>
      <div className="seg" role="group" aria-label={t('Ngôn ngữ')}>
        {['vi', 'en'].map((l) => (
          <button key={l} type="button" aria-pressed={p.lang === l} className={p.lang === l ? 'on' : ''} onClick={() => setPref('lang', l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      <select value={p.currency} onChange={(e) => setPref('currency', e.target.value)} aria-label={t('Tiền tệ hiển thị')} title={t('Tiền tệ hiển thị (quy đổi tham khảo)')}>
        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button type="button" className="theme-btn" onClick={() => setPref('theme', NEXT[p.theme])} aria-label={`${t('Giao diện')}: ${themeName}`} title={`${t('Giao diện')}: ${themeName}`}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[p.theme]}</svg>
      </button>
    </div>
  );
}
