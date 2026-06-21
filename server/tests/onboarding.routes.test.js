import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const password = 'Sup3rSecret';
const emails = [];

function newEmail() {
  const e = `onb-${randomUUID()}@neurocode.dev`;
  emails.push(e);
  return e;
}

async function authedAgent() {
  const email = newEmail();
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/csrf')).body.csrfToken;
  await agent.post('/api/auth/register').set('x-csrf-token', csrf).send({ name: 'Onb', email, password });
  return { agent, csrf, email };
}

describe('Onboarding', () => {
  it('novo usuário tem onboardedAt null em /me', async () => {
    const { agent } = await authedAgent();
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.onboardedAt).toBeNull();
  });

  it('GET /onboarding devolve 3 perguntas sem answer', async () => {
    const { agent } = await authedAgent();
    const res = await agent.get('/api/onboarding');
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(3);
    for (const q of res.body.questions) expect(q).not.toHaveProperty('answer');
  });

  it('401 sem sessão em GET /onboarding', async () => {
    const res = await request(app).get('/api/onboarding');
    expect(res.status).toBe(401);
  });

  it('POST /onboarding grava tentativas, marca onboardedAt e exige CSRF', async () => {
    const { agent, csrf, email } = await authedAgent();
    const q = (await agent.get('/api/onboarding')).body.questions;
    const answers = q.map((x) => ({ exerciseId: x.id, answer: 0 }));

    const noCsrf = await request(app).post('/api/onboarding').send({ answers: [] });
    expect(noCsrf.status).toBe(401); // sem sessão

    const res = await agent.post('/api/onboarding').set('x-csrf-token', csrf).send({ answers });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const me = await agent.get('/api/auth/me');
    expect(me.body.user.onboardedAt).not.toBeNull();

    const user = await prisma.user.findUnique({ where: { email } });
    const count = await prisma.attempt.count({ where: { userId: user.id } });
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

afterAll(async () => {
  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.attempt.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
  await prisma.$disconnect();
});
