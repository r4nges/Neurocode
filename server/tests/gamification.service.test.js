import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';
import { getDashboard, getRanking, META_SEMANAL_PADRAO } from '../src/gamification/service.js';

const tag = randomUUID().slice(0, 8);
const emails = [`svc-a-${tag}@neurocode.dev`, `svc-b-${tag}@neurocode.dev`];
let a, b, course;

beforeAll(async () => {
  const ua = await prisma.user.create({ data: { name: `SvcA-${tag}`, email: emails[0], passwordHash: 'x', xp: 300, level: 2, neuroPoints: 100, streak: 3 } });
  const ub = await prisma.user.create({ data: { name: `SvcB-${tag}`, email: emails[1], passwordHash: 'x', xp: 120, level: 1 } });
  a = ua.id; b = ub.id;
  course = await prisma.course.findUnique({ where: { slug: 'html' } });

  const now = Date.now();
  const recent = new Date(now - 2 * 86400000);   // dentro da janela 7d
  const old = new Date(now - 10 * 86400000);     // fora da janela
  await prisma.xpEvent.createMany({ data: [
    { userId: a, amount: 200, reason: 'lesson:1', createdAt: recent },
    { userId: a, amount: 100, reason: 'lesson:2', createdAt: recent },
    { userId: a, amount: 999, reason: 'lesson:old', createdAt: old },   // não conta
    { userId: b, amount: 120, reason: 'lesson:3', createdAt: recent },
  ] });
  await prisma.badge.create({ data: { userId: a, courseId: course.id } });
});

describe('getDashboard', () => {
  it('soma a janela de 7 dias e monta o pódio', async () => {
    const d = await getDashboard(a);
    expect(d.xp).toBe(300);
    expect(d.streak).toBe(3);
    expect(d.weekly.earned).toBe(300);     // 200 + 100 (o 999 antigo fica fora)
    expect(d.weekly.goal).toBe(META_SEMANAL_PADRAO);
    expect(d.weekly.podium[0]).toEqual({ name: `SvcA-${tag}`, weeklyXp: 300 });
    expect(d.weekly.podium.find((p) => p.name === `SvcB-${tag}`)).toEqual({ name: `SvcB-${tag}`, weeklyXp: 120 });
    expect(d.badges).toEqual([
      expect.objectContaining({ courseSlug: 'html', badgeName: course.badgeName, badgeIcon: course.badgeIcon }),
    ]);
  });
});

describe('getRanking', () => {
  it('top por XP desc + minha posição', async () => {
    const r = await getRanking(b);
    const names = r.top.map((u) => u.name);
    expect(names.indexOf(`SvcA-${tag}`)).toBeLessThan(names.indexOf(`SvcB-${tag}`)); // A acima de B
    expect(r.me.xp).toBe(120);
    expect(r.me.rank).toBeGreaterThanOrEqual(1);
    // rank de B = (# usuários com xp > 120) + 1; A (300) está acima -> rank de B >= 2
    expect(r.me.rank).toBeGreaterThanOrEqual(2);
  });
});

afterAll(async () => {
  await prisma.badge.deleteMany({ where: { userId: { in: [a, b] } } });
  await prisma.xpEvent.deleteMany({ where: { userId: { in: [a, b] } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});
