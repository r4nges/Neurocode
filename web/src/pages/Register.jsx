import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const u = await register(name, email, password);
      navigate(u?.onboardedAt ? '/dashboard' : '/onboarding');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Header />
      <main className="auth-page container">
        <h1>Criar conta</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="name">Nome</label>
          <input id="name" type="text" value={name}
            onChange={(e) => setName(e.target.value)} required />
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          <p className="auth-hint">Mín. 8 caracteres, com maiúscula, minúscula e número.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary">Criar conta</button>
        </form>
        <p className="auth-alt">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </main>
    </>
  );
}
