import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGet } from '../lib/api.js';

export default function Landing() {
  const [apiOk, setApiOk] = useState(null);

  useEffect(() => {
    apiGet('/health')
      .then((d) => setApiOk(d.status === 'ok'))
      .catch(() => setApiOk(false));
  }, []);

  return (
    <>
      <Header />
      <main className="hero">
        <div className="container">
          <h1>Seu cérebro, seu ritmo, seu código.</h1>
          <p className="hero-lead">
            A plataforma de programação que se adapta a como você aprende.
            Trilhas gamificadas, exercícios gerados por IA e progresso no seu ritmo.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary">Comece grátis</Link>
            <Link to="/login" className="btn btn-ghost">Entrar</Link>
          </div>
          {apiOk === true && <p className="api-status">● API online</p>}
          {apiOk === false && <p className="api-status off">● API offline</p>}
        </div>
      </main>
    </>
  );
}
