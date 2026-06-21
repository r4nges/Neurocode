# Fase 5 — Gamificação · Plano de Implementação (NeuroCode)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar a **recompensa**: concluir uma aula (≥80% de acerto de 1ª tentativa) passa a conceder **XP → nível** (por delta de melhora, anti-farming), alimentar o **streak** diário, e — ao fechar a matéria inteira — conceder **badge** persistido + **NeuroPoints**. Mais **ranking global por XP** e o painel **"Seu progresso"** (meta semanal + pódio + badges) no Dashboard, com **resumo de recompensa** na tela de conclusão de aula. Tudo **server-autoritativo** dentro de uma transação, com o `sessionToken` invalidado após a conclusão (gate não-replayável).

**Architecture:** O backend ganha 2 modelos Prisma (`Badge` por `(userId,courseId)` idempotente; `XpEvent` datado — fonte de verdade da janela semanal) + um módulo `gamification/` que espelha o `ai/` da Fase 4: **lógica pura testável** (`xp.js`, `streak.js`) separada da **orquestração transacional** (`award.js`) e da **leitura** (`service.js`). A concessão é feita dentro do `completeSession` (`ai/session.js`) numa única `prisma.$transaction` que: faz upsert do `Progress` com semântica de **melhor nota**, chama `awardOnCompletion`, e **apaga a `LessonSession`** (backlog #1). Duas rotas de leitura novas (`GET /api/dashboard`, `GET /api/ranking`) atrás de `requireAuth`. O frontend transforma o Dashboard placeholder num painel real, mostra o resumo de recompensa ao fim da sessão Duolingo, e ganha a página `/ranking`.

**Tech Stack:** Node 18+ (ESM), Express 4, Prisma 5 + SQLite, Vitest 2 + Supertest (server); React 18, Vite 5, react-router-dom 6, Vitest 2 + @testing-library/react + jsdom (web). **Sem novas dependências de runtime.**

## Global Constraints

- **Node.js 18+**. Gerenciador: **npm**. `server/` e `web/` são **ESM** (`"type": "module"`).
- API em **`http://localhost:4000`**, prefixo **`/api`**. Frontend: **Vite na 5173**, proxy de `/api` → `:4000`.
- Banco: **SQLite via Prisma 5**, `DATABASE_URL="file:./dev.db"`. **Os testes do server rodam contra `server/prisma/test.db`** (nunca `dev.db`), recriado via `prisma migrate deploy` + `seedContent` pelo `tests/global-setup.js`. Logo, **toda alteração de schema exige uma migração committada** em `server/prisma/migrations/`.
- Testes: **Vitest** (`npm test` = `vitest run`). Backend usa Supertest; frontend usa `@testing-library/react` + jsdom, assertivas **assíncronas** (`findBy*`), com future flags do Router e `vi.unstubAllGlobals()` no `afterEach`. `fileParallelism: false` no server (test.db compartilhado).
- **Toda rota nova exige sessão** (`requireAuth`); rotas que mudam estado já passam por `verifyCsrf` (herdado — a única escrita é a conclusão, que já o tem).
- **Recompensa server-autoritativa:** XP/pontos/streak/badge são calculados e gravados **só no servidor**, dentro de **uma** `prisma.$transaction`, incluindo a invalidação do token. O cliente nunca informa valores de recompensa.
- **Constantes (exatas):** `XP_POR_NIVEL = 250`, `META_SEMANAL_PADRAO = 500`, `RANKING_TOP_N = 10`, `JANELA_SEMANAL_DIAS = 7`.
- **Zero escopo de Fase 6:** sem resgate de pontos, sem certificado, sem `PointsLedger`, sem página `/perfil` completa, sem checkout/gating de plano.
- **Fonte das decisões:** `Neuro/03 Projetos/NeuroCode/02 Desenvolvimento/(C) Plano — Fase 5 Gamificação.md` (desenho travado 2026-06-21). Em divergência, o doc do Vault vence.

---

## Estrutura de arquivos

**Backend — criar:**
- `server/src/gamification/xp.js` — puro: `xpDelta`, `levelForXp`, `XP_POR_NIVEL`.
- `server/src/gamification/streak.js` — puro: `nextStreak`.
- `server/src/gamification/award.js` — transacional: `awardOnCompletion(tx, {...})`.
- `server/src/gamification/service.js` — leitura: `getDashboard`, `getRanking` + constantes de leitura.
- `server/src/routes/gamification.js` — `GET /dashboard`, `GET /ranking`.
- Migração `server/prisma/migrations/<ts>_add_gamification/migration.sql` (gerada pelo Prisma).
- Testes: `server/tests/gamification.model.test.js`, `xp.test.js`, `streak.test.js`, `award.test.js`, `gamification.service.test.js`, `gamification.routes.test.js`.

**Backend — modificar:**
- `server/prisma/schema.prisma` — 2 modelos novos + relações em `User`/`Course`; doc da semântica best-score em `Progress.score`.
- `server/src/ai/session.js` — `completeSession` passa a abrir a transação, upsert best-score, chamar `awardOnCompletion`, apagar o token, e devolver o resumo de recompensa.
- `server/src/app.js` — montar `gamificationRouter` em `/api`.
- `server/tests/session.engine.test.js` — novos casos (token não-replayável; anti-farming; <80% sem recompensa).

**Frontend — criar:**
- `web/src/pages/Ranking.jsx` — leaderboard global.
- `web/tests/Gamification.test.jsx` — painel do Dashboard + resumo de recompensa + ranking.

**Frontend — modificar:**
- `web/src/pages/Dashboard.jsx` — painel "Seu progresso" real (busca `/api/dashboard`).
- `web/src/components/ExerciseSession.jsx` — resumo de recompensa no resultado.
- `web/src/App.jsx` — rota `/ranking` protegida.
- `web/src/lib/api.js` — (sem mudança; já tem `apiGet`/`apiPost`).
- `web/src/styles/roadmap.css` ou `components.css` — estilos do painel/ranking/reward (sem novo import).

---

## Task 1: Modelos `Badge` + `XpEvent` + migração

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create (gerado): `server/prisma/migrations/<ts>_add_gamification/migration.sql`
- Test: `server/tests/gamification.model.test.js`

**Interfaces:**
- Consumes: nada (base de tudo).
- Produces: tabelas `Badge { id, userId, courseId, earnedAt }` com `@@unique([userId, courseId])`; `XpEvent { id, userId, amount, reason, createdAt }` com `@@index([userId, createdAt])`. Relações `User.badges`, `User.xpEvents`, `Course.badges`. Acessores Prisma: `prisma.badge`, `prisma.xpEvent`, chave composta `badge.findUnique({ where: { userId_courseId: { userId, courseId } } })`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/tests/gamification.model.test.js`:

```js
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';

const email = `gmodel-${randomUUID()}@neurocode.dev`;
let userId;
let courseId;

describe('modelos de gamificação', () => {
  it('cria Badge e XpEvent com relações e impõe @@unique([userId,courseId])', async () => {
    const u = await prisma.user.create({ data: { name: 'GModel', email, passwordHash: 'x' } });
    userId = u.id;
    const course = await prisma.course.findFirst({ where: { slug: 'html' } });
    courseId = course.id;

    const badge = await prisma.badge.create({ data: { userId, courseId } });
    expect(badge.id).toBeGreaterThan(0);
    expect(badge.earnedAt).toBeInstanceOf(Date);

    // idempotência: 2º badge para o mesmo par viola o unique
    await expect(prisma.badge.create({ data: { userId, courseId } })).rejects.toMatchObject({ code: 'P2002' });

    const ev = await prisma.xpEvent.create({ data: { userId, amount: 30, reason: 'lesson:1' } });
    expect(ev.amount).toBe(30);
    expect(ev.createdAt).toBeInstanceOf(Date);

    const withRels = await prisma.user.findUnique({
      where: { id: userId },
      include: { badges: true, xpEvents: true },
    });
    expect(withRels.badges).toHaveLength(1);
    expect(withRels.xpEvents).toHaveLength(1);

    // lookup pela chave composta (usado em award.js)
    const found = await prisma.badge.findUnique({ where: { userId_courseId: { userId, courseId } } });
    expect(found?.id).toBe(badge.id);
  });
});

afterAll(async () => {
  if (userId) {
    await prisma.badge.deleteMany({ where: { userId } });
    await prisma.xpEvent.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && npx vitest run tests/gamification.model.test.js`
Expected: FAIL — `prisma.badge` é `undefined` (modelo não existe ainda).

- [ ] **Step 3: Adicionar os modelos no schema**

Em `server/prisma/schema.prisma`, no `model User` adicionar duas relações ao final da lista de relações (depois de `lessonSessions LessonSession[]`):

```prisma
  badges         Badge[]
  xpEvents       XpEvent[]
```

No `model Course`, adicionar ao final (depois de `lessons Lesson[]`):

```prisma
  badges       Badge[]
```

No `model Progress`, documentar a semântica nova (apenas comentário — sem campo novo). Acima de `score Int?` colocar:

```prisma
  // score = MELHOR nota (máximo entre tentativas). A conclusão grava max(prevBest, novoScore).
  score       Int?
```

Ao final do arquivo, adicionar os 2 modelos:

```prisma
model Badge {
  id       Int      @id @default(autoincrement())
  userId   Int
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  courseId Int
  course   Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  earnedAt DateTime @default(now())

  @@unique([userId, courseId])
}

model XpEvent {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  amount    Int
  reason    String
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
}
```

- [ ] **Step 4: Gerar a migração e o client**

Run: `cd server && npx prisma migrate dev --name add_gamification`
Expected: cria `prisma/migrations/<ts>_add_gamification/migration.sql` com `CREATE TABLE "Badge"` (+ índice unique) e `CREATE TABLE "XpEvent"` (+ índice), aplica no `dev.db` e roda `prisma generate`. Sem prompts (nome fornecido, sem drift).

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `cd server && npx vitest run tests/gamification.model.test.js`
Expected: PASS (a global-setup recria o `test.db` via `migrate deploy`, pegando a migração nova).

- [ ] **Step 6: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations server/tests/gamification.model.test.js
git commit -m "feat(server): modelos Badge + XpEvent + migração de gamificação"
```

---

## Task 2: `xp.js` (lógica pura)

**Files:**
- Create: `server/src/gamification/xp.js`
- Test: `server/tests/xp.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `xpDelta(prevBest, novoScore) -> number` (≥0); `levelForXp(xpTotal) -> number` (≥1); `XP_POR_NIVEL = 250`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/tests/xp.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { xpDelta, levelForXp, XP_POR_NIVEL } from '../src/gamification/xp.js';

describe('xpDelta', () => {
  it('só recompensa melhora: max(0, novo - prevBest)', () => {
    expect(xpDelta(0, 100)).toBe(100);
    expect(xpDelta(80, 100)).toBe(20);
    expect(xpDelta(100, 100)).toBe(0);   // refazer igual = 0 (anti-farming)
    expect(xpDelta(100, 80)).toBe(0);    // refazer pior = 0
  });
  it('trata prevBest null/undefined como 0', () => {
    expect(xpDelta(null, 90)).toBe(90);
    expect(xpDelta(undefined, 90)).toBe(90);
  });
});

describe('levelForXp', () => {
  it('limiar fixo de 250 XP por nível, começa em 1', () => {
    expect(XP_POR_NIVEL).toBe(250);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(249)).toBe(1);
    expect(levelForXp(250)).toBe(2);
    expect(levelForXp(500)).toBe(3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && npx vitest run tests/xp.test.js`
Expected: FAIL — módulo `../src/gamification/xp.js` não existe.

- [ ] **Step 3: Implementação mínima**

Criar `server/src/gamification/xp.js`:

```js
export const XP_POR_NIVEL = 250;

// XP concedido = só o delta de melhora (anti-farming). prevBest null/undefined = 0.
export function xpDelta(prevBest, novoScore) {
  return Math.max(0, novoScore - (prevBest ?? 0));
}

// Nível derivado do XP total acumulado. Limiar fixo, começa em 1.
export function levelForXp(xpTotal) {
  return Math.floor(xpTotal / XP_POR_NIVEL) + 1;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd server && npx vitest run tests/xp.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/gamification/xp.js server/tests/xp.test.js
git commit -m "feat(server): xp.js puro — delta de melhora + nível"
```

---

## Task 3: `streak.js` (lógica pura)

**Files:**
- Create: `server/src/gamification/streak.js`
- Test: `server/tests/streak.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `nextStreak(prevStreak, lastActiveDate, now) -> { streak: number, lastActiveDate: Date }`. Comparação por **data-calendário UTC**. `lastActiveDate` pode ser `null` (1ª atividade) ou `Date`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/tests/streak.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { nextStreak } from '../src/gamification/streak.js';

const d = (iso) => new Date(iso);

describe('nextStreak (data-calendário UTC)', () => {
  it('1ª atividade: streak 1 e marca now', () => {
    const now = d('2026-06-21T10:00:00Z');
    expect(nextStreak(0, null, now)).toEqual({ streak: 1, lastActiveDate: now });
  });

  it('mesmo dia: inalterado, lastActiveDate fica', () => {
    const prev = d('2026-06-21T08:00:00Z');
    const now = d('2026-06-21T23:00:00Z');
    expect(nextStreak(4, prev, now)).toEqual({ streak: 4, lastActiveDate: prev });
  });

  it('dia consecutivo: +1 e marca now', () => {
    const prev = d('2026-06-21T23:00:00Z');
    const now = d('2026-06-22T01:00:00Z');
    expect(nextStreak(4, prev, now)).toEqual({ streak: 5, lastActiveDate: now });
  });

  it('gap > 1 dia: reseta para 1 e marca now', () => {
    const prev = d('2026-06-21T12:00:00Z');
    const now = d('2026-06-24T12:00:00Z');
    expect(nextStreak(9, prev, now)).toEqual({ streak: 1, lastActiveDate: now });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && npx vitest run tests/streak.test.js`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementação mínima**

Criar `server/src/gamification/streak.js`:

```js
// Meia-noite UTC do dia da data (para diferença em dias-calendário determinística).
function utcMidnight(date) {
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Avança o streak conforme a distância em dias-calendário UTC entre lastActiveDate e now.
// Retorna o novo streak e o lastActiveDate a persistir (no mesmo dia, mantém o anterior).
export function nextStreak(prevStreak, lastActiveDate, now) {
  if (!lastActiveDate) return { streak: 1, lastActiveDate: now };
  const diffDays = Math.round((utcMidnight(now) - utcMidnight(lastActiveDate)) / 86400000);
  if (diffDays <= 0) return { streak: prevStreak, lastActiveDate };       // mesmo dia (ou skew)
  if (diffDays === 1) return { streak: prevStreak + 1, lastActiveDate: now }; // consecutivo
  return { streak: 1, lastActiveDate: now };                              // gap -> reset
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd server && npx vitest run tests/streak.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/gamification/streak.js server/tests/streak.test.js
git commit -m "feat(server): streak.js puro — janela por dia-calendário UTC"
```

---

## Task 4: `award.js` (orquestração transacional)

**Files:**
- Create: `server/src/gamification/award.js`
- Test: `server/tests/award.test.js`

**Interfaces:**
- Consumes: `xpDelta`, `levelForXp` (Task 2); `nextStreak` (Task 3); modelos `Badge`/`XpEvent` (Task 1); `prisma` client (qualquer client/`tx` com `.user`, `.xpEvent`, `.badge`, `.course`, `.progress`).
- Produces: `awardOnCompletion(tx, { userId, lessonId, courseSlug, prevBest, novoScore, now }) -> { xpAwarded, level, leveledUp, streak, courseCompleted, badge, pointsAwarded }`. `badge` é `null` ou `{ badgeName, badgeIcon }`; `pointsAwarded` é `0` ou `course.pointsReward`. Idempotente: refazer com nota ≤ best concede `xpAwarded: 0` e nunca duplica badge/pontos.
  - **Pré-condição:** o `Progress` desta aula JÁ deve estar marcado `completed` quando `awardOnCompletion` é chamado (o caller faz o upsert antes). É assim que a detecção de matéria 100% enxerga a aula atual.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/tests/award.test.js`. Usa o `prisma` real como `tx` (single statements; o teste de transação completa vem na Task 5):

```js
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';
import { awardOnCompletion } from '../src/gamification/award.js';

const email = `award-${randomUUID()}@neurocode.dev`;
let userId;
let course;          // matéria HTML (3 aulas)
let lessonIds;

beforeEach(async () => {
  await prisma.badge.deleteMany({ where: { user: { email } } });
  await prisma.xpEvent.deleteMany({ where: { user: { email } } });
  await prisma.progress.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });
  const u = await prisma.user.create({ data: { name: 'Award', email, passwordHash: 'x' } });
  userId = u.id;
  course = await prisma.course.findUnique({
    where: { slug: 'html' }, include: { lessons: { orderBy: { order: 'asc' } } },
  });
  lessonIds = course.lessons.map((l) => l.id);
});

// helper: marca uma aula como concluída (pré-condição de awardOnCompletion)
async function completeProgress(lessonId, score) {
  await prisma.progress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { status: 'completed', score },
    create: { userId, lessonId, status: 'completed', score },
  });
}

describe('awardOnCompletion — XP/nível/streak', () => {
  it('1ª conclusão concede XP = score e grava XpEvent', async () => {
    await completeProgress(lessonIds[0], 100);
    const now = new Date('2026-06-21T10:00:00Z');
    const r = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[0], courseSlug: 'html', prevBest: 0, novoScore: 100, now,
    });
    expect(r.xpAwarded).toBe(100);
    expect(r.streak).toBe(1);
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u.xp).toBe(100);
    expect(u.level).toBe(1);
    const events = await prisma.xpEvent.findMany({ where: { userId } });
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBe(100);
    expect(events[0].reason).toBe(`lesson:${lessonIds[0]}`);
  });

  it('refazer com nota igual/menor concede 0 e não grava XpEvent', async () => {
    await completeProgress(lessonIds[0], 100);
    const now = new Date('2026-06-22T10:00:00Z');
    const r = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[0], courseSlug: 'html', prevBest: 100, novoScore: 100, now,
    });
    expect(r.xpAwarded).toBe(0);
    expect(await prisma.xpEvent.count({ where: { userId } })).toBe(0);
  });

  it('refazer com nota maior concede só o delta', async () => {
    await completeProgress(lessonIds[0], 100);
    const now = new Date('2026-06-22T10:00:00Z');
    const r = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[0], courseSlug: 'html', prevBest: 80, novoScore: 100, now,
    });
    expect(r.xpAwarded).toBe(20);
  });

  it('cruza o limiar de nível e sinaliza leveledUp', async () => {
    await prisma.user.update({ where: { id: userId }, data: { xp: 240, level: 1 } });
    await completeProgress(lessonIds[0], 100);
    const r = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[0], courseSlug: 'html', prevBest: 0, novoScore: 100,
      now: new Date('2026-06-21T10:00:00Z'),
    });
    expect(r.leveledUp).toBe(true);
    expect(r.level).toBe(2); // 240 + 100 = 340 -> nível 2
  });
});

describe('awardOnCompletion — badge + pontos por matéria', () => {
  it('matéria 100% concede badge + pontos exatamente 1x', async () => {
    for (const id of lessonIds) await completeProgress(id, 100);
    const now = new Date('2026-06-21T10:00:00Z');
    const r1 = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[lessonIds.length - 1], courseSlug: 'html',
      prevBest: 0, novoScore: 100, now,
    });
    expect(r1.courseCompleted).toBe(true);
    expect(r1.badge).toEqual({ badgeName: course.badgeName, badgeIcon: course.badgeIcon });
    expect(r1.pointsAwarded).toBe(course.pointsReward);
    const u1 = await prisma.user.findUnique({ where: { id: userId } });
    expect(u1.neuroPoints).toBe(course.pointsReward);

    // 2ª passada (refação da última aula): badge já existe -> sem duplicar
    const r2 = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[lessonIds.length - 1], courseSlug: 'html',
      prevBest: 100, novoScore: 100, now: new Date('2026-06-22T10:00:00Z'),
    });
    expect(r2.badge).toBeNull();
    expect(r2.pointsAwarded).toBe(0);
    expect(await prisma.badge.count({ where: { userId } })).toBe(1);
    const u2 = await prisma.user.findUnique({ where: { id: userId } });
    expect(u2.neuroPoints).toBe(course.pointsReward); // inalterado
  });

  it('matéria parcial não concede badge', async () => {
    await completeProgress(lessonIds[0], 100);
    const r = await awardOnCompletion(prisma, {
      userId, lessonId: lessonIds[0], courseSlug: 'html', prevBest: 0, novoScore: 100,
      now: new Date('2026-06-21T10:00:00Z'),
    });
    expect(r.courseCompleted).toBe(false);
    expect(r.badge).toBeNull();
    expect(r.pointsAwarded).toBe(0);
  });
});

afterAll(async () => {
  await prisma.badge.deleteMany({ where: { user: { email } } });
  await prisma.xpEvent.deleteMany({ where: { user: { email } } });
  await prisma.progress.deleteMany({ where: { user: { email } } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && npx vitest run tests/award.test.js`
Expected: FAIL — módulo `award.js` não existe.

- [ ] **Step 3: Implementação mínima**

Criar `server/src/gamification/award.js`:

```js
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd server && npx vitest run tests/award.test.js`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git add server/src/gamification/award.js server/tests/award.test.js
git commit -m "feat(server): award.js — XP/nível/streak + badge/pontos idempotentes"
```

---

## Task 5: Fiação no `completeSession` + invalidar `LessonSession`

**Files:**
- Modify: `server/src/ai/session.js:63-97` (função `completeSession`)
- Test: `server/tests/session.engine.test.js` (adicionar casos)

**Interfaces:**
- Consumes: `awardOnCompletion` (Task 4); `prisma.$transaction`.
- Produces: `completeSession(userId, lessonId, sessionToken)` passa a, no caminho de sucesso (≥80%), devolver: `{ ok: true, completed: true, score, nextLessonId, courseCompleted, xpAwarded, level, leveledUp, streak, badge?, pointsAwarded? }` e a **apagar a `LessonSession`** (token não-replayável). No caminho de falha (<80%) devolve `{ ok: true, completed: false, score }` **sem** apagar o token e **sem** recompensa.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `server/tests/session.engine.test.js`, ANTES do `afterAll` (que já limpa `attempt`/`progress`/`lessonSession`/`user` do `userId`):

```js
describe('Fase 5 — recompensa + gate não-replayável', () => {
  it('conclusão concede XP e devolve o resumo de recompensa', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    for (const ex of s.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      await gradeAttempt(userId, ex.id, s.sessionToken, JSON.parse(real.answer));
    }
    const r = await completeSession(userId, lesson1Id, s.sessionToken);
    expect(r.completed).toBe(true);
    expect(r.xpAwarded).toBeGreaterThan(0);
    expect(r.level).toBeGreaterThanOrEqual(1);
    expect(typeof r.leveledUp).toBe('boolean');
    expect(r.streak).toBeGreaterThanOrEqual(1);
  });

  it('o sessionToken fica inválido após a conclusão (não-replayável)', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    for (const ex of s.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      await gradeAttempt(userId, ex.id, s.sessionToken, JSON.parse(real.answer));
    }
    await completeSession(userId, lesson1Id, s.sessionToken);
    const gone = await prisma.lessonSession.findUnique({ where: { token: s.sessionToken } });
    expect(gone).toBeNull();
    const replay = await completeSession(userId, lesson1Id, s.sessionToken);
    expect(replay).toEqual({ error: 'invalid-session' });
  });

  it('anti-farming: refazer a aula com 100% de novo concede 0 XP', async () => {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    const s = await buildLessonSession(userId, lesson1Id);
    for (const ex of s.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      await gradeAttempt(userId, ex.id, s.sessionToken, JSON.parse(real.answer));
    }
    const r = await completeSession(userId, lesson1Id, s.sessionToken);
    expect(r.xpAwarded).toBe(0); // prevBest já era 100 da conclusão anterior
    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(after.xp).toBe(before.xp);
  });

  it('<80% não concede recompensa nem invalida o token', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    if (s.exercises.length > 1) {
      const first = s.exercises[0];
      const real = await prisma.exercise.findUnique({ where: { id: first.id } });
      await gradeAttempt(userId, first.id, s.sessionToken, JSON.parse(real.answer));
      const r = await completeSession(userId, lesson1Id, s.sessionToken);
      expect(r.completed).toBe(false);
      expect(r).not.toHaveProperty('xpAwarded');
      const still = await prisma.lessonSession.findUnique({ where: { token: s.sessionToken } });
      expect(still).not.toBeNull(); // token preservado
    }
  });
});
```

> Nota: o `afterAll` existente já limpa `xpEvent`/`badge`? **Não** — só `attempt`/`progress`/`lessonSession`/`user`. Como o `onDelete: Cascade` apaga `XpEvent`/`Badge` junto com o `user`, o cleanup atual basta. Não alterar o `afterAll`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && npx vitest run tests/session.engine.test.js`
Expected: FAIL — `completeSession` ainda não devolve `xpAwarded` nem apaga o token.

- [ ] **Step 3: Reescrever o trecho de sucesso de `completeSession`**

Em `server/src/ai/session.js`, adicionar o import no topo (junto aos outros):

```js
import { awardOnCompletion } from '../gamification/award.js';
```

Substituir o bloco final de `completeSession` (das linhas que fazem o `upsert` do `Progress` em diante, ou seja, de `await prisma.progress.upsert(...)` até o `return { ok: true, completed: true, ... }`) por:

```js
  // Caminho de sucesso: tudo numa transação (best-score + recompensa + invalidação do token).
  const prev = await prisma.progress.findUnique({
    where: { userId_lessonId: { userId, lessonId } }, select: { score: true },
  });
  const prevBest = prev?.score ?? 0;

  const reward = await prisma.$transaction(async (tx) => {
    await tx.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { status: 'completed', score: Math.max(prevBest, score), completedAt: new Date() },
      create: { userId, lessonId, status: 'completed', score },
    });
    const r = await awardOnCompletion(tx, {
      userId, lessonId, courseSlug: view.courseSlug, prevBest, novoScore: score, now: new Date(),
    });
    await tx.lessonSession.delete({ where: { token: sessionToken } }); // gate não-replayável
    return r;
  });

  return {
    ok: true, completed: true, score,
    nextLessonId: view.nextLessonId, courseCompleted: reward.courseCompleted,
    xpAwarded: reward.xpAwarded, level: reward.level, leveledUp: reward.leveledUp,
    streak: reward.streak,
    ...(reward.badge ? { badge: reward.badge } : {}),
    ...(reward.pointsAwarded ? { pointsAwarded: reward.pointsAwarded } : {}),
  };
```

A guarda de falha (`if (total === 0 || score < PASS_THRESHOLD) return { ok: true, completed: false, score };`) fica **intacta acima** desse bloco — não apaga token, não recompensa.

- [ ] **Step 4: Rodar e ver passar (arquivo + suíte de sessão)**

Run: `cd server && npx vitest run tests/session.engine.test.js`
Expected: PASS — incluindo os casos antigos do limiar (que agora também exercem a transação).

- [ ] **Step 5: Commit**

```bash
git add server/src/ai/session.js server/tests/session.engine.test.js
git commit -m "feat(server): completeSession concede recompensa em transação + invalida token"
```

---

## Task 6: `service.js` (leitura — dashboard + ranking)

**Files:**
- Create: `server/src/gamification/service.js`
- Test: `server/tests/gamification.service.test.js`

**Interfaces:**
- Consumes: `prisma` client; modelos `User`/`XpEvent`/`Badge`/`Course`.
- Produces:
  - `getDashboard(userId) -> { xp, level, neuroPoints, streak, weekly: { earned, goal, podium }, badges }` onde `podium` é `[{ name, weeklyXp }]` (top 3) e `badges` é `[{ courseSlug, badgeName, badgeIcon, earnedAt }]`.
  - `getRanking(userId) -> { top: [{ name, xp, level }], me: { rank, xp, level } }`.
  - Constantes: `META_SEMANAL_PADRAO = 500`, `RANKING_TOP_N = 10`, `JANELA_SEMANAL_DIAS = 7`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/tests/gamification.service.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';
import { getDashboard, getRanking, META_SEMANAL_PADRAO } from '../src/gamification/service.js';

const tag = randomUUID().slice(0, 8);
const emails = [`svc-a-${tag}@neurocode.dev`, `svc-b-${tag}@neurocode.dev`];
let a, b, course;

beforeAll(async () => {
  const ua = await prisma.user.create({ data: { name: `SvcA-${tag}`, email: emails[0], passwordHash: 'x', xp: 300, level: 2, neuroPoints: 100, streak: 3 } });
  const ub = await prisma.user.create({ data: { name: `SvcB-${tag}`, email: emails[1], passwordHash: 'x', xp: 120, level: 1 } });
  a = ua.id; b = ub.id;
  course = await prisma.course.findUnique({ where: { slug: 'html' } });

  const now = Date.now();
  const recent = new Date(now - 2 * 86400000);   // dentro da janela 7d
  const old = new Date(now - 10 * 86400000);     // fora da janela
  await prisma.xpEvent.createMany({ data: [
    { userId: a, amount: 200, reason: 'lesson:1', createdAt: recent },
    { userId: a, amount: 100, reason: 'lesson:2', createdAt: recent },
    { userId: a, amount: 999, reason: 'lesson:old', createdAt: old },   // não conta
    { userId: b, amount: 120, reason: 'lesson:3', createdAt: recent },
  ] });
  await prisma.badge.create({ data: { userId: a, courseId: course.id } });
});

describe('getDashboard', () => {
  it('soma a janela de 7 dias e monta o pódio', async () => {
    const d = await getDashboard(a);
    expect(d.xp).toBe(300);
    expect(d.streak).toBe(3);
    expect(d.weekly.earned).toBe(300);     // 200 + 100 (o 999 antigo fica fora)
    expect(d.weekly.goal).toBe(META_SEMANAL_PADRAO);
    expect(d.weekly.podium[0]).toEqual({ name: `SvcA-${tag}`, weeklyXp: 300 });
    expect(d.weekly.podium.find((p) => p.name === `SvcB-${tag}`)).toEqual({ name: `SvcB-${tag}`, weeklyXp: 120 });
    expect(d.badges).toEqual([
      expect.objectContaining({ courseSlug: 'html', badgeName: course.badgeName, badgeIcon: course.badgeIcon }),
    ]);
  });
});

describe('getRanking', () => {
  it('top por XP desc + minha posição', async () => {
    const r = await getRanking(b);
    const names = r.top.map((u) => u.name);
    expect(names.indexOf(`SvcA-${tag}`)).toBeLessThan(names.indexOf(`SvcB-${tag}`)); // A acima de B
    expect(r.me.xp).toBe(120);
    expect(r.me.rank).toBeGreaterThanOrEqual(1);
    // rank de B = (# usuários com xp > 120) + 1; A (300) está acima -> rank de B >= 2
    expect(r.me.rank).toBeGreaterThanOrEqual(2);
  });
});

afterAll(async () => {
  await prisma.badge.deleteMany({ where: { userId: { in: [a, b] } } });
  await prisma.xpEvent.deleteMany({ where: { userId: { in: [a, b] } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && npx vitest run tests/gamification.service.test.js`
Expected: FAIL — módulo `service.js` não existe.

- [ ] **Step 3: Implementação mínima**

Criar `server/src/gamification/service.js`:

```js
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd server && npx vitest run tests/gamification.service.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/gamification/service.js server/tests/gamification.service.test.js
git commit -m "feat(server): service.js — dashboard (meta semanal + pódio + badges) + ranking"
```

---

## Task 7: Rotas `GET /dashboard` + `GET /ranking`

**Files:**
- Create: `server/src/routes/gamification.js`
- Modify: `server/src/app.js:8-9,42-43` (import + mount)
- Test: `server/tests/gamification.routes.test.js`

**Interfaces:**
- Consumes: `getDashboard`, `getRanking` (Task 6); `requireAuth`.
- Produces: `GET /api/dashboard` e `GET /api/ranking` (ambas atrás de `requireAuth`), com os payloads da Task 6.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/tests/gamification.routes.test.js`:

```js
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const createdEmails = [];

async function authedAgent() {
  const email = `groute-${randomUUID()}@neurocode.dev`;
  createdEmails.push(email);
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/csrf')).body.csrfToken;
  await agent.post('/api/auth/register').set('x-csrf-token', csrf)
    .send({ name: 'GRoute', email, password: 'Sup3rSecret' });
  return agent;
}

describe('Rotas de gamificação — exigem sessão', () => {
  it('401 sem sessão em GET /api/dashboard', async () => {
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
  });
  it('401 sem sessão em GET /api/ranking', async () => {
    expect((await request(app).get('/api/ranking')).status).toBe(401);
  });
});

describe('Rotas de gamificação (autenticado)', () => {
  it('GET /api/dashboard devolve o formato do painel', async () => {
    const agent = await authedAgent();
    const res = await agent.get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      xp: expect.any(Number), level: expect.any(Number),
      neuroPoints: expect.any(Number), streak: expect.any(Number),
      weekly: { earned: expect.any(Number), goal: 500, podium: expect.any(Array) },
      badges: expect.any(Array),
    });
  });

  it('GET /api/ranking devolve top + minha posição', async () => {
    const agent = await authedAgent();
    const res = await agent.get('/api/ranking');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.top)).toBe(true);
    expect(res.body.me).toMatchObject({ rank: expect.any(Number), xp: expect.any(Number), level: expect.any(Number) });
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && npx vitest run tests/gamification.routes.test.js`
Expected: FAIL — rotas devolvem 404 (não montadas).

- [ ] **Step 3: Criar o router**

Criar `server/src/routes/gamification.js`:

```js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDashboard, getRanking } from '../gamification/service.js';

const router = Router();

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    res.json(await getDashboard(req.user.id));
  } catch (e) {
    next(e);
  }
});

router.get('/ranking', requireAuth, async (req, res, next) => {
  try {
    res.json(await getRanking(req.user.id));
  } catch (e) {
    next(e);
  }
});

export default router;
```

- [ ] **Step 4: Montar no app**

Em `server/src/app.js`, adicionar o import junto aos outros routers:

```js
import gamificationRouter from './routes/gamification.js';
```

E montar junto aos demais `app.use('/api', ...)` (depois de `onboardingRouter`):

```js
app.use('/api', gamificationRouter);
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd server && npx vitest run tests/gamification.routes.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/gamification.js server/src/app.js server/tests/gamification.routes.test.js
git commit -m "feat(server): rotas GET /api/dashboard + /api/ranking atrás de requireAuth"
```

---

## Task 8: Frontend — painel real, resumo de recompensa, página `/ranking`

**Files:**
- Modify: `web/src/pages/Dashboard.jsx`
- Modify: `web/src/components/ExerciseSession.jsx:56-73` (bloco de resultado)
- Create: `web/src/pages/Ranking.jsx`
- Modify: `web/src/App.jsx` (rota `/ranking`)
- Modify: `web/src/styles/components.css` (estilos do painel/ranking/reward — append ao fim)
- Test: `web/tests/Gamification.test.jsx`

**Interfaces:**
- Consumes: `apiGet` (`/api/dashboard`, `/api/ranking`); o payload de recompensa de `/api/lessons/:id/complete`.
- Produces: Dashboard com painel "Seu progresso"; resultado da sessão com resumo de recompensa; página `/ranking`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `web/tests/Gamification.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const user = { id: 1, name: 'Rangel', email: 'r@neuro.dev', plan: 'free', xp: 300, level: 2, neuroPoints: 120, streak: 4 };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>
  );
}

const dashboard = {
  xp: 300, level: 2, neuroPoints: 120, streak: 4,
  weekly: { earned: 300, goal: 500, podium: [{ name: 'Rangel', weeklyXp: 300 }, { name: 'Ana', weeklyXp: 120 }] },
  badges: [{ courseSlug: 'html', badgeName: 'Estruturador', badgeIcon: 'FileCode', earnedAt: '2026-06-21T10:00:00Z' }],
};
const ranking = {
  top: [{ name: 'Rangel', xp: 300, level: 2 }, { name: 'Ana', xp: 120, level: 1 }],
  me: { rank: 1, xp: 300, level: 2 },
};

function mockApi() {
  return vi.fn((url) => {
    const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    if (url.endsWith('/api/auth/me')) return ok({ user });
    if (url.endsWith('/api/csrf')) return ok({ csrfToken: 't' });
    if (url.endsWith('/api/dashboard')) return ok(dashboard);
    if (url.endsWith('/api/ranking')) return ok(ranking);
    return ok({});
  });
}

beforeEach(() => vi.stubGlobal('fetch', mockApi()));
afterEach(() => vi.unstubAllGlobals());

describe('Dashboard — painel Seu progresso', () => {
  it('mostra nível, streak, meta semanal e badges', async () => {
    renderAt('/dashboard');
    // asserções deliberadamente únicas no DOM (evita multi-match do findByText):
    expect(await screen.findByText(/300\s*\/\s*500/)).toBeInTheDocument(); // meta semanal
    expect(await screen.findByText(/Nível 2/)).toBeInTheDocument();        // só nas stats
    expect(await screen.findByText(/4 dias/)).toBeInTheDocument();         // streak
    expect(await screen.findByText('Estruturador')).toBeInTheDocument();   // badge-list
  });
});

describe('Página /ranking', () => {
  it('mostra o leaderboard e minha posição', async () => {
    renderAt('/ranking');
    expect(await screen.findByText('Ranking')).toBeInTheDocument();        // <h1>
    expect(await screen.findAllByText('Rangel')).not.toHaveLength(0);
    // "#1" aparece em rank-me e no topo da lista -> usar findAllByText:
    expect((await screen.findAllByText(/#1/)).length).toBeGreaterThanOrEqual(1);
  });
});
```

Adicionar também um teste de **resumo de recompensa** ao `web/tests/Content.test.jsx`. Primeiro, atualizar o mock de conclusão nesse arquivo (linha do `/api/lessons/1/complete`) para devolver recompensa:

```js
    if (url.endsWith('/api/lessons/1/complete')) return ok({ ok: true, completed: true, score: 100, nextLessonId: null, courseCompleted: true, xpAwarded: 100, level: 2, leveledUp: true, streak: 1, badge: { badgeName: 'Estruturador', badgeIcon: 'FileCode' }, pointsAwarded: 100 });
```

E acrescentar uma asserção ao teste existente "mostra a teoria, inicia a sessão e conclui com aprovação", logo após a linha que confirma `/aula concluída/i`:

```js
    // resumo de recompensa
    expect(await screen.findByText(/\+100 XP/)).toBeInTheDocument();
    expect(await screen.findByText(/Estruturador/)).toBeInTheDocument();
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/Gamification.test.jsx tests/Content.test.jsx`
Expected: FAIL — Dashboard ainda é placeholder; rota `/ranking` não existe; ExerciseSession não mostra recompensa.

- [ ] **Step 3: Reescrever o Dashboard**

Substituir `web/src/pages/Dashboard.jsx` por:

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiGet } from '../lib/api.js';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  const pct = data ? Math.min(100, Math.round((data.weekly.earned / data.weekly.goal) * 100)) : 0;

  return (
    <>
      <Header />
      <main className="container">
        <h1>Olá, {user?.name}</h1>
        {error && <p className="rm-error">{error}</p>}
        {data && (
          <section className="dash-progress card">
            <h2>Seu progresso</h2>
            <ul className="dash-stats">
              <li><b>Nível {data.level}</b></li>
              <li><b>{data.xp} XP</b></li>
              <li>🔥 {data.streak} dias</li>
              <li>{data.neuroPoints} NeuroPoints</li>
            </ul>

            <div className="dash-weekly">
              <p>Meta semanal: {data.weekly.earned} / {data.weekly.goal} XP</p>
              <div className="progress"><span style={{ width: `${pct}%` }} /></div>
            </div>

            {data.weekly.podium.length > 0 && (
              <div className="dash-podium">
                <h3>Pódio da semana</h3>
                <ol>
                  {data.weekly.podium.map((p, i) => (
                    <li key={i}>{p.name} — {p.weeklyXp} XP</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="dash-badges">
              <h3>Badges</h3>
              {data.badges.length === 0
                ? <p className="dash-empty">Conclua uma matéria para ganhar seu primeiro badge.</p>
                : <ul className="badge-list">
                    {data.badges.map((b) => (
                      <li key={b.courseSlug} className="badge">{b.badgeName}</li>
                    ))}
                  </ul>}
            </div>
          </section>
        )}

        <div className="dash-actions">
          <Link to="/roadmap" className="btn btn-primary">Ir para o roadmap</Link>
          <Link to="/ranking" className="btn btn-ghost">Ranking</Link>
          <button className="btn btn-ghost" onClick={logout}>Sair</button>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Criar a página de ranking**

Criar `web/src/pages/Ranking.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGet } from '../lib/api.js';

export default function Ranking() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/ranking').then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Header />
      <main className="container">
        <h1>Ranking</h1>
        {error && <p className="rm-error">{error}</p>}
        {data && (
          <>
            <p className="rank-me">Sua posição: <b>#{data.me.rank}</b> · {data.me.xp} XP · Nível {data.me.level}</p>
            <ol className="rank-list">
              {data.top.map((u, i) => (
                <li key={i} className="rank-row">
                  <span className="rank-pos">#{i + 1}</span>
                  <span className="rank-name">{u.name}</span>
                  <span className="rank-xp">{u.xp} XP · Nv {u.level}</span>
                </li>
              ))}
            </ol>
          </>
        )}
        <Link to="/dashboard" className="btn btn-ghost">Voltar ao dashboard</Link>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Registrar a rota `/ranking`**

Em `web/src/App.jsx`, importar a página:

```jsx
import Ranking from './pages/Ranking.jsx';
```

E adicionar dentro do bloco `<Route element={<ProtectedRoute />}>`:

```jsx
        <Route path="/ranking" element={<Ranking />} />
```

- [ ] **Step 6: Resumo de recompensa no resultado da sessão**

Em `web/src/components/ExerciseSession.jsx`, dentro do `if (result) { return (...) }`, adicionar o bloco de recompensa logo após o `<p className="ex-pass">.../<p className="ex-fail">...` (ou seja, dentro de `<div className="ex-result">`, antes dos botões de navegação):

```jsx
        {result.completed && result.xpAwarded != null && (
          <div className="ex-reward">
            <p className="reward-xp">+{result.xpAwarded} XP</p>
            {result.leveledUp && <p className="reward-level">⬆️ Subiu para o nível {result.level}!</p>}
            <p className="reward-streak">🔥 Streak: {result.streak} dia(s)</p>
            {result.badge && (
              <p className="reward-badge">🏅 Badge desbloqueado: <b>{result.badge.badgeName}</b>
                {result.pointsAwarded ? ` (+${result.pointsAwarded} NeuroPoints)` : ''}</p>
            )}
          </div>
        )}
```

- [ ] **Step 7: Estilos (append, sem novo import)**

Anexar ao fim de `web/src/styles/components.css`:

```css
/* Fase 5 — gamificação */
.dash-progress { display: grid; gap: 1rem; margin: 1.5rem 0; }
.dash-stats { display: flex; flex-wrap: wrap; gap: 1rem; list-style: none; padding: 0; }
.dash-weekly .progress { margin-top: .25rem; }
.dash-podium ol { margin: .25rem 0 0; padding-left: 1.2rem; }
.badge-list { display: flex; flex-wrap: wrap; gap: .5rem; list-style: none; padding: 0; }
.dash-empty { color: var(--muted, #888); }
.dash-actions { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: 1rem; }
.ex-reward { display: grid; gap: .25rem; margin: .75rem 0; padding: .75rem 1rem; border-radius: .75rem; background: var(--surface-2, #1c1c22); }
.reward-xp { font-weight: 700; font-size: 1.25rem; }
.rank-list { list-style: none; padding: 0; display: grid; gap: .5rem; }
.rank-row { display: grid; grid-template-columns: 3rem 1fr auto; align-items: center; gap: .75rem; padding: .5rem .75rem; border-radius: .5rem; background: var(--surface-2, #1c1c22); }
.rank-pos { font-weight: 700; opacity: .8; }
.rank-me { margin-bottom: 1rem; }
```

- [ ] **Step 8: Rodar e ver passar**

Run: `cd web && npx vitest run tests/Gamification.test.jsx tests/Content.test.jsx`
Expected: PASS — painel, ranking e resumo de recompensa renderizam.

- [ ] **Step 9: Commit**

```bash
git add web/src/pages/Dashboard.jsx web/src/pages/Ranking.jsx web/src/App.jsx web/src/components/ExerciseSession.jsx web/src/styles/components.css web/tests/Gamification.test.jsx web/tests/Content.test.jsx
git commit -m "feat(web): painel Seu progresso + resumo de recompensa + página /ranking"
```

---

## Task 9: Saída — suíte completa + smoke + docs + Vault

**Files:**
- Modify: `README.md`, `GETTING-STARTED.md` (seção de gamificação)
- Modify (Vault): `Neuro/03 Projetos/NeuroCode/CLAUDE.md` (Current Status), `(C) Plano — Fase 5 Gamificação.md` (status), e o design se aplicável.

**Interfaces:**
- Consumes: tudo das Tasks 1–8.
- Produces: prova de que o critério de saída foi atingido.

- [ ] **Step 1: Suíte completa do server**

Run: `cd server && npx vitest run`
Expected: PASS — 103 testes antigos + novos (`gamification.model`, `xp`, `streak`, `award`, `gamification.service`, `gamification.routes`, e os casos novos de `session.engine`). Nenhum regressão.

- [ ] **Step 2: Suíte completa do web**

Run: `cd web && npx vitest run`
Expected: PASS — incluindo `Gamification.test.jsx` e o `Content.test.jsx` atualizado.

- [ ] **Step 3: Suíte raiz (as duas pontas)**

Run: `npm test` (na raiz `Trabalho Neurocode`)
Expected: server verde **e** web verde.

- [ ] **Step 4: Smoke E2E manual (curl)**

Subir o server (`cd server && npm run dev`) e validar o fluxo com cookies/CSRF:

```bash
# (com um usuário logado — reaproveitar o agente do app ou um cookie jar)
curl -s -b cookies.txt http://localhost:4000/api/dashboard | jq .
curl -s -b cookies.txt http://localhost:4000/api/ranking | jq .
```
Expected: `dashboard` traz `xp/level/neuroPoints/streak/weekly/badges`; `ranking` traz `top/me`. Concluir uma aula ≥80% e reconsultar: XP subiu, streak ≥1; fechar a matéria → `badge` + `pointsAwarded` no payload de conclusão e badge listado no dashboard.

- [ ] **Step 5: Atualizar docs do repo**

Em `README.md` e `GETTING-STARTED.md`, adicionar uma linha na lista de funcionalidades: gamificação (XP por delta de melhora → nível; streak diário; badge + NeuroPoints ao fechar matéria; ranking global; painel "Seu progresso"). Citar as rotas `GET /api/dashboard` e `GET /api/ranking`.

- [ ] **Step 6: Commit dos docs do repo**

```bash
git add README.md GETTING-STARTED.md
git commit -m "docs: gamificação (XP/streak/badges/ranking) no README e GETTING-STARTED"
```

- [ ] **Step 7: Atualizar o Vault (regra de sync)**

Atualizar:
- `(C) Plano — Fase 5 Gamificação.md`: `status: implementado`, nota do que foi entregue + nº de testes.
- `CLAUDE.md` → bloco **Current Status**: marcar Fase 5 como feita (modelos `Badge`/`XpEvent`, módulo `gamification/`, recompensa transacional + token não-replayável, rotas `dashboard`/`ranking`, frontend), com a contagem final de `npm test`.
- Apontar o plano executável (este arquivo) no design/índice, conforme o padrão das fases anteriores.

*(Sem commit — o Vault não é repositório git deste projeto; é a regra de sync do NeuroCode.)*

---

## Critério de saída (checklist)

- [ ] `npm test` (raiz) verde nas duas pontas (server + suítes novas; web + painel/ranking/reward).
- [ ] Fluxo real: login → aula → concluir ≥80% → ganhar XP → subir de nível → fechar matéria → **badge + pontos** → aparecer no **ranking** e na **meta semanal**.
- [ ] **Anti-farming:** refazer aula concluída com nota igual/menor concede **0 XP**; com nota maior concede só o **delta**.
- [ ] **Gate não-replayável:** `sessionToken` inválido após a conclusão (replay → `invalid-session`).
- [ ] Recompensa **server-autoritativa** dentro de uma transação; nenhuma rota de escrita sem `verifyCsrf`.
- [ ] **Sem novas dependências de runtime.**

## Fora de escopo (Fase 6)

Resgate de NeuroPoints · emissão de certificado · `PointsLedger` · página `/perfil` completa · checkout simulado + gating de plano.

## Dívida herdada (não bloqueia)

- `npm audit`: 1 high + 1 critical **só na cadeia dev** (esbuild/vite/vitest) — não afeta produção.
- Texto de "carregando" no `Onboarding.jsx`; gatear botão "Concluir aula" por `status` na UI (polimento da Fase 3).
- `getRoadmap` N+1 (Fase 3).
