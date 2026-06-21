import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';

const email = `gmodel-${randomUUID()}@neurocode.dev`;
let userId;
let courseId;

describe('modelos de gamificação', () => {
  it('cria Badge e XpEvent com relações e impõe @@unique([userId,courseId])', async () => {
    const u = await prisma.user.create({ data: { name: 'GModel', email, passwordHash: 'x' } });
    userId = u.id;
    const course = await prisma.course.findFirst({ where: { slug: 'html' } });
    courseId = course.id;

    const badge = await prisma.badge.create({ data: { userId, courseId } });
    expect(badge.id).toBeGreaterThan(0);
    expect(badge.earnedAt).toBeInstanceOf(Date);

    // idempotência: 2º badge para o mesmo par viola o unique
    await expect(prisma.badge.create({ data: { userId, courseId } })).rejects.toMatchObject({ code: 'P2002' });

    const ev = await prisma.xpEvent.create({ data: { userId, amount: 30, reason: 'lesson:1' } });
    expect(ev.amount).toBe(30);
    expect(ev.createdAt).toBeInstanceOf(Date);

    const withRels = await prisma.user.findUnique({
      where: { id: userId },
      include: { badges: true, xpEvents: true },
    });
    expect(withRels.badges).toHaveLength(1);
    expect(withRels.xpEvents).toHaveLength(1);

    // lookup pela chave composta (usado em award.js)
    const found = await prisma.badge.findUnique({ where: { userId_courseId: { userId, courseId } } });
    expect(found?.id).toBe(badge.id);
  });
});

afterAll(async () => {
  if (userId) {
    await prisma.badge.deleteMany({ where: { userId } });
    await prisma.xpEvent.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
});
