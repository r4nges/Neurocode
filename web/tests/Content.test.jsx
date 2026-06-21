import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const user = { id: 1, name: 'Rangel', email: 'r@neuro.dev', plan: 'free', xp: 0, level: 1, neuroPoints: 0, streak: 0 };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

const roadmapFE = {
  slug: 'desenvolvedor-front-end', title: 'Desenvolvedor Front-end', description: 'x', icon: 'Code2', isLocked: false,
  courses: [
    { slug: 'html', title: 'HTML', description: 'estrutura', order: 1, badgeName: 'Estruturador', badgeIcon: 'FileCode', pointsReward: 100, locked: false, completed: false, lessonsTotal: 3, lessonsCompleted: 0 },
    { slug: 'css', title: 'CSS', description: 'estilo', order: 2, badgeName: 'Estilista', badgeIcon: 'Palette', pointsReward: 120, locked: true, completed: false, lessonsTotal: 3, lessonsCompleted: 0 },
  ],
};
const lesson1 = {
  id: 1, title: 'O que é HTML', order: 1, courseSlug: 'html', courseTitle: 'HTML', status: 'available', nextLessonId: 2,
  conceptTags: ['html-basico'],
  content: [{ type: 'heading', text: 'Uma página mínima' }, { type: 'paragraph', text: 'HTML descreve a estrutura.' }],
};

function mockApi() {
  return vi.fn((url, opts = {}) => {
    const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    if (url.endsWith('/api/auth/me')) return ok({ user });
    if (url.endsWith('/api/csrf')) return ok({ csrfToken: 't' });
    if (url.endsWith('/api/roadmaps/desenvolvedor-front-end')) return ok({ roadmap: roadmapFE });
    if (url.endsWith('/api/roadmaps')) return ok({ roadmaps: [{ slug: 'desenvolvedor-front-end', title: 'Desenvolvedor Front-end', description: 'x', icon: 'Code2', isLocked: false, order: 1 }, { slug: 'devops', title: 'DevOps', description: 'em breve', icon: 'Server', isLocked: true, order: 2 }] });
    if (url.endsWith('/api/lessons/1/session')) return ok({
      ok: true, sessionToken: 'tok', lessonTitle: 'O que é HTML', courseSlug: 'html',
      exercises: [{ id: 10, type: 'multiple-choice', prompt: 'Qual cria link?', options: ['<p>', '<a>'], difficulty: 1, conceptTag: 'tags' }],
    });
    if (url.endsWith('/api/exercises/10/attempt')) return ok({ correct: true, solution: 1 });
    if (url.endsWith('/api/lessons/1/complete')) return ok({ ok: true, completed: true, score: 100, nextLessonId: null, courseCompleted: false });
    if (url.endsWith('/api/lessons/2')) return ok({ lesson: { id: 2, title: 'Tags e estrutura', order: 2, courseSlug: 'html', courseTitle: 'HTML', status: 'available', nextLessonId: null, conceptTags: [], content: [{ type: 'paragraph', text: 'segunda aula carregada' }] } });
    if (url.endsWith('/api/lessons/1')) return ok({ lesson: lesson1 });
    return ok({});
  });
}

beforeEach(() => vi.stubGlobal('fetch', mockApi()));
afterEach(() => vi.unstubAllGlobals());

describe('Tela de Roadmap', () => {
  it('mostra a matéria HTML e a carreira bloqueada DevOps', async () => {
    renderAt('/roadmap');
    expect(await screen.findByText('HTML')).toBeInTheDocument();
    expect(await screen.findByText('DevOps')).toBeInTheDocument();
  });
});

describe('Tela de Aula — sessão de exercícios', () => {
  it('mostra a teoria, inicia a sessão e conclui com aprovação', async () => {
    renderAt('/aula/1');
    // teoria primeiro
    expect(await screen.findByText('Uma página mínima')).toBeInTheDocument();
    // inicia a sessão
    fireEvent.click(await screen.findByRole('button', { name: /começar exercícios/i }));
    // o exercício aparece
    expect(await screen.findByText('Qual cria link?')).toBeInTheDocument();
    // escolhe a alternativa correta e verifica
    fireEvent.click(await screen.findByRole('button', { name: '<a>' }));
    fireEvent.click(await screen.findByRole('button', { name: /verificar/i }));
    // feedback de acerto e avançar -> conclui -> resultado de aprovação
    fireEvent.click(await screen.findByRole('button', { name: /continuar/i }));
    expect(await screen.findByText(/aula concluída/i)).toBeInTheDocument();
    // o attempt foi enviado com CSRF (via apiPost):
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/exercises/10/attempt'),
        expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-CSRF-Token': expect.any(String) }) })
      )
    );
  });
});
