import { t } from './i18n.js';
import { useState } from 'react';

// Hạng phòng càng rộng thì hình minh họa càng nhiều chi tiết.
export const tierOf = (area, capacity) => (area >= 50 ? 2 : area >= 32 || capacity >= 3 ? 1 : 0);
export const slugOf = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const SCENES = ['bed', 'bath', 'view', 'lounge'];

const ACCENT = ['#a9803f', '#2f5d62', '#7a3b3b'];

function Defs() {
  return (
    <defs>
      <linearGradient id="gWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1e9d9" /><stop offset="1" stopColor="#dccfb4" /></linearGradient>
      <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9dcdf" /><stop offset="1" stopColor="#f4e8cf" /></linearGradient>
      <linearGradient id="gDusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9db8c4" /><stop offset="0.7" stopColor="#f2dcb8" /><stop offset="1" stopColor="#f6e6c6" /></linearGradient>
      <pattern id="gTile" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#c9d8d5" strokeWidth="1.5" /></pattern>
    </defs>
  );
}

function Bed({ tier, accent }) {
  return (
    <g>
      <rect x="48" y="104" width="176" height="62" rx="4" fill="#6b5a45" />
      <rect x="40" y="150" width="192" height="56" rx="5" fill="#fffdf9" stroke="#d8cdb6" />
      <rect x="40" y="178" width="192" height="28" rx="4" fill={accent} opacity=".9" />
      <rect x="62" y="134" width="70" height="26" rx="9" fill="#f1e9d9" stroke="#d8cdb6" />
      <rect x="140" y="134" width="70" height="26" rx="9" fill="#f1e9d9" stroke="#d8cdb6" />
      <rect x="240" y="170" width="28" height="36" fill="#6b5a45" />
      <path d="M254 170l-11-24h22z" fill="#f3e3b8" />
      {tier >= 1 && (<g>
        <ellipse cx="320" cy="226" rx="62" ry="12" fill={accent} opacity=".25" />
        <rect x="296" y="176" width="52" height="34" rx="8" fill="#3c4a43" />
        <rect x="290" y="168" width="14" height="42" rx="6" fill="#2d3a34" />
        <rect x="340" y="168" width="14" height="42" rx="6" fill="#2d3a34" />
      </g>)}
    </g>
  );
}

function SceneBed({ tier, accent }) {
  return (
    <g>
      <rect width="400" height="260" fill="url(#gWall)" />
      <rect y="206" width="400" height="54" fill="#b99a6a" opacity=".38" />
      <rect y="204" width="400" height="3" fill="#8a6f45" opacity=".35" />
      {tier === 0 && (<g><rect x="262" y="48" width="96" height="108" fill="url(#gSky)" stroke="#8a6f45" strokeWidth="4" /><path d="M310 48V156M262 102H358" stroke="#8a6f45" strokeWidth="3" /></g>)}
      {tier === 1 && (<g><path d="M262 156V92a48 48 0 0 1 96 0V156Z" fill="url(#gSky)" stroke="#8a6f45" strokeWidth="4" /><path d="M310 44V156" stroke="#8a6f45" strokeWidth="3" /></g>)}
      {tier === 2 && (<g>
        <rect x="246" y="40" width="54" height="116" fill="url(#gSky)" stroke="#8a6f45" strokeWidth="4" />
        <rect x="310" y="40" width="54" height="116" fill="url(#gSky)" stroke="#8a6f45" strokeWidth="4" />
        <path d="M200 0V34" stroke="#8a6f45" strokeWidth="2" /><path d="M176 52a24 24 0 0 1 48 0Z" fill={accent} />
      </g>)}
      <Bed tier={tier} accent={accent} />
    </g>
  );
}

function SceneBath({ tier, accent }) {
  return (
    <g>
      <rect width="400" height="260" fill="#e6eeed" />
      <rect width="400" height="204" fill="url(#gTile)" />
      <rect y="204" width="400" height="56" fill="#cbbfa7" />
      <rect x="28" y="132" width="214" height="72" rx="30" fill="#fffdf9" stroke="#cfc6b3" strokeWidth="2" />
      <rect x="42" y="140" width="186" height="16" rx="8" fill="#d6e8ea" />
      <path d="M232 132V96h-24" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="322" cy="86" rx={tier ? 46 : 40} ry={tier ? 58 : 52} fill="#dbe9ec" stroke={accent} strokeWidth="5" />
      <rect x="268" y="152" width="108" height="54" fill="#6b5a45" />
      <rect x="260" y="144" width="124" height="10" fill="#fffdf9" stroke="#cfc6b3" />
      <ellipse cx="322" cy="146" rx="28" ry="6" fill="#e1dccd" />
      <path d="M322 146v-12" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      <rect x="20" y="100" width="34" height="22" rx="3" fill="#f1e9d9" stroke="#d8cdb6" />
      {tier >= 1 && <g><circle cx="262" cy="128" r="7" fill="#e9b7b0" /><circle cx="274" cy="124" r="6" fill="#d98f86" /></g>}
    </g>
  );
}

function SceneView({ tier, accent }) {
  return (
    <g>
      <rect width="400" height="260" fill="url(#gDusk)" />
      <circle cx="290" cy="96" r="26" fill="#f6d98f" opacity=".95" />
      {tier >= 1 && (<g fill="#8fa6ad" opacity=".85">
        <rect x="60" y="120" width="28" height="90" /><rect x="94" y="96" width="34" height="114" /><rect x="134" y="132" width="26" height="78" />
        <rect x="190" y="108" width="30" height="102" /><rect x="226" y="140" width="36" height="70" /><rect x="320" y="126" width="30" height="84" />
      </g>)}
      <path d="M0 200 Q100 146 200 192 T400 172 V260 H0Z" fill="#8fae96" />
      <path d="M0 226 Q120 186 230 220 T400 208 V260 H0Z" fill="#6f9479" />
      <rect x="10" y="10" width="380" height="240" fill="none" stroke="#6b5a45" strokeWidth="16" />
      <path d="M200 12V248M12 130H388" stroke="#6b5a45" strokeWidth="7" />
      <path d="M12 12h46q-16 120-4 238H12Z" fill={accent} opacity=".5" />
      <path d="M388 12h-46q16 120 4 238h42Z" fill={accent} opacity=".5" />
    </g>
  );
}

function SceneLounge({ tier, accent }) {
  return (
    <g>
      <rect width="400" height="260" fill="url(#gWall)" />
      <rect y="206" width="400" height="54" fill="#b99a6a" opacity=".38" />
      <rect x="58" y="40" width="70" height="52" fill="#fffdf9" stroke="#8a6f45" strokeWidth="4" />
      <path d="M66 82l20-22 16 14 10-10 8 12" fill="none" stroke={accent} strokeWidth="3" />
      {tier < 2 ? (<g>
        <rect x="150" y="128" width="190" height="14" fill="#6b5a45" />
        <rect x="160" y="142" width="10" height="64" fill="#6b5a45" /><rect x="320" y="142" width="10" height="64" fill="#6b5a45" />
        <rect x="190" y="108" width="62" height="20" rx="2" fill="#2d3a34" /><path d="M180 128h82" stroke="#1f1d1a" strokeWidth="3" />
        <path d="M300 128l-8-34h22z" fill="#f3e3b8" /><path d="M303 128V104" stroke="#6b5a45" strokeWidth="3" />
        <rect x="204" y="150" width="46" height="34" rx="8" fill={accent} /><rect x="198" y="178" width="58" height="10" rx="4" fill="#3c4a43" />
      </g>) : (<g>
        <ellipse cx="226" cy="230" rx="130" ry="14" fill={accent} opacity=".25" />
        <rect x="90" y="140" width="250" height="56" rx="12" fill="#3c4a43" />
        <rect x="80" y="126" width="30" height="72" rx="12" fill="#2d3a34" /><rect x="320" y="126" width="30" height="72" rx="12" fill="#2d3a34" />
        <rect x="110" y="120" width="210" height="34" rx="12" fill="#4a5b52" />
        <rect x="150" y="196" width="130" height="22" rx="3" fill="#6b5a45" />
        <rect x="190" y="186" width="30" height="10" rx="3" fill="#fffdf9" /><rect x="230" y="188" width="22" height="8" rx="3" fill={accent} />
      </g>)}
    </g>
  );
}

export function Scene({ scene, tier }) {
  const accent = ACCENT[tier] || ACCENT[0];
  const P = { tier, accent };
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Defs />
      {scene === 'bath' ? <SceneBath {...P} /> : scene === 'view' ? <SceneView {...P} /> : scene === 'lounge' ? <SceneLounge {...P} /> : <SceneBed {...P} />}
    </svg>
  );
}

/** Ảnh thật /images/rooms/<slug>-<n>.jpg nếu có, không thì hình minh họa. */
export function Photo({ slug, n, scene, tier }) {
  const [noPhoto, setNoPhoto] = useState(false);
  return (
    <div className="art">
      <Scene scene={scene} tier={tier} />
      {!noPhoto && slug && <img src={`/images/rooms/${slug}-${n}.jpg`} alt="" onError={() => setNoPhoto(true)} />}
    </div>
  );
}

export function RoomArt({ name, area, capacity }) {
  return <Photo key={name} slug={slugOf(name)} n={1} scene="bed" tier={tierOf(area, capacity)} />;
}

export function Gallery({ name, area, capacity }) {
  const slug = slugOf(name);
  const tier = tierOf(area, capacity);
  const [idx, setIdx] = useState(0);
  const labels = [t('Phòng ngủ'), t('Phòng tắm'), t('Tầm nhìn'), t('Góc sinh hoạt')];
  return (
    <div className="gallery">
      <div className="gal-main"><Photo key={`${slug}-${idx}`} slug={slug} n={idx + 1} scene={SCENES[idx]} tier={tier} /></div>
      <div className="gal-thumbs">
        {SCENES.map((sc, i) => (
          <button key={sc} type="button" className={i === idx ? 'gal-thumb on' : 'gal-thumb'} onClick={() => setIdx(i)} aria-label={labels[i]} title={labels[i]}>
            <Photo key={`${slug}-t${i}`} slug={slug} n={i + 1} scene={sc} tier={tier} />
          </button>
        ))}
      </div>
    </div>
  );
}
