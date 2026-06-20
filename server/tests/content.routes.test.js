import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const password = 'Sup3rSecret';
const createdEmails = [];

// Agent autenticado: registra um usuário único e guarda o token CSRF.
async function authedAgent(uniqueEmail = `route-${randomUUID()}@neurocode.dev`) {
  createdEmails.push(uniqueEmail);
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/csrf');
  const csrf = csrfRes.body.csrfToken;
  await agent.post('/api/auth/register').set('x-csrf-token', csrf)
    .send({ name: 'Rota', email: uniqueEmail, password });
  return { agent, csrf };
}

async function htmlLessonIds() {
  const course = await prisma.course.findUnique({
    where: { slug: 'html' },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });
  return course.lessons.map((l) => l.id);
}

describe('Rotas de conteúdo — exigem sessão', () => {
  it('401 sem sessão em GET /api/roadmaps', async () => {
    const res = await request(app).get('/api/roadmaps');
    expect(res.status).toBe(401);
  });
});

describe('Leitura de conteúdo (autenticado)', () => {
  it('lista roadmaps e abre o Front-end', async () => {
    const { agent } = await authedAgent();
    const list = await agent.get('/api/roadmaps');
    expect(list.status).toBe(200);
    expect(list.body.roadmaps[0].slug).toBe('desenvolvedor-front-end');

    const rm = await agent.get('/api/roadmaps/desenvolvedor-front-end');
    expect(rm.status).toBe(200);
    expect(rm.body.roadmap.courses.find((c) => c.slug === 'html').locked).toBe(false);

    const course = await agent.get('/api/courses/html');
    expect(course.status).toBe(200);
    expect(course.body.course.lessons[0].status).toBe('available');

    const lessonId = course.body.course.lessons[0].id;
    const lesson = await agent.get(`/api/lessons/${lessonId}`);
    expect(lesson.status).toBe(200);
    expect(Array.isArray(lesson.body.lesson.content)).toBe(true);
  });

  it('404 para roadmap inexistente e 400 para id de aula inválido', async () => {
    const { agent } = await authedAgent();
    expect((await agent.get('/api/roadmaps/nao-existe')).status).toBe(404);
    expect((await agent.get('/api/lessons/abc')).status).toBe(400);
  });
});

describe('Sessão e conclusão de aula', () => {
  it('GET /session monta sessão sem answer; conclui com 100%', async () => {
    const { agent, csrf } = await authedAgent();
    const [first] = await htmlLessonIds();

    const sess = await agent.get(`/api/lessons/${first}/session`);
    expect(sess.status).toBe(200);
    expect(Array.isArray(sess.body.exercises)).toBe(true);
    for (const ex of sess.body.exercises) expect(ex).not.toHaveProperty('answer');
    const token = sess.body.sessionToken;

    // Responde tudo certo (busca o answer real no banco — server-side, é teste).
    const prismaDb = (await import('../src/db/client.js')).default;
    for (const ex of sess.body.exercises) {
      const real = await prismaDb.exercise.findUnique({ where: { id: ex.id } });
      const att = await agent.post(`/api/exercises/${ex.id}/attempt`)
        .set('x-csrf-token', csrf)
        .send({ sessionToken: token, answer: JSON.parse(real.answer) });
      expect(att.status).toBe(200);
      expect(att.body.correct).toBe(true);
    }

    const done = await agent.post(`/api/lessons/${first}/complete`)
      .set('x-csrf-token', csrf)
      .send({ sessionToken: token });
    expect(done.status).toBe(200);
    expect(done.body.completed).toBe(true);
    expect(done.body.score).toBeGreaterThanOrEqual(80);
  });

  it('401 sem sessão em GET /session e POST /attempt', async () => {
    const ids = await htmlLessonIds();
    expect((await request(app).get(`/api/lessons/${ids[0]}/session`)).status).toBe(401);
    expect((await request(app).post(`/api/exercises/${ids[0]}/attempt`).send({})).status).toBe(401);
  });

  it('409 ao montar sessão de aula bloqueada', async () => {
    const { agent } = await authedAgent();
    const css = await agent.get('/api/courses/css');
    const lockedLessonId = css.body.course.lessons[0].id;
    const res = await agent.get(`/api/lessons/${lockedLessonId}/session`);
    expect(res.status).toBe(409);
  });

  it('401 em POST /complete sem sessão de usuário', async () => {
    const [first] = await htmlLessonIds();
    const res = await request(app)
      .post(`/api/lessons/${first}/complete`)
      .send({});
    expect(res.status).toBe(401);
  });

  it('400 em POST /complete sem sessionToken no body', async () => {
    const { agent, csrf } = await authedAgent();
    const [first] = await htmlLessonIds();
    const res = await agent
      .post(`/api/lessons/${first}/complete`)
      .set('x-csrf-token', csrf)
      .send({});
    expect(res.status).toBe(400);
  });
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: createdEmails } } });
  for (const user of users) {
    await prisma.attempt.deleteMany({ where: { userId: user.id } });
    await prisma.progress.deleteMany({ where: { userId: user.id } });
    await prisma.lessonSession.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});
