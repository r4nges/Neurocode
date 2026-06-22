import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const THEME_KEY = 'neurocode-theme';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark'
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title="Alternar tema"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate('/');
  }

  return (
    <header className="site-header">
      <nav className="nav container">
        <Link to={user ? '/dashboard' : '/'} className="brand" aria-label="NeuroCode — início">
          <span className="brand-mark"><img src="/logo.svg" alt="" /></span>
          <span><b>Neuro</b><span className="accent">Code</span></span>
        </Link>

        <div className="nav-actions">
          <ThemeToggle />

          {user ? (
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-menu-trigger"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <span className="avatar avatar-sm">{initials(user.name)}</span>
                <span className="user-menu-name">{user.name}</span>
                <svg className="user-menu-caret" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {open && (
                <div className="user-menu-panel" role="menu">
                  <div className="user-menu-head">
                    <span className="avatar">{initials(user.name)}</span>
                    <div className="user-menu-id">
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>

                  <div className="user-menu-notif">
                    <div className="user-menu-notif-head">
                      <span>🔔 Notificações</span>
                    </div>
                    <p className="user-menu-empty">Você está em dia. Nenhuma novidade por enquanto.</p>
                  </div>

                  <div className="user-menu-sep" />

                  <div className="user-menu-list">
                    <Link to="/roadmap" role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
                      <span className="user-menu-ic" aria-hidden="true">📚</span> Aulas
                    </Link>
                    <Link to="/configuracoes" role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
                      <span className="user-menu-ic" aria-hidden="true">⚙️</span> Configurações
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="user-menu-item user-menu-item--danger"
                      onClick={handleLogout}
                    >
                      <span className="user-menu-ic" aria-hidden="true">🚪</span> Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Entrar</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Comece grátis</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
