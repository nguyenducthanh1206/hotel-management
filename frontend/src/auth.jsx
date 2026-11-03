import { createContext, useContext, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  const save = (s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('user', JSON.stringify(s.user));
    setUser(s.user);
    return s.user;
  };
  const login = async (username, password) => save(await api('/auth/login', { method: 'POST', body: { username, password } }));
  const register = async (form) => save(await api('/auth/register', { method: 'POST', body: form }));
  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); };

  return <Ctx.Provider value={{ user, login, register, logout }}>{children}</Ctx.Provider>;
}

export const homeFor = (role) =>
  role === 'Admin' ? '/admin' : role === 'Receptionist' ? '/today' : role === 'Housekeeping' ? '/rooms' : '/';
