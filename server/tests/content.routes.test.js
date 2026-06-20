import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const password = 'Sup3rSecret';
const email = `route-${randomUUID()}@neurocode.dev`;
const createdEmails = [email];

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

describe('Conclusão de aula', () => {
  it('exige CSRF, conclui a aula disponível e libera a próxima', async () => {
    const { agent, csrf } = await authedAgent();
    const [first, second] = await htmlLessonIds();

    const noCsrf = await request(app).post(`/api/lessons/${first}/complete`).send({});
    expect(noCsrf.status).toBe(401); // sem sessão nem CSRF

    const ok = await agent.post(`/api/lessons/${first}/complete`).set('x-csrf-token', csrf).send({});
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ ok: true, nextLessonId: second, courseCompleted: false });
  });

  it('409 ao tentar concluir uma aula bloqueada', async () => {
    const { agent, csrf } = await authedAgent();
    const ids = await htmlLessonIds();
    const blocked = await agent.post(`/api/lessons/${ids[2]}/complete`).set('x-csrf-token', csrf).send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('Aula bloqueada. Conclua a anterior primeiro.');
  });
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: createdEmails } } });
  for (const user of users) {
    await prisma.progress.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});
