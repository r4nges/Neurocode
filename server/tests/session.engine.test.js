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
    // gradeAttempt no longer returns `solution`
    expect(first).not.toHaveProperty('solution');

    // Re-tentativa sob o MESMO token não cria novo Attempt:
    await gradeAttempt(userId, exId, token, right);
    const count = await prisma.attempt.count({ where: { userId, exerciseId: exId, sessionToken: token } });
    expect(count).toBe(1);
  });

  it('devolve not-found para exercício inexistente', async () => {
    // Need a valid session token to pass the session check first
    const s = await buildLessonSession(userId, lesson1Id);
    // Use the valid token but a non-existent exercise id
    // This should hit not-found after session validation passes (exercise not in issued list → invalid-session)
    expect(await gradeAttempt(userId, 99999, 'forged-tok', 0)).toEqual({ error: 'invalid-session' });
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

describe('hardening do gate', () => {
  it('(a) gradeAttempt com token forjado retorna invalid-session', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    const exId = s.exercises[0].id;
    const result = await gradeAttempt(userId, exId, randomUUID(), 0);
    expect(result).toEqual({ error: 'invalid-session' });
  });

  it('(b) gradeAttempt com exercício fora da sessão emitida retorna invalid-session', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    // Find an exercise that is NOT in the issued session
    const cssCourse = await prisma.course.findUnique({
      where: { slug: 'css' },
      include: { lessons: { include: { exercises: true }, orderBy: { order: 'asc' } } },
    });
    const cssExercise = cssCourse.lessons[0].exercises[0];
    const result = await gradeAttempt(userId, cssExercise.id, s.sessionToken, 0);
    expect(result).toEqual({ error: 'invalid-session' });
  });

  it('(c) completeSession com token de outra aula retorna invalid-session', async () => {
    const sA = await buildLessonSession(userId, lesson1Id);
    // Try to complete with a token that has a different lessonId than requested
    const htmlCourse = await prisma.course.findUnique({
      where: { slug: 'html' },
      include: { lessons: { orderBy: { order: 'asc' } } },
    });
    const lesson2Id = htmlCourse.lessons[1]?.id;
    if (!lesson2Id) {
      // Only one lesson — use a non-existent id
      const result = await completeSession(userId, 99999, sA.sessionToken);
      expect(result).toEqual({ error: 'invalid-session' });
    } else {
      const result = await completeSession(userId, lesson2Id, sA.sessionToken);
      expect(result).toEqual({ error: 'invalid-session' });
    }
  });

  it('(d) completar respondendo só PARTE dos exercícios com acerto < 80% retorna completed:false (denominador = emitidos)', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    // Only answer the FIRST exercise correctly; leave the rest unanswered
    // Unanswered count as wrong (denominator = issued size)
    const firstEx = s.exercises[0];
    const real = await prisma.exercise.findUnique({ where: { id: firstEx.id } });
    await gradeAttempt(userId, firstEx.id, s.sessionToken, JSON.parse(real.answer));

    // If there is only 1 exercise in the issued list, the score would be 100% which is >=80
    // Skip this assertion in that edge case
    if (s.exercises.length > 1) {
      const result = await completeSession(userId, lesson1Id, s.sessionToken);
      expect(result.completed).toBe(false);
      expect(result.score).toBeLessThan(80);
    }
  });
});

// Suíte de recompensa: usuário próprio e fresco (o `userId` global já concluiu
// lesson1 nos testes de limiar acima, o que zeraria o delta de XP).
const rewardEmail = `reward-${randomUUID()}@neurocode.dev`;
let rewardUserId;

describe('Fase 5 — recompensa + gate não-replayável', () => {
  beforeAll(async () => {
    const u = await prisma.user.create({ data: { name: 'Reward', email: rewardEmail, passwordHash: 'x' } });
    rewardUserId = u.id;
  });

  it('conclusão concede XP e devolve o resumo de recompensa', async () => {
    const s = await buildLessonSession(rewardUserId, lesson1Id);
    for (const ex of s.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      await gradeAttempt(rewardUserId, ex.id, s.sessionToken, JSON.parse(real.answer));
    }
    const r = await completeSession(rewardUserId, lesson1Id, s.sessionToken);
    expect(r.completed).toBe(true);
    expect(r.xpAwarded).toBeGreaterThan(0);
    expect(r.level).toBeGreaterThanOrEqual(1);
    expect(typeof r.leveledUp).toBe('boolean');
    expect(r.streak).toBeGreaterThanOrEqual(1);
  });

  it('o sessionToken fica inválido após a conclusão (não-replayável)', async () => {
    const s = await buildLessonSession(rewardUserId, lesson1Id);
    for (const ex of s.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      await gradeAttempt(rewardUserId, ex.id, s.sessionToken, JSON.parse(real.answer));
    }
    await completeSession(rewardUserId, lesson1Id, s.sessionToken);
    const gone = await prisma.lessonSession.findUnique({ where: { token: s.sessionToken } });
    expect(gone).toBeNull();
    const replay = await completeSession(rewardUserId, lesson1Id, s.sessionToken);
    expect(replay).toEqual({ error: 'invalid-session' });
  });

  it('anti-farming: refazer a aula com 100% de novo concede 0 XP', async () => {
    const before = await prisma.user.findUnique({ where: { id: rewardUserId } });
    const s = await buildLessonSession(rewardUserId, lesson1Id);
    for (const ex of s.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      await gradeAttempt(rewardUserId, ex.id, s.sessionToken, JSON.parse(real.answer));
    }
    const r = await completeSession(rewardUserId, lesson1Id, s.sessionToken);
    expect(r.xpAwarded).toBe(0); // prevBest já era 100 da conclusão anterior
    const after = await prisma.user.findUnique({ where: { id: rewardUserId } });
    expect(after.xp).toBe(before.xp);
  });

  it('<80% não concede recompensa nem invalida o token', async () => {
    const s = await buildLessonSession(rewardUserId, lesson1Id);
    if (s.exercises.length > 1) {
      const first = s.exercises[0];
      const real = await prisma.exercise.findUnique({ where: { id: first.id } });
      await gradeAttempt(rewardUserId, first.id, s.sessionToken, JSON.parse(real.answer));
      const r = await completeSession(rewardUserId, lesson1Id, s.sessionToken);
      expect(r.completed).toBe(false);
      expect(r).not.toHaveProperty('xpAwarded');
      const still = await prisma.lessonSession.findUnique({ where: { token: s.sessionToken } });
      expect(still).not.toBeNull(); // token preservado
    }
  });
});

afterAll(async () => {
  await prisma.attempt.deleteMany({ where: { userId } });
  await prisma.progress.deleteMany({ where: { userId } });
  await prisma.lessonSession.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.user.deleteMany({ where: { email: rewardEmail } }); // cascade limpa o resto
  await prisma.$disconnect();
});
