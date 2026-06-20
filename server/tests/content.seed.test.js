import { describe, it, expect } from 'vitest';
import prisma from '../src/db/client.js';
import { seedContent, CONTENT } from '../src/content/seed.js';

describe('seedContent', () => {
  it('o global-setup já semeou a fatia Front-end no test.db', async () => {
    const fe = await prisma.roadmap.findUnique({
      where: { slug: 'desenvolvedor-front-end' },
      include: { courses: { include: { lessons: true } } },
    });
    expect(fe).not.toBeNull();
    expect(fe.isLocked).toBe(false);
    const slugs = fe.courses.map((c) => c.slug).sort();
    expect(slugs).toEqual(['css', 'html', 'javascript']);
    for (const c of fe.courses) expect(c.lessons.length).toBeGreaterThanOrEqual(3);
  });

  it('semeia os roadmaps bloqueados', async () => {
    const locked = await prisma.roadmap.findMany({ where: { isLocked: true } });
    const slugs = locked.map((r) => r.slug).sort();
    expect(slugs).toEqual(['back-end', 'data', 'devops']);
  });

  it('cada aula tem content (array de blocos) e conceptTags parseáveis', async () => {
    const lesson = await prisma.lesson.findFirst({ where: { course: { slug: 'html' } }, orderBy: { order: 'asc' } });
    const blocks = JSON.parse(lesson.content);
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);
    expect(typeof blocks[0].type).toBe('string');
    expect(Array.isArray(JSON.parse(lesson.conceptTags))).toBe(true);
  });

  it('é idempotente: rodar de novo não duplica matérias', async () => {
    await seedContent(prisma);
    await seedContent(prisma);
    const courses = await prisma.course.count({ where: { slug: 'html' } });
    expect(courses).toBe(1);
    const roadmaps = await prisma.roadmap.count({
      where: { slug: { in: CONTENT.map((r) => r.slug) } },
    });
    expect(roadmaps).toBe(CONTENT.length);
  });
});
