import { Router } from 'express';
import prisma from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { grade } from '../ai/grade.js';

const router = Router();

// 3 perguntas de dificuldade 1, uma por matéria do roadmap Front-end.
async function onboardingExercises() {
  const slugs = ['html', 'css', 'javascript'];
  const out = [];
  for (const slug of slugs) {
    const ex = await prisma.exercise.findFirst({
      where: { difficulty: 1, lesson: { course: { slug } } },
      orderBy: { id: 'asc' },
    });
    if (ex) out.push(ex);
  }
  return out;
}

router.get('/onboarding', requireAuth, async (req, res, next) => {
  try {
    const exercises = await onboardingExercises();
    const questions = exercises.map((e) => ({
      id: e.id,
      type: e.type,
      prompt: e.prompt,
      options: JSON.parse(e.options),
      conceptTag: e.conceptTag,
    }));
    res.json({ questions });
  } catch (e) {
    next(e);
  }
});

router.post('/onboarding', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const { answers } = req.body ?? {};
    if (Array.isArray(answers)) {
      for (const a of answers) {
        const id = Number(a?.exerciseId);
        if (!Number.isInteger(id)) continue;
        const exercise = await prisma.exercise.findUnique({ where: { id } });
        if (!exercise) continue;
        const correct = grade(exercise, a.answer);
        const existing = await prisma.attempt.findFirst({
          where: { userId: req.user.id, exerciseId: id, sessionToken: 'onboarding' },
        });
        if (!existing) {
          await prisma.attempt.create({ data: { userId: req.user.id, exerciseId: id, correct, sessionToken: 'onboarding' } });
        }
      }
    }
    await prisma.user.update({ where: { id: req.user.id }, data: { onboardedAt: new Date() } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
