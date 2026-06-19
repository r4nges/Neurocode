import { createContext, useContext, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { user } = await apiGet('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email, password) {
    const { user } = await apiPost('/auth/login', { email, password });
    setUser(user);
    return user;
  }

  async function register(name, email, password) {
    const { user } = await apiPost('/auth/register', { name, email, password });
    setUser(user);
    return user;
  }

  async function logout() {
    try {
      await apiPost('/auth/logout', {});
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa de um AuthProvider.');
  return ctx;
}
