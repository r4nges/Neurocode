import { getUserBySessionId, SESSION_COOKIE } from '../auth/session.js';

export async function requireAuth(req, res, next) {
  try {
    const sessionId = req.signedCookies?.[SESSION_COOKIE];
    const user = await getUserBySessionId(sessionId);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
