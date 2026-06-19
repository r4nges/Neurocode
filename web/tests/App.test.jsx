import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };

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

describe('App — roteamento', () => {
  it('renderiza a landing em "/"', async () => {
    render(
      <MemoryRouter initialEntries={['/']} future={future}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(
      await screen.findByRole('heading', { name: /seu código/i })
    ).toBeInTheDocument();
  });
});
