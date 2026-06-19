import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      url.endsWith('/api/auth/me')
        ? Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'x' }) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
    )
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Landing', () => {
  it('mostra o heading do hero', async () => {
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: /seu código/i })
    ).toBeInTheDocument();
  });

  it('navega para /register ao clicar em "Comece grátis"', async () => {
    renderApp('/');
    fireEvent.click((await screen.findAllByRole('link', { name: /comece grátis/i }))[0]);
    expect(
      await screen.findByRole('heading', { name: /criar conta/i })
    ).toBeInTheDocument();
  });

  it('exibe "API online" quando /api/health responde ok', async () => {
    renderApp('/');
    expect(await screen.findByText(/api online/i)).toBeInTheDocument();
  });
});
