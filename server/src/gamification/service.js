import prisma from '../db/client.js';

export const META_SEMANAL_PADRAO = 500;
export const RANKING_TOP_N = 10;
export const JANELA_SEMANAL_DIAS = 7;

function janelaInicio(now = Date.now()) {
  return new Date(now - JANELA_SEMANAL_DIAS * 86400000);
}

export async function getDashboard(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true, neuroPoints: true, streak: true },
  });
  const desde = janelaInicio();

  // XP da semana do próprio usuário.
  const minhaSemana = await prisma.xpEvent.aggregate({
    where: { userId, createdAt: { gte: desde } }, _sum: { amount: true },
  });
  const earned = minhaSemana._sum.amount ?? 0;

  // Pódio: top 3 por XP somado na janela.
  const grupos = await prisma.xpEvent.groupBy({
    by: ['userId'], where: { createdAt: { gte: desde } },
    _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } }, take: 3,
  });
  const nomes = await prisma.user.findMany({
    where: { id: { in: grupos.map((g) => g.userId) } }, select: { id: true, name: true },
  });
  const nomePorId = new Map(nomes.map((u) => [u.id, u.name]));
  const podium = grupos.map((g) => ({ name: nomePorId.get(g.userId), weeklyXp: g._sum.amount ?? 0 }));

  // Badges conquistados.
  const badgeRows = await prisma.badge.findMany({
    where: { userId }, orderBy: { earnedAt: 'asc' },
    include: { course: { select: { slug: true, badgeName: true, badgeIcon: true } } },
  });
  const badges = badgeRows.map((b) => ({
    courseSlug: b.course.slug, badgeName: b.course.badgeName,
    badgeIcon: b.course.badgeIcon, earnedAt: b.earnedAt,
  }));

  return {
    xp: user.xp, level: user.level, neuroPoints: user.neuroPoints, streak: user.streak,
    weekly: { earned, goal: META_SEMANAL_PADRAO, podium },
    badges,
  };
}

export async function getRanking(userId) {
  const topRows = await prisma.user.findMany({
    orderBy: { xp: 'desc' }, take: RANKING_TOP_N,
    select: { name: true, xp: true, level: true },
  });
  const me = await prisma.user.findUnique({
    where: { id: userId }, select: { xp: true, level: true },
  });
  const acima = await prisma.user.count({ where: { xp: { gt: me.xp } } });
  return { top: topRows, me: { rank: acima + 1, xp: me.xp, level: me.level } };
}
