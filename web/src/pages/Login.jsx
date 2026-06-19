import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Header />
      <main className="auth-page container">
        <h1>Entrar</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary">Entrar</button>
        </form>
        <p className="auth-alt">
          Não tem conta? <Link to="/register">Criar conta</Link>
        </p>
      </main>
    </>
  );
}
