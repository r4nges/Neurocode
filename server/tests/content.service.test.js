import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';
import {
  listRoadmaps,
  getRoadmap,
  getCourse,
  getLesson,
} from '../src/content/service.js';

const email = `svc-${randomUUID()}@neurocode.dev`;
let userId;

async function htmlLessons() {
  const course = await prisma.course.findUnique({
    where: { slug: 'html' },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });
  return course.lessons;
}

beforeAll(async () => {
  const u = await prisma.user.create({ data: { name: 'Serviço', email, passwordHash: 'x' } });
  userId = u.id;
});

describe('listRoadmaps', () => {
  it('lista os roadmaps ordenados, com Front-end primeiro e desbloqueado', async () => {
    const rms = await listRoadmaps();
    expect(rms[0].slug).toBe('desenvolvedor-front-end');
    expect(rms[0].isLocked).toBe(false);
    expect(rms.some((r) => r.slug === 'devops' && r.isLocked)).toBe(true);
  });
});

describe('getRoadmap — bloqueio sequencial de matérias', () => {
  it('só a 1ª matéria começa desbloqueada', async () => {
    const rm = await getRoadmap('desenvolvedor-front-end', userId);
    const bySlug = Object.fromEntries(rm.courses.map((c) => [c.slug, c]));
    expect(bySlug.html.locked).toBe(false);
    expect(bySlug.css.locked).toBe(true);
    expect(bySlug.javascript.locked).toBe(true);
    expect(bySlug.html.lessonsTotal).toBeGreaterThanOrEqual(3);
    expect(bySlug.html.lessonsCompleted).toBe(0);
  });

  it('devolve null para slug inexistente', async () => {
    expect(await getRoadmap('nao-existe', userId)).toBeNull();
  });
});

describe('getCourse — status por aula', () => {
  it('a 1ª aula é available, as demais locked', async () => {
    const c = await getCourse('html', userId);
    expect(c.locked).toBe(false);
    expect(c.lessons[0].status).toBe('available');
    expect(c.lessons[1].status).toBe('locked');
    expect(Array.isArray(c.lessons[0].conceptTags)).toBe(true);
  });
});

describe('getLesson', () => {
  it('devolve conteúdo parseado, courseSlug e nextLessonId', async () => {
    const lessons = await htmlLessons();
    const view = await getLesson(lessons[0].id, userId);
    expect(view.courseSlug).toBe('html');
    expect(Array.isArray(view.content)).toBe(true);
    expect(view.content[0]).toHaveProperty('type');
    expect(view.nextLessonId).toBe(lessons[1].id);
    expect(await getLesson(999999, userId)).toBeNull();
  });
});

afterAll(async () => {
  await prisma.progress.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});
