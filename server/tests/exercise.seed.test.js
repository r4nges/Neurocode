import { describe, it, expect } from 'vitest';
import prisma from '../src/db/client.js';
import { seedExercises, EXERCISES } from '../src/content/exercises.js';

const VALID_TYPES = new Set(['multiple-choice', 'fill-blank', 'predict-output', 'order-lines']);

// Todos os conceitos das aulas Front-end (devem ter cobertura no banco).
async function lessonConcepts() {
  const lessons = await prisma.lesson.findMany({
    where: { course: { roadmap: { slug: 'desenvolvedor-front-end' } } },
    select: { conceptTags: true },
  });
  const set = new Set();
  for (const l of lessons) for (const c of JSON.parse(l.conceptTags)) set.add(c);
  return [...set];
}

describe('banco de exercícios — cobertura', () => {
  it('o global-setup já semeou exercícios para o test.db', async () => {
    const total = await prisma.exercise.count();
    expect(total).toBeGreaterThanOrEqual(40);
  });

  it('cada conceito de cada aula tem >=2 exercícios, >=2 dificuldades e >=2 tipos', async () => {
    const concepts = await lessonConcepts();
    for (const concept of concepts) {
      const rows = await prisma.exercise.findMany({ where: { conceptTag: concept } });
      expect(rows.length, `conceito ${concept}`).toBeGreaterThanOrEqual(2);
      const difficulties = new Set(rows.map((r) => r.difficulty));
      const types = new Set(rows.map((r) => r.type));
      expect(difficulties.size, `dificuldades de ${concept}`).toBeGreaterThanOrEqual(2);
      expect(types.size, `tipos de ${concept}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('todo exercício tem options/answer JSON parseáveis e tipo válido', async () => {
    const rows = await prisma.exercise.findMany({ take: 200 });
    for (const r of rows) {
      expect(VALID_TYPES.has(r.type)).toBe(true);
      expect(() => JSON.parse(r.options)).not.toThrow();
      expect(() => JSON.parse(r.answer)).not.toThrow();
      expect(r.difficulty).toBeGreaterThanOrEqual(1);
      expect(r.difficulty).toBeLessThanOrEqual(3);
    }
  });

  it('EXERCISES cobre os mesmos conceitos das aulas', async () => {
    const concepts = new Set(await lessonConcepts());
    const covered = new Set(EXERCISES.map((e) => e.conceptTag));
    for (const c of concepts) expect(covered.has(c), `falta cobrir ${c}`).toBe(true);
  });

  it('é idempotente: re-semear não duplica nem multiplica', async () => {
    const before = await prisma.exercise.count({ where: { source: 'bank' } });
    await seedExercises(prisma);
    await seedExercises(prisma);
    const after = await prisma.exercise.count({ where: { source: 'bank' } });
    expect(after).toBe(before);
  });
});
