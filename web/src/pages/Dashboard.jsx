import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiGet } from '../lib/api.js';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  const pct = data?.weekly ? Math.min(100, Math.round((data.weekly.earned / data.weekly.goal) * 100)) : 0;

  return (
    <>
      <Header />
      <main className="container dash-page">
        <h1>Olá, {user?.name}</h1>
        {error && <p className="rm-error">{error}</p>}
        {data?.weekly && (
          <section className="dash-progress card">
            <h2>Seu progresso</h2>
            <ul className="dash-stats">
              <li><b>Nível {data.level}</b></li>
              <li><b>{data.xp} XP</b></li>
              <li>🔥 {data.streak} dias</li>
              <li>{data.neuroPoints} NeuroPoints</li>
            </ul>

            <div className="dash-weekly">
              <p>Meta semanal: {data.weekly.earned} / {data.weekly.goal} XP</p>
              <div className="progress"><span style={{ width: `${pct}%` }} /></div>
            </div>

            <div className="dash-grid">
              {data.weekly.podium.length > 0 && (
                <div className="dash-podium">
                  <h3>Pódio da semana</h3>
                  <ol>
                    {data.weekly.podium.map((p, i) => (
                      <li key={i}>{p.name} — {p.weeklyXp} XP</li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="dash-badges">
                <h3>Badges</h3>
                {data.badges.length === 0
                  ? <p className="dash-empty">Conclua uma matéria para ganhar seu primeiro badge.</p>
                  : <ul className="badge-list">
                      {data.badges.map((b) => (
                        <li key={b.courseSlug} className="badge">{b.badgeName}</li>
                      ))}
                    </ul>}
              </div>
            </div>
          </section>
        )}

        <div className="dash-actions">
          <Link to="/roadmap" className="btn btn-primary">Ir para o roadmap</Link>
          <Link to="/ranking" className="btn btn-ghost">Ranking</Link>
          <button className="btn btn-ghost" onClick={logout}>Sair</button>
        </div>
      </main>
    </>
  );
}
