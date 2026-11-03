import { Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { DialogProvider } from './dialogs.jsx';
import { usePrefs } from './prefs.js';
import './styles.css';

// Đổi ngôn ngữ hoặc tiền tệ thì dựng lại giao diện để mọi chữ và số được định dạng lại.
function Root() {
  const p = usePrefs();
  return (
    <AuthProvider>
      <Fragment key={`${p.lang}|${p.currency}`}>
        <DialogProvider>
          <App />
        </DialogProvider>
      </Fragment>
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Root />
  </BrowserRouter>
);
