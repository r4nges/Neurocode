import { xpDelta, levelForXp } from './xp.js';
import { nextStreak } from './streak.js';

// Aplica toda a recompensa de uma conclusão qualificada (>=80%), DENTRO da transação
// do caller. Pré-condição: o Progress desta aula já está `completed` (o caller fez o upsert).
// Idempotente quanto a badge/pontos e anti-farming quanto a XP (delta de melhora).
export async function awardOnCompletion(tx, { userId, lessonId, courseSlug, prevBest, novoScore, now }) {
  const user = await tx.user.findUnique({ where: { id: userId } });

  // XP por delta de melhora.
  const delta = xpDelta(prevBest, novoScore);
  const newXp = user.xp + delta;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > user.level;
  if (delta > 0) {
    await tx.xpEvent.create({ data: { userId, amount: delta, reason: `lesson:${lessonId}` } });
  }

  // Streak por dia-calendário.
  const s = nextStreak(user.streak, user.lastActiveDate, now);

  // Matéria concluída? (conta as aulas da matéria vs. Progress completed do usuário)
  const course = await tx.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true, pointsReward: true, badgeName: true, badgeIcon: true, lessons: { select: { id: true } } },
  });
  const lessonIds = course.lessons.map((l) => l.id);
  const doneCount = await tx.progress.count({
    where: { userId, lessonId: { in: lessonIds }, status: 'completed' },
  });
  const courseCompleted = lessonIds.length > 0 && doneCount === lessonIds.length;

  // Badge + pontos só quando a matéria fecha E ainda não há badge para o par.
  let badge = null;
  let pointsAwarded = 0;
  let newNeuroPoints = user.neuroPoints;
  if (courseCompleted) {
    const existing = await tx.badge.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
    });
    if (!existing) {
      try {
        await tx.badge.create({ data: { userId, courseId: course.id } });
        badge = { badgeName: course.badgeName, badgeIcon: course.badgeIcon };
        pointsAwarded = course.pointsReward;
        newNeuroPoints += course.pointsReward;
      } catch (e) {
        if (e?.code !== 'P2002') throw e; // corrida: outro já criou -> trata como "já tinha"
      }
    }
  }

  await tx.user.update({
    where: { id: userId },
    data: {
      xp: newXp, level: newLevel,
      streak: s.streak, lastActiveDate: s.lastActiveDate,
      neuroPoints: newNeuroPoints,
    },
  });

  return { xpAwarded: delta, level: newLevel, leveledUp, streak: s.streak, courseCompleted, badge, pointsAwarded };
}
