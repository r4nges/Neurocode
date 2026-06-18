import { randomBytes } from 'node:crypto';

export const CSRF_COOKIE = 'nc_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function issueCsrfToken(req, res, next) {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    req.cookies = req.cookies || {};
    req.cookies[CSRF_COOKIE] = token;
  }
  next();
}

export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Falha na validação CSRF.' });
  }
  next();
}
