import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

async function csrfAgent() {
  const agent = request.agent(app);
  const res = await agent.get('/api/csrf');
  return { agent, csrf: res.body.csrfToken };
}

describe('rate-limit no login', () => {
  it('requisições sem CSRF (403) não consomem o orçamento do login', async () => {
    const email2 = `rl2-${randomUUID()}@neurocode.dev`;
    // 8 tentativas SEM token CSRF → todas 403, nenhuma deve contar no limiter
    for (let i = 0; i < 8; i++) {
      const r = await request(app).post('/api/auth/login').send({ email: email2, password: 'x' });
      expect(r.status).toBe(403);
    }
    // um agente legítimo (com CSRF) ainda consegue uma resposta de credenciais (401),
    // provando que o orçamento NÃO foi consumido pelos 403 acima
    const { agent, csrf } = await csrfAgent();
    const r = await agent.post('/api/auth/login').set('x-csrf-token', csrf)
      .send({ email: email2, password: 'ErradaTotal9' });
    expect(r.status).toBe(401);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
