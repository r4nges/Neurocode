import { Router } from 'express';
import prisma from '../db/client.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { registerSchema, loginSchema } from '../lib/validation.js';
import {
  createSession,
  destroySession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../auth/session.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = Router();

function toPublicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    plan: u.plan,
    xp: u.xp,
    level: u.level,
    neuroPoints: u.neuroPoints,
    streak: u.streak,
  };
}

router.post('/register', verifyCsrf, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        issues: parsed.error.flatten().fieldErrors,
      });
    }
    const { name, email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Não foi possível concluir o cadastro.' });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });
    const sessionId = await createSession(user.id);
    res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions);
    res.status(201).json({ user: toPublicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post('/login', loginLimiter, verifyCsrf, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = user ? await verifyPassword(user.passwordHash, password) : false;
    if (!user || !ok) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const sessionId = await createSession(user.id);
    res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions);
    res.json({ user: toPublicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', verifyCsrf, requireAuth, async (req, res, next) => {
  try {
    await destroySession(req.signedCookies[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

export default router;
