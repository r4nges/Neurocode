import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const email = `rl-${randomUUID()}@neurocode.dev`;

async function csrfAgent() {
  const agent = request.agent(app);
  const res = await agent.get('/api/csrf');
  return { agent, csrf: res.body.csrfToken };
}

describe('rate-limit no login', () => {
  it('bloqueia (429) após 5 tentativas falhas', async () => {
    const { agent, csrf } = await csrfAgent();
    const attempt = () =>
      agent.post('/api/auth/login').set('x-csrf-token', csrf)
        .send({ email, password: 'ErradaTotal9' });

    for (let i = 0; i < 5; i++) {
      const r = await attempt();
      expect(r.status).toBe(401);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('Muitas tentativas. Tente novamente mais tarde.');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
});
