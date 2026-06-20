import prisma from '../db/client.js';

// Pool de candidatos: todos os exercícios dos conceitos da aula.
export async function poolForConcepts(concepts) {
  if (!concepts || concepts.length === 0) return [];
  return prisma.exercise.findMany({ where: { conceptTag: { in: concepts } } });
}

// Tentativas do usuário enriquecidas com o conceptTag do exercício (para a maestria).
export async function attemptsForUser(userId) {
  const rows = await prisma.attempt.findMany({
    where: { userId },
    select: { correct: true, answeredAt: true, exercise: { select: { conceptTag: true } } },
  });
  return rows.map((r) => ({ correct: r.correct, answeredAt: r.answeredAt, conceptTag: r.exercise.conceptTag }));
}
