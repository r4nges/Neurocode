import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { listRoadmaps, getRoadmap, getCourse, getLesson } from '../content/service.js';
import { buildLessonSession, completeSession } from '../ai/session.js';

const router = Router();

router.get('/roadmaps', requireAuth, async (req, res, next) => {
  try {
    res.json({ roadmaps: await listRoadmaps() });
  } catch (e) {
    next(e);
  }
});

router.get('/roadmaps/:slug', requireAuth, async (req, res, next) => {
  try {
    const roadmap = await getRoadmap(req.params.slug, req.user.id);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap não encontrado.' });
    res.json({ roadmap });
  } catch (e) {
    next(e);
  }
});

router.get('/courses/:slug', requireAuth, async (req, res, next) => {
  try {
    const course = await getCourse(req.params.slug, req.user.id);
    if (!course) return res.status(404).json({ error: 'Matéria não encontrada.' });
    res.json({ course });
  } catch (e) {
    next(e);
  }
});

router.get('/lessons/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido.' });
    const lesson = await getLesson(id, req.user.id);
    if (!lesson) return res.status(404).json({ error: 'Aula não encontrada.' });
    res.json({ lesson });
  } catch (e) {
    next(e);
  }
});

router.get('/lessons/:id/session', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido.' });
    const result = await buildLessonSession(req.user.id, id);
    if (result.error === 'not-found') return res.status(404).json({ error: 'Aula não encontrada.' });
    if (result.error === 'locked') return res.status(409).json({ error: 'Aula bloqueada. Conclua a anterior primeiro.' });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/lessons/:id/complete', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido.' });
    const { sessionToken } = req.body ?? {};
    if (!sessionToken) return res.status(400).json({ error: 'sessionToken é obrigatório.' });
    const result = await completeSession(req.user.id, id, sessionToken);
    if (result.error === 'not-found') return res.status(404).json({ error: 'Aula não encontrada.' });
    if (result.error === 'locked') return res.status(409).json({ error: 'Aula bloqueada. Conclua a anterior primeiro.' });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
