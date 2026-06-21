import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDashboard, getRanking } from '../gamification/service.js';

const router = Router();

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    res.json(await getDashboard(req.user.id));
  } catch (e) {
    next(e);
  }
});

router.get('/ranking', requireAuth, async (req, res, next) => {
  try {
    res.json(await getRanking(req.user.id));
  } catch (e) {
    next(e);
  }
});

export default router;
