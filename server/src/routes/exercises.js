import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { gradeAttempt } from '../ai/session.js';

const router = Router();

router.post('/exercises/:id/attempt', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido.' });
    const { sessionToken, answer } = req.body ?? {};
    const result = await gradeAttempt(req.user.id, id, sessionToken, answer);
    if (result.error === 'invalid-session') return res.status(403).json({ error: 'Sessão inválida.' });
    if (result.error === 'locked') return res.status(409).json({ error: 'Aula bloqueada. Conclua a anterior primeiro.' });
    if (result.error === 'not-found') return res.status(404).json({ error: 'Exercício não encontrado.' });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
