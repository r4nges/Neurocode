import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

// Roteador de fetch fake para os endpoints de auth/csrf.
function mockApi({ me = null } = {}) {
  return vi.fn((url, opts = {}) => {
    if (url.endsWith('/api/csrf')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ csrfToken: 't' }) });
    }
    if (url.endsWith('/api/auth/me')) {
      return me
        ? Promise.resolve({ ok: true, json: () => Promise.resolve({ user: me }) })
        : Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Não autenticado.' }) });
    }
    if (url.endsWith('/api/auth/register')) {
      const body = JSON.parse(opts.body);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { id: 1, name: body.name, email: body.email, plan: 'free', xp: 0, level: 1, neuroPoints: 0, streak: 0 } }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockApi());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Guarda de rotas', () => {
  it('redireciona visitante não autenticado de /dashboard para /login', async () => {
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument();
  });
});

describe('Cadastro', () => {
  it('cria conta e cai na dashboard', async () => {
    vi.stubGlobal('fetch', mockApi());
    renderAt('/register');
    fireEvent.change(await screen.findByLabelText(/nome/i), { target: { value: 'Rangel' } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'r@neuro.dev' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'Sup3rSecret' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });
});
