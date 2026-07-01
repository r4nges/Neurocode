import { randomUUID } from 'node:crypto';
import prisma from '../db/client.js';
import { grade } from './grade.js';
import { computeMastery } from './mastery.js';
import { buildSession } from './selector.js';
import { poolForConcepts, attemptsForUser } from './bank.js';
import { getLesson } from '../content/service.js';
import { maybeGenerate } from './claudeClient.js';
import { awardOnCompletion } from '../gamification/award.js';

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

  // Persiste a sessão emitida antes de construir a resposta.
  await prisma.lessonSession.create({
    data: { token: sessionToken, userId, lessonId, exerciseIds: JSON.stringify(session.map((e) => e.id)) },
  });

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

// Corrige uma resposta. Grava Attempt na 1ª vez do exercício sob o token e, se já existia
// como erro, promove para correct no reacerto (a UI re-enfileira até acertar; a pontuação de
// conclusão deve refletir o domínio alcançado). Nunca rebaixa um acerto já registrado.
// Valida que o token é uma sessão emitida pelo servidor, pertence ao usuário e contém o exercício.
export async function gradeAttempt(userId, exerciseId, sessionToken, submitted) {
  const ls = sessionToken ? await prisma.lessonSession.findUnique({ where: { token: sessionToken } }) : null;
  if (!ls || ls.userId !== userId) return { error: 'invalid-session' };
  const issued = JSON.parse(ls.exerciseIds);
  if (!issued.includes(exerciseId)) return { error: 'invalid-session' };
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return { error: 'not-found' };
  const view = await getLesson(ls.lessonId, userId);
  if (view && view.status === 'locked') return { error: 'locked' };
  const correct = grade(exercise, submitted);
  const existing = await prisma.attempt.findFirst({ where: { userId, exerciseId, sessionToken } });
  if (!existing) {
    await prisma.attempt.create({ data: { userId, exerciseId, correct, sessionToken } });
  } else if (!existing.correct && correct) {
    await prisma.attempt.update({ where: { id: existing.id }, data: { correct: true } });
  }
  return { correct, explanation: exercise.explanation ?? null, correctAnswer: JSON.parse(exercise.answer) };
}

// Conclui a aula por limiar (>=80% de acerto). Denominador = exercícios emitidos na sessão.
export async function completeSession(userId, lessonId, sessionToken) {
  const ls = sessionToken ? await prisma.lessonSession.findUnique({ where: { token: sessionToken } }) : null;
  if (!ls || ls.userId !== userId || ls.lessonId !== lessonId) return { error: 'invalid-session' };
  const view = await getLesson(lessonId, userId);
  if (!view) return { error: 'not-found' };
  if (view.status === 'locked') return { error: 'locked' };

  const issued = JSON.parse(ls.exerciseIds);
  const total = issued.length;
  const attempts = await prisma.attempt.findMany({
    where: { userId, sessionToken, exerciseId: { in: issued } },
    select: { exerciseId: true, correct: true },
  });
  const correctSet = new Set(attempts.filter((a) => a.correct).map((a) => a.exerciseId));
  const score = total ? Math.round((correctSet.size / total) * 100) : 0;

  if (total === 0 || score < PASS_THRESHOLD) {
    return { ok: true, completed: false, score };
  }

  // Caminho de sucesso: tudo numa transação (best-score + recompensa + invalidação do token).
  // prevBest é lido DENTRO da transação para que o delta de XP reflita o estado já commitado
  // de uma conclusão concorrente (ex.: a mesma aula aberta em dois tokens) e não conceda XP em dobro.
  const reward = await prisma.$transaction(async (tx) => {
    const prev = await tx.progress.findUnique({
      where: { userId_lessonId: { userId, lessonId } }, select: { score: true },
    });
    const prevBest = prev?.score ?? 0;
    await tx.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { status: 'completed', score: Math.max(prevBest, score), completedAt: new Date() },
      create: { userId, lessonId, status: 'completed', score },
    });
    const r = await awardOnCompletion(tx, {
      userId, lessonId, courseSlug: view.courseSlug, prevBest, novoScore: score, now: new Date(),
    });
    await tx.lessonSession.delete({ where: { token: sessionToken } }); // gate não-replayável
    return r;
  });

  return {
    ok: true, completed: true, score,
    nextLessonId: view.nextLessonId, courseCompleted: reward.courseCompleted,
    xpAwarded: reward.xpAwarded, level: reward.level, leveledUp: reward.leveledUp,
    streak: reward.streak,
    ...(reward.badge ? { badge: reward.badge } : {}),
    ...(reward.pointsAwarded ? { pointsAwarded: reward.pointsAwarded } : {}),
  };
}
