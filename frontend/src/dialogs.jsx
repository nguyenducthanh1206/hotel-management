import { createContext, useCallback, useContext, useState } from 'react';
import { Modal } from './ui.jsx';
import { t } from './i18n.js';

const Ctx = createContext(null);
export const useDialogs = () => useContext(Ctx);

/** Thay window.confirm / window.prompt / alert bằng cửa sổ và thông báo (toast) của ứng dụng. */
export function DialogProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dlg, setDlg] = useState(null);
  const [value, setValue] = useState('');

  const toast = useCallback((message, kind = 'ok') => {
    const id = Math.random();
    setToasts((x) => [...x, { id, message, kind }]);
    setTimeout(() => setToasts((x) => x.filter((i) => i.id !== id)), kind === 'err' ? 7000 : 4500);
  }, []);
  const confirm = useCallback((o) => new Promise((res) => setDlg({ type: 'confirm', ...o, res })), []);
  const ask = useCallback((o) => new Promise((res) => { setValue(o.defaultValue || ''); setDlg({ type: 'ask', ...o, res }); }), []);

  const close = (result) => { dlg.res(result); setDlg(null); };

  return (
    <Ctx.Provider value={{ toast, confirm, ask }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => <div key={x.id} className={`toast toast-${x.kind}`} role={x.kind === 'err' ? 'alert' : 'status'}>{x.message}</div>)}
      </div>
      {dlg && (
        <Modal title={dlg.title} onClose={() => close(dlg.type === 'ask' ? null : false)}>
          {dlg.type === 'confirm' ? (
            <div className="form">
              {dlg.message && <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{dlg.message}</p>}
              <div className="actions">
                <button className={`btn ${dlg.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus onClick={() => close(true)}>{dlg.confirmText || t('Xác nhận')}</button>
                <button className="btn btn-ghost" onClick={() => close(false)}>{t('Hủy bỏ')}</button>
              </div>
            </div>
          ) : (
            <form className="form" onSubmit={(e) => { e.preventDefault(); if (dlg.required && !value.trim()) return; close(value); }}>
              {dlg.message && <p style={{ margin: 0 }}>{dlg.message}</p>}
              <label>{dlg.label}<input autoFocus value={value} onChange={(e) => setValue(e.target.value)} /></label>
              <div className="actions">
                <button className="btn btn-primary">{dlg.confirmText || t('Xác nhận')}</button>
                <button type="button" className="btn btn-ghost" onClick={() => close(null)}>{t('Hủy bỏ')}</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </Ctx.Provider>
  );
}
