import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';

function Login() {
  return <h1>Entrar</h1>;
}

function Register() {
  return <h1>Criar conta</h1>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}
