import prisma from '../db/client.js';

export const SESSION_COOKIE = 'nc_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  signed: true,
  path: '/',
  maxAge: SESSION_TTL_MS,
};

export async function createSession(userId) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await prisma.session.create({ data: { userId, expiresAt } });
  return session.id;
}

export async function getUserBySessionId(sessionId) {
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function destroySession(sessionId) {
  if (!sessionId) return;
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}
