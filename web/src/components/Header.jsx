import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="site-header">
      <nav className="nav container">
        <Link to="/" className="brand">
          <b>Neuro</b><span className="accent">Code</span>
        </Link>
        <div className="nav-actions">
          <Link to="/login" className="btn btn-ghost btn-sm">Entrar</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Comece grátis</Link>
        </div>
      </nav>
    </header>
  );
}
