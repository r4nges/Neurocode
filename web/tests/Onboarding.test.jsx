import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const user = { id: 1, name: 'Rangel', email: 'r@neuro.dev', plan: 'free', xp: 0, level: 1, neuroPoints: 0, streak: 0, onboardedAt: null };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn((url, opts = {}) => {
  const ok = (b) => Promise.resolve({ ok: true, json: () => Promise.resolve(b) });
  if (url.endsWith('/api/auth/me')) return ok({ user });
  if (url.endsWith('/api/csrf')) return ok({ csrfToken: 't' });
  if (url.endsWith('/api/onboarding') && opts.method === 'POST') return ok({ ok: true });
  if (url.endsWith('/api/onboarding')) return ok({ questions: [
    { id: 1, type: 'multiple-choice', prompt: 'P1?', options: ['a', 'b'], conceptTag: 'tags' },
    { id: 2, type: 'multiple-choice', prompt: 'P2?', options: ['a', 'b'], conceptTag: 'seletores' },
    { id: 3, type: 'multiple-choice', prompt: 'P3?', options: ['a', 'b'], conceptTag: 'variaveis' },
  ] });
  return ok({});
})));
afterEach(() => vi.unstubAllGlobals());

describe('Onboarding', () => {
  it('mostra a 1ª pergunta e envia as respostas', async () => {
    renderAt('/onboarding');
    expect(await screen.findByText('P1?')).toBeInTheDocument();
    // responde as 3 (escolhe a 1ª alternativa e avança)
    for (let i = 0; i < 3; i++) {
      fireEvent.click(await screen.findByRole('button', { name: 'a' }));
      fireEvent.click(await screen.findByRole('button', { name: /próxima|concluir/i }));
    }
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/onboarding'),
        expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-CSRF-Token': expect.any(String) }) })
      )
    );
  });
});
