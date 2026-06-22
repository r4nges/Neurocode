import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const THEME_KEY = 'neurocode-theme';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || localStorage.getItem(THEME_KEY) || 'dark'
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const planLabel = user?.plan === 'free' ? 'Grátis' : user?.plan;

  return (
    <>
      <Header />
      <main className="container settings-page">
        <h1>Configurações</h1>

        <section className="card settings-card">
          <h2>Conta</h2>
          <dl className="settings-info">
            <div><dt>Nome</dt><dd>{user?.name}</dd></div>
            <div><dt>E-mail</dt><dd>{user?.email}</dd></div>
            <div><dt>Plano</dt><dd>{planLabel}</dd></div>
          </dl>
        </section>

        <section className="card settings-card">
          <h2>Aparência</h2>
          <div className="settings-row">
            <div>
              <strong>Tema</strong>
              <p className="settings-hint">Escolha entre o modo escuro e o claro.</p>
            </div>
            <div className="settings-theme">
              <button
                type="button"
                className={`chip ${theme === 'dark' ? 'is-active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                🌙 Escuro
              </button>
              <button
                type="button"
                className={`chip ${theme === 'light' ? 'is-active' : ''}`}
                onClick={() => setTheme('light')}
              >
                ☀️ Claro
              </button>
            </div>
          </div>
        </section>

        <div className="settings-actions">
          <Link to="/roadmap" className="btn btn-primary">Voltar às aulas</Link>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>Sair</button>
        </div>
      </main>
    </>
  );
}
