import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
    )
  );
});

describe('Landing', () => {
  it('mostra o heading do hero', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(
      screen.getByRole('heading', { name: /seu código/i })
    ).toBeInTheDocument();
  });

  it('navega para /register ao clicar em "Comece grátis"', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    fireEvent.click(screen.getAllByRole('link', { name: /comece grátis/i })[0]);
    expect(
      await screen.findByRole('heading', { name: /criar conta/i })
    ).toBeInTheDocument();
  });

  it('exibe "API online" quando /api/health responde ok', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByText(/api online/i)).toBeInTheDocument();
  });
});
