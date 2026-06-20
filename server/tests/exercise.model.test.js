import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';

const email = `ex-${randomUUID()}@neurocode.dev`;
let userId;
let lessonId;

beforeAll(async () => {
  const user = await prisma.user.create({ data: { name: 'Ex', email, passwordHash: 'x' } });
  userId = user.id;
  // Reaproveita uma aula já semeada (HTML, aula 1) como dona dos exercícios.
  const lesson = await prisma.lesson.findFirst({ where: { course: { slug: 'html' } }, orderBy: { order: 'asc' } });
  lessonId = lesson.id;
});

describe('Modelos Exercise/Attempt', () => {
  it('User nasce com onboardedAt null', async () => {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u.onboardedAt).toBeNull();
  });

  it('cria Exercise na aula e Attempt do usuário, com defaults', async () => {
    const ex = await prisma.exercise.create({
      data: {
        lessonId,
        type: 'multiple-choice',
        prompt: 'Qual tag cria um link?',
        options: JSON.stringify(['<p>', '<a>', '<img>']),
        answer: JSON.stringify(1),
        difficulty: 1,
        conceptTag: 'tags',
      },
    });
    expect(ex.source).toBe('bank');

    const attempt = await prisma.attempt.create({
      data: { userId, exerciseId: ex.id, correct: true, sessionToken: 'tok-1' },
    });
    expect(attempt.answeredAt).toBeInstanceOf(Date);

    const withAttempts = await prisma.exercise.findUnique({
      where: { id: ex.id },
      include: { attempts: true },
    });
    expect(withAttempts.attempts).toHaveLength(1);
  });

  afterAll(async () => {
    await prisma.attempt.deleteMany({ where: { userId } });
    await prisma.exercise.deleteMany({ where: { lessonId, conceptTag: 'tags', prompt: 'Qual tag cria um link?' } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
});
