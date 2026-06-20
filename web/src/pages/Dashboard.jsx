import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <>
      <Header />
      <main className="container">
        <h1>Dashboard</h1>
        <p>Olá, {user?.name}. Bem-vindo de volta.</p>
        <ul className="dash-stats">
          <li>Nível {user?.level}</li>
          <li>{user?.xp} XP</li>
          <li>{user?.neuroPoints} NeuroPoints</li>
          <li>Plano: {user?.plan}</li>
        </ul>
        <Link to="/roadmap" className="btn btn-primary">Ir para o roadmap</Link>
        <button className="btn btn-ghost" onClick={logout}>Sair</button>
      </main>
    </>
  );
}
