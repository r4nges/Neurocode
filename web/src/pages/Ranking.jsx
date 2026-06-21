import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGet } from '../lib/api.js';

export default function Ranking() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/ranking').then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Header />
      <main className="container">
        <h1>Ranking</h1>
        {error && <p className="rm-error">{error}</p>}
        {data && (
          <>
            {data.me && (
              <p className="rank-me">Sua posição: <b>#{data.me.rank}</b> · {data.me.xp} XP · Nível {data.me.level}</p>
            )}
            <ol className="rank-list">
              {data.top.map((u, i) => (
                <li key={i} className="rank-row">
                  <span className="rank-pos">#{i + 1}</span>
                  <span className="rank-name">{u.name}</span>
                  <span className="rank-xp">{u.xp} XP · Nv {u.level}</span>
                </li>
              ))}
            </ol>
          </>
        )}
        <Link to="/dashboard" className="btn btn-ghost">Voltar ao dashboard</Link>
      </main>
    </>
  );
}
