import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';

const email = `content-${randomUUID()}@neurocode.dev`;
let userId;
const slug = `rm-${randomUUID()}`;

describe('Modelos de conteúdo', () => {
  it('cria Roadmap → Course → Lesson e lê pela relação', async () => {
    const roadmap = await prisma.roadmap.create({
      data: {
        slug,
        title: 'Front-end (teste)',
        description: 'trilha de teste',
        icon: 'Code2',
        isLocked: false,
        order: 1,
        courses: {
          create: {
            slug: `${slug}-html`,
            title: 'HTML',
            description: 'estrutura',
            order: 1,
            badgeName: 'Estruturador',
            badgeIcon: 'FileCode',
            pointsReward: 100,
            lessons: {
              create: {
                title: 'O que é HTML',
                order: 1,
                content: JSON.stringify([{ type: 'paragraph', text: 'oi' }]),
                conceptTags: JSON.stringify(['html-basico']),
              },
            },
          },
        },
      },
      include: { courses: { include: { lessons: true } } },
    });
    expect(roadmap.courses).toHaveLength(1);
    expect(roadmap.courses[0].lessons).toHaveLength(1);
    expect(JSON.parse(roadmap.courses[0].lessons[0].content)[0].text).toBe('oi');
  });

  it('Progress é único por (userId, lessonId) e tem default completed', async () => {
    const user = await prisma.user.create({
      data: { name: 'Progresso', email, passwordHash: 'x' },
    });
    userId = user.id;
    const lesson = await prisma.lesson.findFirst({ where: { course: { slug: `${slug}-html` } } });

    const p = await prisma.progress.create({ data: { userId, lessonId: lesson.id } });
    expect(p.status).toBe('completed');
    expect(p.completedAt).toBeInstanceOf(Date);

    await expect(
      prisma.progress.create({ data: { userId, lessonId: lesson.id } })
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  afterAll(async () => {
    await prisma.roadmap.deleteMany({ where: { slug } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
});
