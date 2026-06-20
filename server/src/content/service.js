import prisma from '../db/client.js';

// Ids das aulas (de uma lista) já concluídas por um usuário.
async function completedLessonIds(userId, lessonIds) {
  if (lessonIds.length === 0) return new Set();
  const rows = await prisma.progress.findMany({
    where: { userId, lessonId: { in: lessonIds }, status: 'completed' },
    select: { lessonId: true },
  });
  return new Set(rows.map((p) => p.lessonId));
}

// Uma matéria está bloqueada se o roadmap está bloqueado, ou se não é a 1ª
// e a matéria de `order` imediatamente anterior ainda não foi concluída.
async function isCourseLocked(course, userId) {
  if (course.roadmap.isLocked) return true;
  if (course.order <= 1) return false;
  const prev = await prisma.course.findFirst({
    where: { roadmapId: course.roadmapId, order: course.order - 1 },
    include: { lessons: { select: { id: true } } },
  });
  if (!prev || prev.lessons.length === 0) return false;
  const done = await completedLessonIds(userId, prev.lessons.map((l) => l.id));
  return done.size !== prev.lessons.length;
}

// Estado derivado de uma matéria (matéria precisa vir com `roadmap` e `lessons` ordenadas).
async function deriveCourseState(course, userId) {
  const lessonIds = course.lessons.map((l) => l.id);
  const done = await completedLessonIds(userId, lessonIds);
  const locked = await isCourseLocked(course, userId);
  let availableAssigned = false;
  const status = new Map();
  for (const l of course.lessons) {
    if (done.has(l.id)) {
      status.set(l.id, 'completed');
    } else if (!locked && !availableAssigned) {
      status.set(l.id, 'available');
      availableAssigned = true;
    } else {
      status.set(l.id, 'locked');
    }
  }
  const completed = lessonIds.length > 0 && done.size === lessonIds.length;
  return { locked, status, completed, completedCount: done.size, total: lessonIds.length };
}

export async function listRoadmaps() {
  const roadmaps = await prisma.roadmap.findMany({ orderBy: { order: 'asc' } });
  return roadmaps.map((r) => ({
    slug: r.slug,
    title: r.title,
    description: r.description,
    icon: r.icon,
    isLocked: r.isLocked,
    order: r.order,
  }));
}

export async function getRoadmap(slug, userId) {
  const roadmap = await prisma.roadmap.findUnique({
    where: { slug },
    include: {
      courses: {
        orderBy: { order: 'asc' },
        include: { roadmap: true, lessons: { orderBy: { order: 'asc' } } },
      },
    },
  });
  if (!roadmap) return null;
  const courses = [];
  for (const c of roadmap.courses) {
    const st = await deriveCourseState(c, userId);
    courses.push({
      slug: c.slug,
      title: c.title,
      description: c.description,
      order: c.order,
      badgeName: c.badgeName,
      badgeIcon: c.badgeIcon,
      pointsReward: c.pointsReward,
      locked: st.locked,
      completed: st.completed,
      lessonsTotal: st.total,
      lessonsCompleted: st.completedCount,
    });
  }
  return {
    slug: roadmap.slug,
    title: roadmap.title,
    description: roadmap.description,
    icon: roadmap.icon,
    isLocked: roadmap.isLocked,
    courses,
  };
}

export async function getCourse(slug, userId) {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: { roadmap: true, lessons: { orderBy: { order: 'asc' } } },
  });
  if (!course) return null;
  const st = await deriveCourseState(course, userId);
  return {
    slug: course.slug,
    title: course.title,
    description: course.description,
    order: course.order,
    badgeName: course.badgeName,
    badgeIcon: course.badgeIcon,
    pointsReward: course.pointsReward,
    roadmapSlug: course.roadmap.slug,
    locked: st.locked,
    completed: st.completed,
    lessons: course.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      order: l.order,
      status: st.status.get(l.id),
      conceptTags: JSON.parse(l.conceptTags),
    })),
  };
}

export async function getLesson(id, userId) {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { course: { include: { roadmap: true, lessons: { orderBy: { order: 'asc' } } } } },
  });
  if (!lesson) return null;
  const st = await deriveCourseState(lesson.course, userId);
  const siblings = lesson.course.lessons;
  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const nextLessonId = idx >= 0 && idx + 1 < siblings.length ? siblings[idx + 1].id : null;
  return {
    id: lesson.id,
    title: lesson.title,
    order: lesson.order,
    content: JSON.parse(lesson.content),
    conceptTags: JSON.parse(lesson.conceptTags),
    courseSlug: lesson.course.slug,
    courseTitle: lesson.course.title,
    status: st.status.get(lesson.id),
    nextLessonId,
  };
}

export async function completeLesson(userId, lessonId) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: { include: { roadmap: true, lessons: { orderBy: { order: 'asc' } } } } },
  });
  if (!lesson) return { error: 'not-found' };
  const st = await deriveCourseState(lesson.course, userId);
  if (st.status.get(lesson.id) === 'locked') return { error: 'locked' };

  await prisma.progress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { status: 'completed', completedAt: new Date() },
    create: { userId, lessonId, status: 'completed' },
  });

  const siblings = lesson.course.lessons;
  const idx = siblings.findIndex((l) => l.id === lessonId);
  const nextLessonId = idx + 1 < siblings.length ? siblings[idx + 1].id : null;
  const done = await completedLessonIds(userId, siblings.map((l) => l.id));
  const courseCompleted = siblings.length > 0 && done.size === siblings.length;
  return { ok: true, nextLessonId, courseCompleted };
}
