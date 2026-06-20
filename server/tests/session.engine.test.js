import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';
import { buildLessonSession, gradeAttempt, completeSession } from '../src/ai/session.js';

const email = `eng-${randomUUID()}@neurocode.dev`;
let userId;
let lesson1Id;

async function htmlLesson1() {
  const course = await prisma.course.findUnique({
    where: { slug: 'html' },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });
  return course.lessons[0].id;
}

beforeAll(async () => {
  const u = await prisma.user.create({ data: { name: 'Eng', email, passwordHash: 'x' } });
  userId = u.id;
  lesson1Id = await htmlLesson1();
});

describe('buildLessonSession', () => {
  it('monta a sessão sem expor answer', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    expect(s.ok).toBe(true);
    expect(typeof s.sessionToken).toBe('string');
    expect(s.exercises.length).toBeGreaterThanOrEqual(1);
    for (const ex of s.exercises) {
      expect(ex).not.toHaveProperty('answer');
      expect(ex).toHaveProperty('id');
      expect(Array.isArray(ex.options)).toBe(true);
    }
  });

  it('recusa aula bloqueada', async () => {
    const cssCourse = await prisma.course.findUnique({
      where: { slug: 'css' }, include: { lessons: { orderBy: { order: 'asc' } } },
    });
    const res = await buildLessonSession(userId, cssCourse.lessons[0].id);
    expect(res).toEqual({ error: 'locked' });
  });
});

describe('gradeAttempt — 1ª tentativa por token', () => {
  it('grava só a primeira tentativa do exercício sob o token', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    const token = s.sessionToken;
    const exId = s.exercises[0].id;
    const real = await prisma.exercise.findUnique({ where: { id: exId } });
    const right = JSON.parse(real.answer);

    const first = await gradeAttempt(userId, exId, token, right);
    expect(first.correct).toBe(true);
    expect(first.solution).toEqual(right);

    // Re-tentativa sob o MESMO token não cria novo Attempt:
    await gradeAttempt(userId, exId, token, right);
    const count = await prisma.attempt.count({ where: { userId, exerciseId: exId, sessionToken: token } });
    expect(count).toBe(1);
  });

  it('devolve not-found para exercício inexistente', async () => {
    expect(await gradeAttempt(userId, 99999, 'tok', 0)).toEqual({ error: 'not-found' });
  });
});

describe('completeSession — limiar de 80%', () => {
  it('<80% não conclui; >=80% conclui e libera a próxima', async () => {
    // Sessão A: responde tudo ERRADO -> não conclui.
    const sA = await buildLessonSession(userId, lesson1Id);
    for (const ex of sA.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      const wrong = wrongAnswerFor(real);
      await gradeAttempt(userId, ex.id, sA.sessionToken, wrong);
    }
    const failed = await completeSession(userId, lesson1Id, sA.sessionToken);
    expect(failed.completed).toBe(false);
    expect(failed.score).toBeLessThan(80);
    const noProgress = await prisma.progress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson1Id } },
    });
    expect(noProgress).toBeNull();

    // Sessão B: responde tudo CERTO -> conclui (100%).
    const sB = await buildLessonSession(userId, lesson1Id);
    for (const ex of sB.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      await gradeAttempt(userId, ex.id, sB.sessionToken, JSON.parse(real.answer));
    }
    const passed = await completeSession(userId, lesson1Id, sB.sessionToken);
    expect(passed.completed).toBe(true);
    expect(passed.score).toBeGreaterThanOrEqual(80);
    expect(passed.nextLessonId).toBeTruthy();
    const progress = await prisma.progress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson1Id } },
    });
    expect(progress.status).toBe('completed');
  });
});

// Resposta sabidamente errada para qualquer tipo.
function wrongAnswerFor(real) {
  const ans = JSON.parse(real.answer);
  if (real.type === 'multiple-choice') return Number(ans) === 0 ? 1 : 0;
  if (real.type === 'order-lines') return [...ans].reverse().concat([999]);
  return `__definitivamente_errado__${ans}`;
}

afterAll(async () => {
  await prisma.attempt.deleteMany({ where: { userId } });
  await prisma.progress.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});
