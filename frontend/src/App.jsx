import { NavLink, Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from './auth.jsx';
import PrefsBar from './PrefsBar.jsx';
import { t } from './i18n.js';
import { roleLabel } from './ui.jsx';
import Login from './pages/Login.jsx';
import Search from './pages/Search.jsx';
import Lookup from './pages/Lookup.jsx';
import MyBookings from './pages/MyBookings.jsx';
import FrontDesk from './pages/FrontDesk.jsx';
import Today from './pages/Today.jsx';
import Timeline from './pages/Timeline.jsx';
import RoomBoard from './pages/RoomBoard.jsx';
import Admin from './pages/Admin.jsx';

function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function PublicShell({ children }) {
  const { user, logout } = useAuth();
  const home = useLocation().pathname === '/';
  return (
    <div className="site">
      <header className={`pubbar ${home ? '' : 'solid'}`}>
        <Link to="/" className="logo">Hotel</Link>
        <nav>
          <NavLink to="/" end>{t('Hạng phòng')}</NavLink>
          <NavLink to="/lookup">{t('Tra cứu đặt phòng')}</NavLink>
          {user?.role === 'Guest' && <NavLink to="/my">{t('Booking của tôi')}</NavLink>}
          <PrefsBar onDark />
          {user ? (
            <>
              <span className="pub-user">{user.fullName}</span>
              <button className="pub-link" onClick={logout}>{t('Đăng xuất')}</button>
            </>
          ) : (
            <NavLink to="/login" className="pub-cta">{t('Đăng nhập')}</NavLink>
          )}
        </nav>
      </header>
      <main className={home ? '' : 'pagebody'}>{children}</main>
      <footer className="footer">
        <div className="logo logo-sm">Hotel</div>
        <p>{t('Nhận phòng từ 14:00 · Trả phòng trước 12:00')}</p>
      </footer>
    </div>
  );
}

function StaffShell({ role, children }) {
  const { user, logout } = useAuth();
  const front = role !== 'Housekeeping';
  return (
    <div className="shell">
      <aside className="side">
        <Link to={homeFor(role)} className="logo">Hotel</Link>
        <nav>
          <div className="side-label">{t('Vận hành')}</div>
          {front && <NavLink to="/today">{t('Hôm nay')}</NavLink>}
          {front && <NavLink to="/timeline">{t('Lịch phòng')}</NavLink>}
          {front && <NavLink to="/desk">{t('Booking')}</NavLink>}
          <NavLink to="/rooms">{t('Sơ đồ phòng')}</NavLink>
          {front && <NavLink to="/" end>{t('Đặt phòng hộ khách')}</NavLink>}
          {role === 'Admin' && (<>
            <div className="side-label">{t('Quản trị')}</div>
            <NavLink to="/admin">{t('Thống kê & cấu hình')}</NavLink>
          </>)}
        </nav>
        <PrefsBar onDark />
        <div className="side-user">
          <strong>{user.fullName}</strong>
          <span>{roleLabel(role)}</span>
          <button className="btn btn-ghost btn-dark" onClick={logout}>{t('Đăng xuất')}</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  const loc = useLocation();
  const role = user?.role;
  const staff = ['Receptionist', 'Housekeeping', 'Admin'].includes(role);

  if (loc.pathname === '/login') return <Login />;

  const routes = (
    <Routes>
      <Route path="/" element={role === 'Housekeeping' ? <Navigate to="/rooms" replace /> : <Search />} />
      <Route path="/lookup" element={<Lookup />} />
      <Route path="/my" element={<Guard roles={['Guest']}><MyBookings /></Guard>} />
      <Route path="/today" element={<Guard roles={['Receptionist', 'Admin']}><Today /></Guard>} />
      <Route path="/timeline" element={<Guard roles={['Receptionist', 'Admin']}><Timeline /></Guard>} />
      <Route path="/desk" element={<Guard roles={['Receptionist', 'Admin']}><FrontDesk /></Guard>} />
      <Route path="/rooms" element={<Guard roles={['Receptionist', 'Housekeeping', 'Admin']}><RoomBoard /></Guard>} />
      <Route path="/admin" element={<Guard roles={['Admin']}><Admin /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return staff ? <StaffShell role={role}>{routes}</StaffShell> : <PublicShell>{routes}</PublicShell>;
}
