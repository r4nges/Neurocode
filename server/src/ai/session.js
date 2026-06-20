import { randomUUID } from 'node:crypto';
import prisma from '../db/client.js';
import { grade } from './grade.js';
import { computeMastery } from './mastery.js';
import { buildSession } from './selector.js';
import { poolForConcepts, attemptsForUser } from './bank.js';
import { getLesson } from '../content/service.js';
import { maybeGenerate } from './claudeClient.js';

const PASS_THRESHOLD = 80;

// Monta a sessão adaptativa de uma aula (sem expor `answer`).
export async function buildLessonSession(userId, lessonId) {
  const view = await getLesson(lessonId, userId);
  if (!view) return { error: 'not-found' };
  if (view.status === 'locked') return { error: 'locked' };

  const concepts = view.conceptTags;
  let pool = await poolForConcepts(concepts);
  const mastery = computeMastery(await attemptsForUser(userId));
  // Gancho IA (off por padrão): tenta cobrir lacuna de conceito fraco. Sem chave: retorna o pool.
  pool = await maybeGenerate({ concepts, mastery, pool });

  const session = buildSession(mastery, concepts, pool);
  const sessionToken = randomUUID();
  const exercises = session.map((e) => ({
    id: e.id,
    type: e.type,
    prompt: e.prompt,
    options: JSON.parse(e.options),
    difficulty: e.difficulty,
    conceptTag: e.conceptTag,
  }));
  return { ok: true, sessionToken, lessonTitle: view.title, courseSlug: view.courseSlug, exercises };
}

// Corrige uma resposta. Grava Attempt só na 1ª vez do exercício sob o token.
export async function gradeAttempt(userId, exerciseId, sessionToken, submitted) {
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return { error: 'not-found' };
  const correct = grade(exercise, submitted);
  const existing = sessionToken
    ? await prisma.attempt.findFirst({ where: { userId, exerciseId, sessionToken } })
    : null;
  if (!existing) {
    await prisma.attempt.create({
      data: { userId, exerciseId, correct, sessionToken: sessionToken ?? null },
    });
  }
  return { correct, solution: JSON.parse(exercise.answer) };
}

// Conclui a aula por limiar (>=80% de acerto de 1ª tentativa sob o token).
export async function completeSession(userId, lessonId, sessionToken) {
  const view = await getLesson(lessonId, userId);
  if (!view) return { error: 'not-found' };
  if (view.status === 'locked') return { error: 'locked' };

  const attempts = await prisma.attempt.findMany({
    where: { userId, sessionToken, exercise: { lessonId } },
    select: { correct: true },
  });
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const score = total ? Math.round((correct / total) * 100) : 0;

  if (total === 0 || score < PASS_THRESHOLD) {
    return { ok: true, completed: false, score };
  }

  await prisma.progress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { status: 'completed', score, completedAt: new Date() },
    create: { userId, lessonId, status: 'completed', score },
  });

  // Próxima aula + se a matéria ficou completa (reaproveita o nextLessonId já derivado por getLesson).
  const siblings = await prisma.lesson.findMany({
    where: { course: { slug: view.courseSlug } },
    select: { id: true },
    orderBy: { order: 'asc' },
  });
  const done = await prisma.progress.findMany({
    where: { userId, lessonId: { in: siblings.map((l) => l.id) }, status: 'completed' },
    select: { lessonId: true },
  });
  const courseCompleted = siblings.length > 0 && done.length === siblings.length;
  return { ok: true, completed: true, score, nextLessonId: view.nextLessonId, courseCompleted };
}
