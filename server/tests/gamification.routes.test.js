import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const createdEmails = [];

async function authedAgent() {
  const email = `groute-${randomUUID()}@neurocode.dev`;
  createdEmails.push(email);
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/csrf')).body.csrfToken;
  await agent.post('/api/auth/register').set('x-csrf-token', csrf)
    .send({ name: 'GRoute', email, password: 'Sup3rSecret' });
  return agent;
}

describe('Rotas de gamificação — exigem sessão', () => {
  it('401 sem sessão em GET /api/dashboard', async () => {
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
  });
  it('401 sem sessão em GET /api/ranking', async () => {
    expect((await request(app).get('/api/ranking')).status).toBe(401);
  });
});

describe('Rotas de gamificação (autenticado)', () => {
  it('GET /api/dashboard devolve o formato do painel', async () => {
    const agent = await authedAgent();
    const res = await agent.get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      xp: expect.any(Number), level: expect.any(Number),
      neuroPoints: expect.any(Number), streak: expect.any(Number),
      weekly: { earned: expect.any(Number), goal: 500, podium: expect.any(Array) },
      badges: expect.any(Array),
    });
  });

  it('GET /api/ranking devolve top + minha posição', async () => {
    const agent = await authedAgent();
    const res = await agent.get('/api/ranking');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.top)).toBe(true);
    expect(res.body.me).toMatchObject({ rank: expect.any(Number), xp: expect.any(Number), level: expect.any(Number) });
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});
