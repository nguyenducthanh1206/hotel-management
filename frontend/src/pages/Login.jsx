import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth.jsx';
import PrefsBar from '../PrefsBar.jsx';
import { t } from '../i18n.js';
import { Notice } from '../ui.jsx';

const DEMO = [['Quản lý', 'admin', 'Admin@123'], ['Lễ tân', 'letan', 'Letan@123'], ['Buồng phòng', 'buongphong', 'Buong@123'], ['Khách hàng', 'khach', 'Khach@123']];

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', password: '', fullName: '', phone: '', email: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const u = mode === 'login' ? await login(f.username, f.password) : await register(f);
      nav(loc.state?.from || homeFor(u.role), { replace: true });
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <div className="login">
      <aside className="login-art">
        <Link to="/" className="logo">Hotel</Link>
        <div>
          <p className="eyebrow">{t('Chào mừng trở lại')}</p>
          <h2 className="login-quote">{t('Nơi mỗi chuyến đi bắt đầu bằng một giấc ngủ ngon.')}</h2>
        </div>
        <p className="login-foot">{t('Nhận phòng từ 14:00 · Trả phòng trước 12:00')}</p>
      </aside>

      <section className="login-main">
        <div className="login-top"><PrefsBar /></div>
        <div className="login-box">
          <Link to="/" className="back">← {t('Về trang chủ')}</Link>
          <h1>{mode === 'login' ? t('Đăng nhập') : t('Tạo tài khoản')}</h1>
          <p className="muted">{mode === 'login' ? t('Dành cho khách hàng và nhân viên khách sạn.') : t('Tài khoản dành cho khách đặt phòng trực tuyến.')}</p>
          <form onSubmit={submit} className="form">
            <label>{t('Tên đăng nhập')}<input value={f.username} onChange={set('username')} required autoFocus autoComplete="username" /></label>
            <label>{t('Mật khẩu')}<input type="password" value={f.password} onChange={set('password')} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {mode === 'register' && (<>
              <label>{t('Họ tên')}<input value={f.fullName} onChange={set('fullName')} required /></label>
              <div className="row">
                <label>{t('Số điện thoại')}<input value={f.phone} onChange={set('phone')} /></label>
                <label>Email<input type="email" value={f.email} onChange={set('email')} /></label>
              </div>
            </>)}
            <Notice error={err} />
            <button className="btn btn-primary btn-lg">{mode === 'login' ? t('Đăng nhập') : t('Đăng ký')}</button>
          </form>
          <p className="muted small">
            {mode === 'login' ? t('Chưa có tài khoản?') : t('Đã có tài khoản?')}{' '}
            <button className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
              {mode === 'login' ? t('Đăng ký khách hàng') : t('Đăng nhập')}
            </button>
          </p>
          {mode === 'login' && (
            <div className="demo">
              <div className="demo-title">{t('Tài khoản demo (bấm để điền sẵn)')}</div>
              <div className="demo-grid">
                {DEMO.map(([label, u, p]) => (
                  <button key={u} type="button" className="demo-item" onClick={() => setF({ ...f, username: u, password: p })}>
                    <strong>{t(label)}</strong><span>{u} / {p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
