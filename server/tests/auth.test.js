import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const password = 'Sup3rSecret';
const emails = [];

function newEmail() {
  const e = `auth-${randomUUID()}@neurocode.dev`;
  emails.push(e);
  return e;
}

// Agent com cookies persistentes + token CSRF já obtido.
async function csrfAgent() {
  const agent = request.agent(app);
  const res = await agent.get('/api/csrf');
  return { agent, csrf: res.body.csrfToken };
}

describe('POST /api/auth/register', () => {
  it('cria o usuário, seta cookie de sessão e não vaza o hash', async () => {
    const email = newEmail();
    const { agent, csrf } = await csrfAgent();
    const res = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'Rangel', email, password });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, plan: 'free', level: 1 });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'].join(';')).toContain('nc_session=');

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored.passwordHash).not.toBe(password);
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('bloqueia sem token CSRF (403)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: newEmail(), password });
    expect(res.status).toBe(403);
  });

  it('rejeita senha fraca (400)', async () => {
    const { agent, csrf } = await csrfAgent();
    const res = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'Rangel', email: newEmail(), password: 'fraca' });
    expect(res.status).toBe(400);
  });

  it('rejeita e-mail duplicado com mensagem genérica (409)', async () => {
    const email = newEmail();
    const a = await csrfAgent();
    await a.agent.post('/api/auth/register').set('x-csrf-token', a.csrf)
      .send({ name: 'AA', email, password });
    const b = await csrfAgent();
    const res = await b.agent.post('/api/auth/register').set('x-csrf-token', b.csrf)
      .send({ name: 'BB', email, password });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Não foi possível concluir o cadastro.');
  });
});

describe('POST /api/auth/login', () => {
  it('autentica com credenciais corretas', async () => {
    const email = newEmail();
    const reg = await csrfAgent();
    await reg.agent.post('/api/auth/register').set('x-csrf-token', reg.csrf)
      .send({ name: 'Rangel', email, password });

    const { agent, csrf } = await csrfAgent();
    const res = await agent.post('/api/auth/login').set('x-csrf-token', csrf)
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it('erro genérico para senha errada (401) — sem revelar se o e-mail existe', async () => {
    const email = newEmail();
    const reg = await csrfAgent();
    await reg.agent.post('/api/auth/register').set('x-csrf-token', reg.csrf)
      .send({ name: 'Rangel', email, password });

    const { agent, csrf } = await csrfAgent();
    const res = await agent.post('/api/auth/login').set('x-csrf-token', csrf)
      .send({ email, password: 'ErradaTotal9' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciais inválidas.');
  });

  it('mesmo erro genérico para e-mail inexistente (401)', async () => {
    const { agent, csrf } = await csrfAgent();
    const res = await agent.post('/api/auth/login').set('x-csrf-token', csrf)
      .send({ email: `nao-existe-${randomUUID()}@x.dev`, password });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciais inválidas.');
  });
});

describe('GET /api/auth/me e POST /api/auth/logout', () => {
  it('401 sem sessão', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('devolve o usuário logado e depois desloga', async () => {
    const email = newEmail();
    const { agent, csrf } = await csrfAgent();
    await agent.post('/api/auth/register').set('x-csrf-token', csrf)
      .send({ name: 'Rangel', email, password });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    const out = await agent.post('/api/auth/logout').set('x-csrf-token', csrf).send({});
    expect(out.status).toBe(200);

    const after = await agent.get('/api/auth/me');
    expect(after.status).toBe(401);
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});
