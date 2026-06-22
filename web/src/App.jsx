import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Roadmap from './pages/Roadmap.jsx';
import Course from './pages/Course.jsx';
import Lesson from './pages/Lesson.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Ranking from './pages/Ranking.jsx';
import Settings from './pages/Settings.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/curso/:slug" element={<Course />} />
        <Route path="/aula/:id" element={<Lesson />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/configuracoes" element={<Settings />} />
      </Route>
    </Routes>
  );
}
