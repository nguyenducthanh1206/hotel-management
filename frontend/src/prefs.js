import { useSyncExternalStore } from 'react';

const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const state = { lang: read('lang', 'vi'), currency: read('currency', 'VND'), theme: read('theme', 'system') };
let snapshot = { ...state };
const listeners = new Set();

export const lang = () => state.lang;
export const currency = () => state.currency;

function applyTheme() {
  const dark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.lang = state.lang;
}

export function setPref(key, value) {
  state[key] = value;
  try { localStorage.setItem(key, value); } catch { /* bỏ qua */ }
  applyTheme();
  snapshot = { ...state };
  listeners.forEach((l) => l());
}

export const usePrefs = () =>
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => snapshot);

applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state.theme === 'system' && applyTheme());
