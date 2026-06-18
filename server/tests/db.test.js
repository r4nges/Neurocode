import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';

const email = `test-${randomUUID()}@neurocode.dev`;

describe('Modelo User', () => {
  it('cria e lê um usuário com os defaults corretos', async () => {
    const created = await prisma.user.create({
      data: { name: 'Teste', email, passwordHash: 'x' },
    });
    expect(typeof created.id).toBe('number');
    expect(created.plan).toBe('free');
    expect(created.level).toBe(1);
    expect(created.xp).toBe(0);

    const found = await prisma.user.findUnique({ where: { email } });
    expect(found?.name).toBe('Teste');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
});
