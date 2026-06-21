import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';
import { awardOnCompletion } from '../src/gamification/award.js';

const email = `award-${randomUUID()}@neurocode.dev`;
let userId;
let course;          // matéria HTML (3 aulas)
let lessonIds;

beforeEach(async () => {
  await prisma.badge.deleteMany({ where: { user: { email } } });
  await prisma.xpEvent.deleteMany({ where: { user: { email } } });
  await prisma.progress.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });
  const u = await prisma.user.create({ data: { name: 'Award', email, passwordHash: 'x' } });
  userId = u.id;
  course = await prisma.course.findUnique({
    where: { slug: 'html' }, include: { lessons: { orderBy: { order: 'asc' } } },
  });
  lessonIds = course.lessons.map((l) => l.id);
});

// helper: marca uma aula como concluída (pré-condição de awardOnCompletion)
async function completeProgress(lessonId, score) {
  await prisma.progress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { status: 'completed', score },
    create: { userId, lessonId, status: 'completed', score },
  });
}

describe('awardOnCompletion — XP/nível/streak', () => {
  it('1ª conclusão concede XP = score e grava XpEvent', async () => {
    await completeProgress(lessonIds[0], 100);
    const now = new Date('2026-06-21T10:00:00Z');
    const r = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[0], courseSlug: 'html', prevBest: 0, novoScore: 100, now,
    });
    expect(r.xpAwarded).toBe(100);
    expect(r.streak).toBe(1);
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u.xp).toBe(100);
    expect(u.level).toBe(1);
    const events = await prisma.xpEvent.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBe(100);
    expect(events[0].reason).toBe(`lesson:${lessonIds[0]}`);
  });

  it('refazer com nota igual/menor concede 0 e não grava XpEvent', async () => {
    await completeProgress(lessonIds[0], 100);
    const now = new Date('2026-06-22T10:00:00Z');
    const r = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[0], courseSlug: 'html', prevBest: 100, novoScore: 100, now,
    });
    expect(r.xpAwarded).toBe(0);
    expect(await prisma.xpEvent.count({ where: { userId } })).toBe(0);
  });

  it('refazer com nota maior concede só o delta', async () => {
    await completeProgress(lessonIds[0], 100);
    const now = new Date('2026-06-22T10:00:00Z');
    const r = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[0], courseSlug: 'html', prevBest: 80, novoScore: 100, now,
    });
    expect(r.xpAwarded).toBe(20);
  });

  it('cruza o limiar de nível e sinaliza leveledUp', async () => {
    await prisma.user.update({ where: { id: userId }, data: { xp: 240, level: 1 } });
    await completeProgress(lessonIds[0], 100);
    const r = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[0], courseSlug: 'html', prevBest: 0, novoScore: 100,
      now: new Date('2026-06-21T10:00:00Z'),
    });
    expect(r.leveledUp).toBe(true);
    expect(r.level).toBe(2); // 240 + 100 = 340 -> nível 2
  });
});

describe('awardOnCompletion — badge + pontos por matéria', () => {
  it('matéria 100% concede badge + pontos exatamente 1x', async () => {
    for (const id of lessonIds) await completeProgress(id, 100);
    const now = new Date('2026-06-21T10:00:00Z');
    const r1 = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[lessonIds.length - 1], courseSlug: 'html',
      prevBest: 0, novoScore: 100, now,
    });
    expect(r1.courseCompleted).toBe(true);
    expect(r1.badge).toEqual({ badgeName: course.badgeName, badgeIcon: course.badgeIcon });
    expect(r1.pointsAwarded).toBe(course.pointsReward);
    const u1 = await prisma.user.findUnique({ where: { id: userId } });
    expect(u1.neuroPoints).toBe(course.pointsReward);

    // 2ª passada (refação da última aula): badge já existe -> sem duplicar
    const r2 = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[lessonIds.length - 1], courseSlug: 'html',
      prevBest: 100, novoScore: 100, now: new Date('2026-06-22T10:00:00Z'),
    });
    expect(r2.badge).toBeNull();
    expect(r2.pointsAwarded).toBe(0);
    expect(await prisma.badge.count({ where: { userId } })).toBe(1);
    const u2 = await prisma.user.findUnique({ where: { id: userId } });
    expect(u2.neuroPoints).toBe(course.pointsReward); // inalterado
  });

  it('matéria parcial não concede badge', async () => {
    await completeProgress(lessonIds[0], 100);
    const r = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[0], courseSlug: 'html', prevBest: 0, novoScore: 100,
      now: new Date('2026-06-21T10:00:00Z'),
    });
    expect(r.courseCompleted).toBe(false);
    expect(r.badge).toBeNull();
    expect(r.pointsAwarded).toBe(0);
  });
});

afterAll(async () => {
  await prisma.badge.deleteMany({ where: { user: { email } } });
  await prisma.xpEvent.deleteMany({ where: { user: { email } } });
  await prisma.progress.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});
