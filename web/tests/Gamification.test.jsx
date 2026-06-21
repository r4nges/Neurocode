import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const user = { id: 1, name: 'Rangel', email: 'r@neuro.dev', plan: 'free', xp: 300, level: 2, neuroPoints: 120, streak: 4 };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>
  );
}

const dashboard = {
  xp: 300, level: 2, neuroPoints: 120, streak: 4,
  weekly: { earned: 300, goal: 500, podium: [{ name: 'Rangel', weeklyXp: 300 }, { name: 'Ana', weeklyXp: 120 }] },
  badges: [{ courseSlug: 'html', badgeName: 'Estruturador', badgeIcon: 'FileCode', earnedAt: '2026-06-21T10:00:00Z' }],
};
const ranking = {
  top: [{ name: 'Rangel', xp: 300, level: 2 }, { name: 'Ana', xp: 120, level: 1 }],
  me: { rank: 1, xp: 300, level: 2 },
};

function mockApi() {
  return vi.fn((url) => {
    const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    if (url.endsWith('/api/auth/me')) return ok({ user });
    if (url.endsWith('/api/csrf')) return ok({ csrfToken: 't' });
    if (url.endsWith('/api/dashboard')) return ok(dashboard);
    if (url.endsWith('/api/ranking')) return ok(ranking);
    return ok({});
  });
}

beforeEach(() => vi.stubGlobal('fetch', mockApi()));
afterEach(() => vi.unstubAllGlobals());

describe('Dashboard — painel Seu progresso', () => {
  it('mostra nível, streak, meta semanal e badges', async () => {
    renderAt('/dashboard');
    // asserções deliberadamente únicas no DOM (evita multi-match do findByText):
    expect(await screen.findByText(/300\s*\/\s*500/)).toBeInTheDocument(); // meta semanal
    expect(await screen.findByText(/Nível 2/)).toBeInTheDocument();        // só nas stats
    expect(await screen.findByText(/4 dias/)).toBeInTheDocument();         // streak
    expect(await screen.findByText('Estruturador')).toBeInTheDocument();   // badge-list
  });
});

describe('Página /ranking', () => {
  it('mostra o leaderboard e minha posição', async () => {
    renderAt('/ranking');
    expect(await screen.findByText('Ranking')).toBeInTheDocument();        // <h1>
    expect(await screen.findAllByText('Rangel')).not.toHaveLength(0);
    // "#1" aparece em rank-me e no topo da lista -> usar findAllByText:
    expect((await screen.findAllByText(/#1/)).length).toBeGreaterThanOrEqual(1);
  });
});
