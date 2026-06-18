import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';
import {
  createSession,
  getUserBySessionId,
  destroySession,
} from '../src/auth/session.js';

const email = `sess-${randomUUID()}@neurocode.dev`;
let userId;

async function user() {
  if (!userId) {
    const u = await prisma.user.create({
      data: { name: 'Sessão', email, passwordHash: 'x' },
    });
    userId = u.id;
  }
  return userId;
}

describe('serviço de sessão', () => {
  it('cria uma sessão e resolve o usuário pelo token', async () => {
    const token = await createSession(await user());
    expect(typeof token).toBe('string');
    const resolved = await getUserBySessionId(token);
    expect(resolved?.id).toBe(userId);
  });

  it('retorna null para token ausente ou inexistente', async () => {
    expect(await getUserBySessionId(undefined)).toBeNull();
    expect(await getUserBySessionId('nao-existe')).toBeNull();
  });

  it('não resolve sessão expirada e a remove', async () => {
    const token = await createSession(await user());
    await prisma.session.update({
      where: { id: token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await getUserBySessionId(token)).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull();
  });

  it('destrói a sessão', async () => {
    const token = await createSession(await user());
    await destroySession(token);
    expect(await getUserBySessionId(token)).toBeNull();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
});
