# Fase 4 — Motor adaptativo + exercícios · Plano de Implementação (NeuroCode)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o coração do NeuroCode — modelos `Exercise`/`Attempt`, um **banco embutido** de exercícios etiquetados por conceito+dificuldade, um **motor adaptativo puro/testável** (maestria por conceito → seleção da sessão), a **sessão de aula estilo Duolingo** na tela de Aula com conclusão por **limiar de ≥80% de acerto de 1ª tentativa**, um **onboarding** de 3 perguntas que semeia a maestria inicial, e um **gancho de geração via Claude** isolado atrás da flag `CLAUDE_API_KEY` (desligado por padrão).

**Architecture:** O backend ganha dois modelos Prisma (`Exercise` por aula, `Attempt` por aluno/exercício) e um módulo `ai/` com **lógica pura testável** (`grade.js`, `mastery.js`, `selector.js`) + uma camada de dados/orquestração (`bank.js`, `session.js`) + o cliente opcional (`claudeClient.js`). O conteúdo dos exercícios vive em `content/exercises.js` (estático, semeado idempotentemente junto do conteúdo da Fase 3). A tela de Aula passa de "teoria + botão" para "teoria + sessão de exercícios": o frontend busca a sessão montada pelo seletor, resolve um exercício por vez com feedback imediato (re-enfileira erro até acertar), e ao final chama a conclusão — que **grava `Progress` apenas se a acurácia de 1ª tentativa ≥ 80%**. Toda a correção é **server-autoritativa** (o `answer` nunca sai para o cliente). Gamificação (XP/pontos/badges) continua **fora** desta fase.

**Tech Stack:** Node 18+ (ESM), Express 4, Prisma 5 + SQLite, Vitest 2 + Supertest (server); React 18, Vite 5, react-router-dom 6, Vitest 2 + @testing-library/react + jsdom (web). **Sem novas dependências de runtime** — o cliente Claude usa o `fetch` global do Node 18+ contra a Messages API (sem `@anthropic-ai/sdk`).

## Global Constraints

- **Node.js 18+** (recomendado 20 LTS). Gerenciador: **npm**. `server/` e `web/` são **ESM** (`"type": "module"`).
- API em **`http://localhost:4000`**, prefixo **`/api`**. Frontend: **Vite na 5173**, proxy de `/api` → `http://localhost:4000`.
- Banco: **SQLite via Prisma 5**, `DATABASE_URL="file:./dev.db"`. **Os testes do server rodam contra `server/prisma/test.db`** (nunca `dev.db`), recriado e semeado pelo `global-setup`.
- Testes: **Vitest** (`npm test` = `vitest run`). Backend usa Supertest; frontend usa `@testing-library/react` + jsdom, assertivas **assíncronas** (`findBy*`), com future flags do Router e `vi.unstubAllGlobals()` no `afterEach`.
- **Toda rota de exercício/sessão/onboarding exige sessão** (`requireAuth`); rotas que mudam estado (attempt, complete, onboarding POST) também passam por `verifyCsrf`.
- **Rotas novas/alteradas (exatas):**
  - `GET /api/lessons/:id/session` — monta a sessão adaptativa (sem `answer`).
  - `POST /api/exercises/:id/attempt` — grava a 1ª tentativa sob o `sessionToken`, devolve `{correct, solution}`.
  - `POST /api/lessons/:id/complete` — **alterada**: agora recebe `{sessionToken}` e conclui por limiar (≥80%).
  - `GET /api/onboarding` — 3 perguntas (sem `answer`); `POST /api/onboarding` — grava Attempts iniciais + marca `onboardedAt`.
- **Escopo travado (design §Seção 2 / spec §Subsistema 2 + decisões de Rangel 2026-06-20):**
  - **Conclusão por limiar:** a aula conclui (`Progress(completed)`, com `score`) **somente se** acerto de 1ª tentativa **≥ 80%**; abaixo disso a aula **continua `available`** para refazer.
  - **Seletor por contagem adaptativa:** base **3** exercícios; **+2 por conceito fraco** da aula; **teto 8**. Ordem fraco→novo→proficiente, fácil→difícil; conceito novo começa na dificuldade 1; proficiente puxa do mais difícil.
  - **Maestria:** acurácia das **últimas 5** tentativas de 1ª vez por conceito. `new`(0 tentativas) · `proficient`(acurácia ≥ 0,8) · `weak`(o resto, com ≥1 tentativa).
  - **Onboarding entra agora:** 3 perguntas pós-cadastro semeiam Attempts iniciais; `User.onboardedAt` marca a conclusão.
  - **Gancho Claude isolado:** `ai/claudeClient.js` atrás de `CLAUDE_API_KEY` (off por padrão). Sem chave = no-op (seletor cai 100% no banco). Com chave: gera p/ lacuna de conceito fraco, **valida** o JSON contra o schema de `Exercise` e **cacheia** no banco (`source='ai'`). Testado com a flag **OFF** (e 1 teste com a flag ON e `fetch` **mockado**).
  - **Zero gamificação:** a conclusão **não** mexe em `xp`/`neuroPoints`/`level`/badges. Isso é Fase 5.
- **Correção server-autoritativa:** o `Exercise.answer` **nunca** é enviado ao cliente em `GET /session` nem em `GET /lessons/:id`. A nota de cada tentativa é calculada no servidor.
- **Campos dos modelos (spec §Subsistema 2 — copiar verbatim, com extensões marcadas):**
  - **Exercise** — `lessonId`, `type` (`multiple-choice`|`fill-blank`|`predict-output`|`order-lines`), `prompt`, `options` (JSON), `answer` (JSON), `difficulty` (1–3), `conceptTag`, `source` (`bank`|`ai`, default `bank`).
  - **Attempt** — `userId`, `exerciseId`, `correct` (Bool), `answeredAt`. **Extensão desta fase:** `sessionToken String?` (delimita a 1ª tentativa por sessão; permite calcular o limiar de forma server-autoritativa sem confiar no cliente).
  - **User** — ganha `onboardedAt DateTime?`.
- **Codificação de `options`/`answer` por tipo** (JSON strings no SQLite; a camada de serviço faz `JSON.parse`):
  - `multiple-choice` — `options` = array de strings (alternativas); `answer` = índice (number) da correta.
  - `fill-blank` — `options` = `[]`; `answer` = string esperada (comparação normalizada: `trim`, espaços colapsados, minúsculas).
  - `predict-output` — `options` = `[]`; `answer` = saída esperada (mesma normalização).
  - `order-lines` — `options` = array de linhas na ordem **apresentada**; `answer` = array de índices (em `options`) na **ordem correta**; resposta do aluno = array de índices.
- O `.gitignore` raiz já ignora `node_modules/`, `*.db`, `*.sqlite`, `.env` (mantém `.env.example`). **`server/.env` nunca é versionado.** A flag `CLAUDE_API_KEY` entra só no `.env.example` (vazia).
- **Toda mensagem de commit termina com os dois trailers padrão** (anexar ao final, omitidos dos passos por brevidade):
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M4GLWrrakCikMhWDKqX9fe
  ```
- Todos os comandos rodam a partir da raiz do repo (`Trabalho Neurocode/`), com `cd` explícito para `server/` ou `web/`.

## Estado herdado da Fase 3 (ponto de partida)

- `server/prisma/schema.prisma` tem `User`/`Session`/`Roadmap`/`Course`/`Lesson`/`Progress`. Ganha `Exercise`/`Attempt` + `onboardedAt` em `User` na Task 1.
- `server/src/content/seed.js` exporta `CONTENT` (roadmap Front-end, slugs `html`/`css`/`javascript`, 3 aulas cada) e `seedContent(prisma)` idempotente. **Os `conceptTags` por aula são a chave de junção dos exercícios.** Conceitos existentes (18): `html-basico`, `tags`, `elementos`, `estrutura-documento`, `ancoras`, `imagens`, `seletores`, `especificidade`, `box-model`, `espacamento`, `flexbox`, `layout`, `variaveis`, `tipos`, `funcoes`, `escopo`, `dom`, `eventos`.
- `server/src/content/service.js` exporta `listRoadmaps`/`getRoadmap`/`getCourse`/`getLesson`/`completeLesson`. As leituras são **reutilizadas**; `completeLesson` é **removida** na Task 5 (a conclusão passa a ser por limiar de sessão, em `ai/session.js`).
- `server/src/routes/content.js` monta as rotas de conteúdo atrás de `requireAuth` (por rota) e tem `POST /lessons/:id/complete` com `verifyCsrf` — **alterada** na Task 5.
- `server/src/app.js` monta: helmet → cors → json → cookieParser → issueCsrf → `GET /api/csrf` → `/api` (health) → `/api/auth` → `/api` (content) → notFound → errorHandler. As Tasks 5 e 8 inserem `exerciseRouter` e `onboardingRouter` em `/api` **antes** do `notFound`.
- `server/src/middleware/auth.js` (`requireAuth`, popula `req.user`) e `server/src/middleware/csrf.js` (`verifyCsrf`) — **reutilizados**.
- `server/src/db/client.js` exporta o singleton `prisma` (`import 'dotenv/config'` no topo, **não** sobrescreve env já definida). **Inalterado.**
- `server/tests/global-setup.js` recria `test.db` via `npx prisma migrate deploy` e chama `seedContent`. A Task 4 acrescenta a semeadura dos exercícios (via `seedContent`, que passará a chamar `seedExercises`).
- `server/src/routes/auth.js` tem `toPublicUser(u)` (sem `onboardedAt`) e `GET /me`. A Task 8 adiciona `onboardedAt` ao `toPublicUser`.
- `web/src/lib/api.js` exporta `apiGet(path)`/`apiPost(path, body)` (fetch `/api${path}`, `credentials:'include'`, CSRF no POST, lança `ApiError`). **Reutilizado direto.**
- `web/src/pages/Lesson.jsx` mostra teoria + botão "Concluir aula" — **reescrita** na Task 7. `web/src/components/LessonContent.jsx` (renderer de blocos) — **reutilizado**.
- `web/src/App.jsx` mapeia `/`, `/login`, `/register`, e (em `<ProtectedRoute>`) `/dashboard`, `/roadmap`, `/curso/:slug`, `/aula/:id`. A Task 8 adiciona `/onboarding`.
- `web/src/context/AuthContext.jsx` expõe `useAuth()` (`{ user, loading, login, register, logout, refresh }`). `register` devolve o `user`. A Task 8 usa `user.onboardedAt` para o redirect.
- `web/src/main.jsx` importa `variables/base/components/landing/auth/roadmap.css`. A Task 7 adiciona estilos de exercício a `roadmap.css` (sem novo import).
- Tokens disponíveis (`web/src/styles/variables.css`): `--grad-brand`, `--c-card`, `--c-border`, `--c-text`, `--c-text-muted`, `--c-green`, `--c-purple`, `--radius`, `--radius-lg`, `--shadow-card`. Utilitários (`components.css`): `.card`, `.badge`, `.progress > span`, `.btn`/`.btn-primary`/`.btn-ghost`/`.btn-block`, `.container`.

---

### Task 1: Modelos `Exercise`/`Attempt` + `User.onboardedAt` + migração

Os dois modelos do design, mais o campo de onboarding, com as relações e o índice que serve as consultas de maestria. Sem rotas nem seed ainda — só o schema, a migração e um teste de banco que prova as relações e os defaults.

**Files:**
- Modify: `server/prisma/schema.prisma` (2 modelos novos + `onboardedAt` e relações em `User`/`Lesson`)
- Create: `server/prisma/migrations/<timestamp>_add_exercises_attempts/` (gerada pelo CLI)
- Test: `server/tests/exercise.model.test.js`

**Interfaces:**
- Consumes: o client `prisma`; os modelos `User` e `Lesson` da Fase 3.
- Produces (modelos Prisma que as Tasks 2–8 consomem):
  - **`Exercise`**: `id Int @id`, `lessonId Int`, `lesson Lesson @relation(onDelete: Cascade)`, `type String`, `prompt String`, `options String` (JSON), `answer String` (JSON), `difficulty Int`, `conceptTag String`, `source String @default("bank")`, `createdAt DateTime @default(now())`, `attempts Attempt[]`.
  - **`Attempt`**: `id Int @id`, `userId Int`, `user User @relation(onDelete: Cascade)`, `exerciseId Int`, `exercise Exercise @relation(onDelete: Cascade)`, `correct Boolean`, `sessionToken String?`, `answeredAt DateTime @default(now())`, `@@index([userId])`, `@@index([userId, sessionToken])`.
  - `User` ganha `onboardedAt DateTime?` e `attempts Attempt[]`; `Lesson` ganha `exercises Exercise[]`.

- [ ] **Step 1: Escrever o teste de banco que falha**

`server/tests/exercise.model.test.js`:
```js
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';

const email = `ex-${randomUUID()}@neurocode.dev`;
let userId;
let lessonId;

beforeAll(async () => {
  const user = await prisma.user.create({ data: { name: 'Ex', email, passwordHash: 'x' } });
  userId = user.id;
  // Reaproveita uma aula já semeada (HTML, aula 1) como dona dos exercícios.
  const lesson = await prisma.lesson.findFirst({ where: { course: { slug: 'html' } }, orderBy: { order: 'asc' } });
  lessonId = lesson.id;
});

describe('Modelos Exercise/Attempt', () => {
  it('User nasce com onboardedAt null', async () => {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u.onboardedAt).toBeNull();
  });

  it('cria Exercise na aula e Attempt do usuário, com defaults', async () => {
    const ex = await prisma.exercise.create({
      data: {
        lessonId,
        type: 'multiple-choice',
        prompt: 'Qual tag cria um link?',
        options: JSON.stringify(['<p>', '<a>', '<img>']),
        answer: JSON.stringify(1),
        difficulty: 1,
        conceptTag: 'tags',
      },
    });
    expect(ex.source).toBe('bank');

    const attempt = await prisma.attempt.create({
      data: { userId, exerciseId: ex.id, correct: true, sessionToken: 'tok-1' },
    });
    expect(attempt.answeredAt).toBeInstanceOf(Date);

    const withAttempts = await prisma.exercise.findUnique({
      where: { id: ex.id },
      include: { attempts: true },
    });
    expect(withAttempts.attempts).toHaveLength(1);
  });

  afterAll(async () => {
    await prisma.attempt.deleteMany({ where: { userId } });
    await prisma.exercise.deleteMany({ where: { lessonId, conceptTag: 'tags', prompt: 'Qual tag cria um link?' } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `prisma.exercise` / `prisma.attempt` não existem no client; `onboardedAt` não existe em `User`.

- [ ] **Step 3: Acrescentar os modelos e o campo ao schema**

Em `server/prisma/schema.prisma`, atualizar `User`, atualizar `Lesson` e adicionar os dois modelos ao final. O `User` fica:
```prisma
model User {
  id             Int        @id @default(autoincrement())
  name           String
  email          String     @unique
  passwordHash   String
  plan           String     @default("free")
  xp             Int        @default(0)
  level          Int        @default(1)
  neuroPoints    Int        @default(0)
  streak         Int        @default(0)
  lastActiveDate DateTime?
  onboardedAt    DateTime?
  createdAt      DateTime   @default(now())
  sessions       Session[]
  progress       Progress[]
  attempts       Attempt[]
}
```
No `Lesson`, adicionar a relação `exercises`:
```prisma
model Lesson {
  id          Int        @id @default(autoincrement())
  courseId    Int
  course      Course     @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title       String
  order       Int
  content     String
  conceptTags String
  progress    Progress[]
  exercises   Exercise[]
}
```
E ao final do arquivo:
```prisma
model Exercise {
  id         Int       @id @default(autoincrement())
  lessonId   Int
  lesson     Lesson    @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  type       String
  prompt     String
  options    String
  answer     String
  difficulty Int
  conceptTag String
  source     String    @default("bank")
  createdAt  DateTime  @default(now())
  attempts   Attempt[]
}

model Attempt {
  id           Int      @id @default(autoincrement())
  userId       Int
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  exerciseId   Int
  exercise     Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  correct      Boolean
  sessionToken String?
  answeredAt   DateTime @default(now())

  @@index([userId])
  @@index([userId, sessionToken])
}
```

- [ ] **Step 4: Criar a migração (regenera o client com os modelos)**

Run:
```bash
cd server && npx prisma migrate dev --name add_exercises_attempts
```
Expected: cria `server/prisma/migrations/<timestamp>_add_exercises_attempts/`, aplica no `dev.db` e regenera `@prisma/client` com `Exercise`/`Attempt` e `onboardedAt`. (O `global-setup` aplicará no `test.db` via `migrate deploy`.)

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `exercise.model.test.js` (3) verde; demais suítes seguem verdes.

- [ ] **Step 6: Confirmar que o dev.db não vazou no diff**

Run:
```bash
cd server && git status --porcelain
```
Expected: aparecem `prisma/schema.prisma`, a pasta nova de migração e o teste; `*.db` continua ignorado.

- [ ] **Step 7: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations server/tests/exercise.model.test.js
git commit -m "feat(server): modelos Exercise/Attempt + User.onboardedAt + migração"
```

---

### Task 2: Correção pura (`ai/grade.js`)

A função pura que diz se uma resposta está correta, por tipo. Server-autoritativa, sem I/O, 100% testável. É consumida pela camada de sessão (Task 5) e pelo onboarding (Task 8).

**Files:**
- Create: `server/src/ai/grade.js`
- Test: `server/tests/grade.test.js`

**Interfaces:**
- Consumes: nada (puro).
- Produces (exports nomeados de `server/src/ai/grade.js`):
  - `grade(exercise, submitted): boolean` — `exercise` tem `type` e `answer` (string JSON). `submitted` é a resposta crua do cliente (índice, string, ou array de índices conforme o tipo). Retorna `true`/`false`. Tipos desconhecidos → `false`.
  - `normalize(s): string` — exportada p/ reuso/teste (trim + colapsa espaços + minúsculas).

- [ ] **Step 1: Escrever os testes que falham**

`server/tests/grade.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { grade, normalize } from '../src/ai/grade.js';

const ex = (type, answer) => ({ type, answer: JSON.stringify(answer) });

describe('grade', () => {
  it('multiple-choice compara índice', () => {
    expect(grade(ex('multiple-choice', 1), 1)).toBe(true);
    expect(grade(ex('multiple-choice', 1), '1')).toBe(true); // tolera string numérica
    expect(grade(ex('multiple-choice', 1), 0)).toBe(false);
  });

  it('fill-blank compara string normalizada', () => {
    expect(grade(ex('fill-blank', 'const'), '  Const ')).toBe(true);
    expect(grade(ex('fill-blank', 'color: red'), 'color:   red')).toBe(true);
    expect(grade(ex('fill-blank', 'const'), 'let')).toBe(false);
  });

  it('predict-output compara saída normalizada', () => {
    expect(grade(ex('predict-output', 'Rangel 10'), 'rangel 10')).toBe(true);
    expect(grade(ex('predict-output', '42'), '43')).toBe(false);
  });

  it('order-lines compara a ordem exata de índices', () => {
    expect(grade(ex('order-lines', [2, 0, 1]), [2, 0, 1])).toBe(true);
    expect(grade(ex('order-lines', [2, 0, 1]), ['2', '0', '1'])).toBe(true);
    expect(grade(ex('order-lines', [2, 0, 1]), [0, 1, 2])).toBe(false);
    expect(grade(ex('order-lines', [2, 0, 1]), [2, 0])).toBe(false);
    expect(grade(ex('order-lines', [0, 1]), 'nao-array')).toBe(false);
  });

  it('tipo desconhecido nunca passa', () => {
    expect(grade(ex('mistério', 'x'), 'x')).toBe(false);
  });

  it('normalize colapsa espaços e baixa caixa', () => {
    expect(normalize('  Olá   Mundo ')).toBe('olá mundo');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/ai/grade.js` não existe.

- [ ] **Step 3: Implementar a correção pura**

`server/src/ai/grade.js`:
```js
// Correção server-autoritativa por tipo de exercício. Puro (sem I/O).
// Codificação (ver Global Constraints):
//   multiple-choice → answer: índice (number); submitted: índice
//   fill-blank      → answer: string;          submitted: string (normalizada)
//   predict-output  → answer: string (saída);  submitted: string (normalizada)
//   order-lines     → answer: array de índices na ordem correta; submitted: array de índices

export function normalize(s) {
  return String(s).trim().replace(/\s+/g, ' ').toLowerCase();
}

export function grade(exercise, submitted) {
  let answer;
  try {
    answer = JSON.parse(exercise.answer);
  } catch {
    return false;
  }
  switch (exercise.type) {
    case 'multiple-choice':
      return Number(submitted) === Number(answer);
    case 'fill-blank':
    case 'predict-output':
      return normalize(submitted) === normalize(answer);
    case 'order-lines': {
      if (!Array.isArray(submitted) || !Array.isArray(answer)) return false;
      if (submitted.length !== answer.length) return false;
      return submitted.every((v, i) => Number(v) === Number(answer[i]));
    }
    default:
      return false;
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `grade.test.js` (6) verde.

- [ ] **Step 5: Commit**

```bash
git add server/src/ai/grade.js server/tests/grade.test.js
git commit -m "feat(server): correção pura de exercícios por tipo (ai/grade)"
```

---

### Task 3: Maestria + seletor adaptativo (`ai/mastery.js`, `ai/selector.js`)

A inteligência adaptativa, em **duas funções puras**: `computeMastery` deriva o nível por conceito a partir das tentativas; `buildSession` monta a sessão (contagem adaptativa + ordenação). Sem I/O — recebem dados prontos, devolvem decisões. É o que torna "a IA se adapta" testável e determinístico.

**Files:**
- Create: `server/src/ai/mastery.js`
- Create: `server/src/ai/selector.js`
- Test: `server/tests/mastery.test.js`
- Test: `server/tests/selector.test.js`

**Interfaces:**
- Consumes: nada (puro).
- Produces:
  - `server/src/ai/mastery.js`:
    - `computeMastery(attempts): Map<conceptTag, { level, accuracy, count }>` — `attempts` = `[{ conceptTag, correct, answeredAt }]` (quaisquer tentativas do usuário). Considera as **últimas 5** por conceito (mais recentes primeiro). `level ∈ { 'new'(count 0), 'proficient'(accuracy ≥ 0.8), 'weak'(resto) }`.
    - `levelFor(mastery, concept): 'new'|'weak'|'proficient'` — nível de um conceito (sem histórico ⇒ `'new'`).
  - `server/src/ai/selector.js`:
    - `sessionSize(mastery, concepts): number` — `min(8, 3 + 2 * (# conceitos fracos da aula))`.
    - `buildSession(mastery, concepts, pool): Exercise[]` — escolhe e ordena exercícios do `pool` (dos conceitos da aula). Round-robin por conceito na ordem fraco→novo→proficiente (desempate alfabético); dentro do conceito, fácil→difícil (proficiente puxa do mais difícil). Limita ao `sessionSize`; se o pool for menor, devolve o que houver. Determinístico.

- [ ] **Step 1: Escrever os testes de maestria que falham**

`server/tests/mastery.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { computeMastery, levelFor } from '../src/ai/mastery.js';

// helper: tentativa com timestamp incremental
let t = 0;
const a = (conceptTag, correct) => ({ conceptTag, correct, answeredAt: new Date(Date.now() + t++) });

describe('computeMastery', () => {
  it('conceito sem tentativas é new (via levelFor)', () => {
    const m = computeMastery([]);
    expect(levelFor(m, 'flexbox')).toBe('new');
  });

  it('acurácia >= 0.8 nas últimas 5 é proficient', () => {
    const m = computeMastery([
      a('flexbox', true), a('flexbox', true), a('flexbox', true),
      a('flexbox', true), a('flexbox', false),
    ]);
    expect(m.get('flexbox').level).toBe('proficient'); // 4/5 = 0.8
    expect(m.get('flexbox').count).toBe(5);
  });

  it('baixa acurácia é weak', () => {
    const m = computeMastery([a('tags', false), a('tags', false), a('tags', true)]);
    expect(m.get('tags').level).toBe('weak'); // 1/3
  });

  it('só as últimas 5 contam (erros antigos saem da janela)', () => {
    const old = [a('dom', false), a('dom', false), a('dom', false)];
    const recent = [a('dom', true), a('dom', true), a('dom', true), a('dom', true), a('dom', true)];
    const m = computeMastery([...old, ...recent]);
    expect(m.get('dom').level).toBe('proficient'); // janela = 5 mais recentes (todas certas)
    expect(m.get('dom').count).toBe(5);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/ai/mastery.js` não existe.

- [ ] **Step 3: Implementar `mastery.js`**

`server/src/ai/mastery.js`:
```js
// Maestria por conceito a partir das tentativas. Puro (sem I/O).
const WINDOW = 5;
const PROFICIENT = 0.8;

// attempts: [{ conceptTag, correct, answeredAt }]
export function computeMastery(attempts) {
  const sorted = [...attempts].sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt));
  const byConcept = new Map();
  for (const at of sorted) {
    const list = byConcept.get(at.conceptTag) ?? [];
    if (list.length < WINDOW) list.push(at);
    byConcept.set(at.conceptTag, list);
  }
  const mastery = new Map();
  for (const [concept, list] of byConcept) {
    const count = list.length;
    const correct = list.filter((x) => x.correct).length;
    const accuracy = count ? correct / count : 0;
    const level = count === 0 ? 'new' : accuracy >= PROFICIENT ? 'proficient' : 'weak';
    mastery.set(concept, { level, accuracy, count });
  }
  return mastery;
}

export function levelFor(mastery, concept) {
  return mastery.get(concept)?.level ?? 'new';
}
```

- [ ] **Step 4: Escrever os testes do seletor que falham**

`server/tests/selector.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { sessionSize, buildSession } from '../src/ai/selector.js';

// pool helper: id estável, conceito, dificuldade
let id = 1;
const ex = (conceptTag, difficulty) => ({ id: id++, conceptTag, difficulty });

// maestria fake como Map de níveis
const mastery = (entries) => new Map(entries.map(([c, level]) => [c, { level }]));

describe('sessionSize', () => {
  it('base 3 sem conceito fraco', () => {
    expect(sessionSize(mastery([['flexbox', 'new']]), ['flexbox'])).toBe(3);
  });
  it('+2 por conceito fraco, teto 8', () => {
    const m = mastery([['a', 'weak'], ['b', 'weak'], ['c', 'weak']]);
    expect(sessionSize(m, ['a', 'b', 'c'])).toBe(8); // 3 + 2*3 = 9 -> teto 8
    expect(sessionSize(mastery([['a', 'weak']]), ['a', 'b'])).toBe(5); // só 'a' fraco
  });
});

describe('buildSession', () => {
  it('respeita o tamanho e prioriza conceito fraco, fácil->difícil', () => {
    const concepts = ['flexbox', 'layout'];
    const pool = [
      ex('flexbox', 1), ex('flexbox', 2), ex('flexbox', 3),
      ex('layout', 1), ex('layout', 2), ex('layout', 3),
    ];
    const m = mastery([['flexbox', 'weak'], ['layout', 'new']]);
    const session = buildSession(m, concepts, pool);
    expect(session.length).toBe(5); // 3 + 2 (um fraco)
    // o primeiro item é do conceito fraco (flexbox) e o mais fácil disponível
    expect(session[0].conceptTag).toBe('flexbox');
    expect(session[0].difficulty).toBe(1);
    // não repete o mesmo exercício
    const ids = session.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('proficiente puxa do mais difícil', () => {
    const pool = [ex('css', 1), ex('css', 2), ex('css', 3)];
    const m = mastery([['css', 'proficient']]);
    const session = buildSession(m, ['css'], pool);
    expect(session[0].difficulty).toBe(3);
  });

  it('devolve o que houver quando o pool é menor que o tamanho', () => {
    const pool = [ex('x', 1)];
    const session = buildSession(mastery([['x', 'weak']]), ['x'], pool);
    expect(session.length).toBe(1);
  });
});
```

- [ ] **Step 5: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/ai/selector.js` não existe.

- [ ] **Step 6: Implementar `selector.js`**

`server/src/ai/selector.js`:
```js
// Montagem adaptativa da sessão. Puro (sem I/O).
const BASE = 3;
const PER_WEAK = 2;
const CAP = 8;
const LEVEL_RANK = { weak: 0, new: 1, proficient: 2 };

function levelOf(mastery, concept) {
  return mastery.get(concept)?.level ?? 'new';
}

export function sessionSize(mastery, concepts) {
  const weak = concepts.filter((c) => levelOf(mastery, c) === 'weak').length;
  return Math.min(CAP, BASE + PER_WEAK * weak);
}

// pool: exercícios candidatos (dos conceitos da aula). Retorna a sessão ordenada.
export function buildSession(mastery, concepts, pool) {
  const size = sessionSize(mastery, concepts);

  // Agrupa o pool por conceito, ordenado por dificuldade asc (id como desempate determinístico).
  const byConcept = new Map();
  for (const c of concepts) byConcept.set(c, []);
  for (const ex of pool) {
    if (!byConcept.has(ex.conceptTag)) byConcept.set(ex.conceptTag, []);
    byConcept.get(ex.conceptTag).push(ex);
  }
  for (const list of byConcept.values()) {
    list.sort((a, b) => a.difficulty - b.difficulty || a.id - b.id);
  }

  // Conceitos ordenados por prioridade (fraco→novo→proficiente), desempate alfabético.
  const ordered = [...byConcept.keys()].sort((a, b) => {
    const r = LEVEL_RANK[levelOf(mastery, a)] - LEVEL_RANK[levelOf(mastery, b)];
    return r !== 0 ? r : a.localeCompare(b);
  });

  // Cursor por conceito: proficiente começa do mais difícil; demais do mais fácil.
  const cursor = new Map();
  for (const c of ordered) {
    const list = byConcept.get(c);
    cursor.set(c, levelOf(mastery, c) === 'proficient' ? list.length - 1 : 0);
  }

  const session = [];
  let progressed = true;
  while (session.length < size && progressed) {
    progressed = false;
    for (const c of ordered) {
      if (session.length >= size) break;
      const list = byConcept.get(c);
      const i = cursor.get(c);
      if (i >= 0 && i < list.length) {
        session.push(list[i]);
        cursor.set(c, levelOf(mastery, c) === 'proficient' ? i - 1 : i + 1);
        progressed = true;
      }
    }
  }
  return session;
}
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `mastery.test.js` (4) + `selector.test.js` (5) verdes.

- [ ] **Step 8: Commit**

```bash
git add server/src/ai/mastery.js server/src/ai/selector.js server/tests/mastery.test.js server/tests/selector.test.js
git commit -m "feat(server): maestria por conceito + seletor adaptativo (puros)"
```

---

### Task 4: Banco embutido de exercícios + semeadura idempotente

O conteúdo dos exercícios em `content/exercises.js`, cobrindo **todos os 18 conceitos** das aulas Front-end em dificuldades variadas e tipos variados, semeado idempotentemente junto do conteúdo (Task 4 estende `seedContent`). Um teste de **cobertura** garante que cada conceito de cada aula tem material suficiente para o seletor montar sessões reais.

**Files:**
- Create: `server/src/content/exercises.js`
- Modify: `server/src/content/seed.js` (chamar `seedExercises(prisma)` ao final de `seedContent`)
- Test: `server/tests/exercise.seed.test.js`

**Interfaces:**
- Consumes: o client `prisma`; o conteúdo da Fase 3 (aulas por `conceptTags`).
- Produces:
  - `EXERCISES` — export nomeado de `server/src/content/exercises.js`: array de `{ conceptTag, type, prompt, options, answer, difficulty }` (objetos JS; `options`/`answer` ainda **não** serializados). Cobre os 18 conceitos.
  - `seedExercises(prisma): Promise<void>` — idempotente. Para cada conceito, encontra a aula dona (a aula cujo `conceptTags` contém o conceito) e **substitui** os exercícios `source:'bank'` daquele conceito naquela aula (`deleteMany` + `create`), preservando exercícios `source:'ai'` (gerados) e nunca tocando `Attempt`.
  - `seedContent(prisma)` passa a chamar `seedExercises(prisma)` ao final.

- [ ] **Step 1: Escrever o teste de cobertura que falha**

`server/tests/exercise.seed.test.js`:
```js
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/content/exercises.js` não existe; `prisma.exercise.count()` = 0 (seed ainda não cria exercícios).

- [ ] **Step 3: Criar o banco de exercícios + a função idempotente**

`server/src/content/exercises.js`. Comece com o cabeçalho, a função `seedExercises` e o **padrão completo do HTML** abaixo (já cobre `html-basico`, `tags`, `elementos`, `estrutura-documento`, `ancoras`, `imagens`). **Depois replique o mesmo padrão** para os conceitos de CSS (`seletores`, `especificidade`, `box-model`, `espacamento`, `flexbox`, `layout`) e JS (`variaveis`, `tipos`, `funcoes`, `escopo`, `dom`, `eventos`), de modo que **cada conceito tenha ≥2 exercícios, ≥2 dificuldades e ≥2 tipos** — é exatamente o que o teste de cobertura (Step 1) exige. Use os 4 tipos com a codificação das Global Constraints (MC: `answer` = índice; fill-blank/predict-output: `answer` = string; order-lines: `options` = linhas apresentadas, `answer` = índices na ordem correta).

```js
// Banco embutido de exercícios (Fase 4). Etiquetados por conceito + dificuldade (1-3).
// Codificação por tipo (ver docs/superpowers/plans .../Global Constraints):
//   multiple-choice → options: string[]; answer: índice correto (number)
//   fill-blank      → options: [];        answer: string esperada
//   predict-output  → options: [];        answer: saída esperada (string)
//   order-lines     → options: linhas na ordem apresentada; answer: índices na ordem correta
// conceptTag deve bater EXATO com os conceptTags das aulas (content/seed.js).

export const EXERCISES = [
  // ===== HTML / html-basico =====
  { conceptTag: 'html-basico', type: 'multiple-choice', difficulty: 1,
    prompt: 'O que significa a sigla HTML?',
    options: ['HyperText Markup Language', 'High Tech Modern Language', 'Hyperlink Text Mode'],
    answer: 0 },
  { conceptTag: 'html-basico', type: 'fill-blank', difficulty: 2,
    prompt: 'Complete: a tag que envolve todo o conteúdo visível da página é <____>.',
    options: [], answer: 'body' },
  { conceptTag: 'html-basico', type: 'multiple-choice', difficulty: 2,
    prompt: 'Onde ficam os metadados (título, idioma) de uma página?',
    options: ['<body>', '<head>', '<footer>'], answer: 1 },
  // ===== HTML / tags =====
  { conceptTag: 'tags', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual tag cria um link?',
    options: ['<p>', '<a>', '<img>'], answer: 1 },
  { conceptTag: 'tags', type: 'fill-blank', difficulty: 1,
    prompt: 'Complete a tag de parágrafo: <__>Texto</p>',
    options: [], answer: 'p' },
  { conceptTag: 'tags', type: 'order-lines', difficulty: 3,
    prompt: 'Ordene para formar uma lista não-ordenada com um item.',
    options: ['</ul>', '<ul>', '<li>Item</li>'], answer: [1, 2, 0] },
  // ===== HTML / elementos =====
  { conceptTag: 'elementos', type: 'multiple-choice', difficulty: 1,
    prompt: 'Um elemento HTML normalmente tem:',
    options: ['só uma tag de abertura', 'abertura, conteúdo e fechamento', 'apenas texto'],
    answer: 1 },
  { conceptTag: 'elementos', type: 'fill-blank', difficulty: 2,
    prompt: 'Complete o subtítulo de nível 2: <h2>Título</__>',
    options: [], answer: 'h2' },
  // ===== HTML / estrutura-documento =====
  { conceptTag: 'estrutura-documento', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual declaração inicia um documento HTML5?',
    options: ['<html5>', '<!DOCTYPE html>', '<doctype>'], answer: 1 },
  { conceptTag: 'estrutura-documento', type: 'order-lines', difficulty: 2,
    prompt: 'Ordene a estrutura mínima de uma página.',
    options: ['<body></body>', '<!DOCTYPE html>', '<head></head>'], answer: [1, 2, 0] },
  // ===== HTML / ancoras =====
  { conceptTag: 'ancoras', type: 'fill-blank', difficulty: 1,
    prompt: 'Qual atributo define o destino de um link <a>? (só o nome)',
    options: [], answer: 'href' },
  { conceptTag: 'ancoras', type: 'multiple-choice', difficulty: 2,
    prompt: 'Como abrir um link em nova aba?',
    options: ['target="_blank"', 'newtab="true"', 'open="new"'], answer: 0 },
  // ===== HTML / imagens =====
  { conceptTag: 'imagens', type: 'fill-blank', difficulty: 1,
    prompt: 'Qual atributo descreve a imagem para acessibilidade? (só o nome)',
    options: [], answer: 'alt' },
  { conceptTag: 'imagens', type: 'multiple-choice', difficulty: 2,
    prompt: 'Qual atributo aponta o arquivo da imagem?',
    options: ['href', 'src', 'link'], answer: 1 },

  // ===== CSS e JavaScript: replique o MESMO padrão acima =====
  // Para CADA conceito a seguir, crie >=2 exercícios com >=2 dificuldades e >=2 tipos
  // (o teste de cobertura falha enquanto faltar):
  //   CSS: seletores, especificidade, box-model, espacamento, flexbox, layout
  //   JS : variaveis, tipos, funcoes, escopo, dom, eventos
  // Use predict-output para JS (ex.: console.log(...) -> saída) e order-lines onde fizer sentido.
];

export async function seedExercises(prisma) {
  // Mapa conceito -> aula dona (a 1ª aula cujo conceptTags contém o conceito).
  const lessons = await prisma.lesson.findMany({ select: { id: true, conceptTags: true } });
  const ownerByConcept = new Map();
  for (const l of lessons) {
    for (const c of JSON.parse(l.conceptTags)) {
      if (!ownerByConcept.has(c)) ownerByConcept.set(c, l.id);
    }
  }
  // Agrupa o banco por conceito.
  const byConcept = new Map();
  for (const e of EXERCISES) {
    const list = byConcept.get(e.conceptTag) ?? [];
    list.push(e);
    byConcept.set(e.conceptTag, list);
  }
  for (const [concept, list] of byConcept) {
    const lessonId = ownerByConcept.get(concept);
    if (!lessonId) continue; // conceito sem aula dona: ignora (não deve acontecer)
    // Substitui apenas os exercícios do BANCO desse conceito (preserva os gerados por IA e os Attempt).
    await prisma.exercise.deleteMany({ where: { lessonId, conceptTag: concept, source: 'bank' } });
    for (const e of list) {
      await prisma.exercise.create({
        data: {
          lessonId,
          type: e.type,
          prompt: e.prompt,
          options: JSON.stringify(e.options),
          answer: JSON.stringify(e.answer),
          difficulty: e.difficulty,
          conceptTag: e.conceptTag,
          source: 'bank',
        },
      });
    }
  }
}
```

- [ ] **Step 4: Ligar `seedExercises` ao `seedContent`**

Em `server/src/content/seed.js`, importar e chamar ao final de `seedContent`:
```js
import { seedExercises } from './exercises.js';
```
E na última linha de `seedContent(prisma)`, **após** o loop de roadmaps/cursos/aulas:
```js
  await seedExercises(prisma);
}
```
(Assim `prisma db seed`, o `npm run seed` e o `global-setup` passam a semear os exercícios no mesmo movimento.)

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `exercise.seed.test.js` (5) verde **apenas depois** de o banco cobrir todos os conceitos (CSS+JS preenchidos). Se a cobertura falhar, o erro aponta o conceito faltante (`falta cobrir <concept>` / `dificuldades de <concept>` / `tipos de <concept>`). Demais suítes seguem verdes.

- [ ] **Step 6: Smoke do seed no dev.db**

Run:
```bash
cd server && npm run seed
```
Expected: roda sem erro; rodar duas vezes não duplica (idempotente).

- [ ] **Step 7: Commit**

```bash
git add server/src/content/exercises.js server/src/content/seed.js server/tests/exercise.seed.test.js
git commit -m "feat(server): banco embutido de exercícios + semeadura idempotente"
```

---

### Task 5: Camada de dados/sessão + rotas (sessão · tentativa · conclusão por limiar)

A orquestração que liga banco→maestria→seletor e expõe as rotas. `bank.js` faz as consultas; `session.js` monta a sessão (sem `answer`), grava a 1ª tentativa por `sessionToken`, e conclui a aula **por limiar de 80%**. A rota de conclusão da Fase 3 é **substituída** pela conclusão por sessão; `completeLesson` sai de `content/service.js`.

**Files:**
- Create: `server/src/ai/bank.js`
- Create: `server/src/ai/session.js`
- Create: `server/src/routes/exercises.js`
- Modify: `server/src/content/service.js` (remover `completeLesson`; manter as leituras)
- Modify: `server/src/routes/content.js` (adicionar `GET /lessons/:id/session`; trocar o handler de `POST /lessons/:id/complete` para usar `completeSession`)
- Modify: `server/src/app.js` (montar `exerciseRouter` em `/api`)
- Modify: `server/tests/content.service.test.js` (remover os testes de `completeLesson`)
- Modify: `server/tests/content.routes.test.js` (reescrever o bloco de conclusão para o fluxo de sessão)
- Test: `server/tests/session.engine.test.js`
- Test: `server/tests/exercise.routes.test.js`

**Interfaces:**
- Consumes: `prisma`; `grade` (Task 2); `computeMastery` (Task 3); `buildSession` (Task 3); `getLesson` (`content/service.js`); `maybeGenerate` (Task 6 — **importado já nesta task como no-op temporário**, ver Step 5).
- Produces:
  - `server/src/ai/bank.js`:
    - `poolForConcepts(concepts): Promise<Exercise[]>` — todos os `Exercise` cujo `conceptTag ∈ concepts` (vem com `answer`; só usado server-side).
    - `attemptsForUser(userId): Promise<[{ conceptTag, correct, answeredAt }]>` — tentativas do usuário enriquecidas com o `conceptTag` do exercício (para a maestria).
  - `server/src/ai/session.js`:
    - `buildLessonSession(userId, lessonId): Promise<{ ok, sessionToken, lessonTitle, courseSlug, exercises } | { error:'not-found'|'locked' }>` — `exercises` é a lista **sanitizada** (`{ id, type, prompt, options(parsed), difficulty, conceptTag }`, **sem `answer`**).
    - `gradeAttempt(userId, exerciseId, sessionToken, submitted): Promise<{ correct, solution } | { error:'not-found' }>` — grava `Attempt` **só na 1ª vez** do exercício sob aquele `sessionToken`; devolve a correção e o `solution` (answer parseado) para feedback.
    - `completeSession(userId, lessonId, sessionToken): Promise<{ ok:true, completed, score, nextLessonId?, courseCompleted? } | { error:'not-found'|'locked' }>` — calcula acurácia de 1ª tentativa sob o token; **≥80%** ⇒ upsert `Progress(completed, score)` + devolve próxima aula/curso; **<80%** ⇒ `{ ok:true, completed:false, score }`. **Não** mexe em XP/pontos.
  - `server/src/routes/exercises.js`: router default, montado em `/api` atrás de `requireAuth`, com `POST /exercises/:id/attempt` (`verifyCsrf`).

- [ ] **Step 1: Escrever os testes do motor de sessão que falham**

`server/tests/session.engine.test.js`:
```js
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';
import { buildLessonSession, gradeAttempt, completeSession } from '../src/ai/session.js';

const email = `eng-${randomUUID()}@neurocode.dev`;
let userId;
let lesson1Id;

async function htmlLesson1() {
  const course = await prisma.course.findUnique({
    where: { slug: 'html' },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });
  return course.lessons[0].id;
}

beforeAll(async () => {
  const u = await prisma.user.create({ data: { name: 'Eng', email, passwordHash: 'x' } });
  userId = u.id;
  lesson1Id = await htmlLesson1();
});

describe('buildLessonSession', () => {
  it('monta a sessão sem expor answer', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    expect(s.ok).toBe(true);
    expect(typeof s.sessionToken).toBe('string');
    expect(s.exercises.length).toBeGreaterThanOrEqual(1);
    for (const ex of s.exercises) {
      expect(ex).not.toHaveProperty('answer');
      expect(ex).toHaveProperty('id');
      expect(Array.isArray(ex.options)).toBe(true);
    }
  });

  it('recusa aula bloqueada', async () => {
    const cssCourse = await prisma.course.findUnique({
      where: { slug: 'css' }, include: { lessons: { orderBy: { order: 'asc' } } },
    });
    const res = await buildLessonSession(userId, cssCourse.lessons[0].id);
    expect(res).toEqual({ error: 'locked' });
  });
});

describe('gradeAttempt — 1ª tentativa por token', () => {
  it('grava só a primeira tentativa do exercício sob o token', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    const token = s.sessionToken;
    const exId = s.exercises[0].id;
    const real = await prisma.exercise.findUnique({ where: { id: exId } });
    const right = JSON.parse(real.answer);

    const first = await gradeAttempt(userId, exId, token, right);
    expect(first.correct).toBe(true);
    expect(first.solution).toEqual(right);

    // Re-tentativa sob o MESMO token não cria novo Attempt:
    await gradeAttempt(userId, exId, token, right);
    const count = await prisma.attempt.count({ where: { userId, exerciseId: exId, sessionToken: token } });
    expect(count).toBe(1);
  });

  it('devolve not-found para exercício inexistente', async () => {
    expect(await gradeAttempt(userId, 99999, 'tok', 0)).toEqual({ error: 'not-found' });
  });
});

describe('completeSession — limiar de 80%', () => {
  it('<80% não conclui; >=80% conclui e libera a próxima', async () => {
    // Sessão A: responde tudo ERRADO -> não conclui.
    const sA = await buildLessonSession(userId, lesson1Id);
    for (const ex of sA.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      const wrong = wrongAnswerFor(real);
      await gradeAttempt(userId, ex.id, sA.sessionToken, wrong);
    }
    const failed = await completeSession(userId, lesson1Id, sA.sessionToken);
    expect(failed.completed).toBe(false);
    expect(failed.score).toBeLessThan(80);
    const noProgress = await prisma.progress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson1Id } },
    });
    expect(noProgress).toBeNull();

    // Sessão B: responde tudo CERTO -> conclui (100%).
    const sB = await buildLessonSession(userId, lesson1Id);
    for (const ex of sB.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      await gradeAttempt(userId, ex.id, sB.sessionToken, JSON.parse(real.answer));
    }
    const passed = await completeSession(userId, lesson1Id, sB.sessionToken);
    expect(passed.completed).toBe(true);
    expect(passed.score).toBeGreaterThanOrEqual(80);
    expect(passed.nextLessonId).toBeTruthy();
    const progress = await prisma.progress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson1Id } },
    });
    expect(progress.status).toBe('completed');
  });
});

// Resposta sabidamente errada para qualquer tipo.
function wrongAnswerFor(real) {
  const ans = JSON.parse(real.answer);
  if (real.type === 'multiple-choice') return Number(ans) === 0 ? 1 : 0;
  if (real.type === 'order-lines') return [...ans].reverse().concat([999]);
  return `__definitivamente_errado__${ans}`;
}

afterAll(async () => {
  await prisma.attempt.deleteMany({ where: { userId } });
  await prisma.progress.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});
```
> Nota: `wrongAnswerFor` para `order-lines` inverte e adiciona um item para garantir comprimento/ordem diferentes (sempre errado, mesmo em sessões de 1 item).

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/ai/session.js` (e `bank.js`) não existem.

- [ ] **Step 3: Implementar `bank.js`**

`server/src/ai/bank.js`:
```js
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
```

- [ ] **Step 4: Implementar `session.js`**

`server/src/ai/session.js`:
```js
import { randomUUID } from 'node:crypto';
import prisma from '../db/client.js';
import { grade } from './grade.js';
import { computeMastery } from './mastery.js';
import { buildSession } from './selector.js';
import { poolForConcepts, attemptsForUser } from './bank.js';
import { getLesson } from '../content/service.js';
import { maybeGenerate } from './claudeClient.js';

const PASS_THRESHOLD = 80;

// Monta a sessão adaptativa de uma aula (sem expor `answer`).
export async function buildLessonSession(userId, lessonId) {
  const view = await getLesson(lessonId, userId);
  if (!view) return { error: 'not-found' };
  if (view.status === 'locked') return { error: 'locked' };

  const concepts = view.conceptTags;
  let pool = await poolForConcepts(concepts);
  const mastery = computeMastery(await attemptsForUser(userId));
  // Gancho IA (off por padrão): tenta cobrir lacuna de conceito fraco. Sem chave: retorna o pool.
  pool = await maybeGenerate({ concepts, mastery, pool });

  const session = buildSession(mastery, concepts, pool);
  const sessionToken = randomUUID();
  const exercises = session.map((e) => ({
    id: e.id,
    type: e.type,
    prompt: e.prompt,
    options: JSON.parse(e.options),
    difficulty: e.difficulty,
    conceptTag: e.conceptTag,
  }));
  return { ok: true, sessionToken, lessonTitle: view.title, courseSlug: view.courseSlug, exercises };
}

// Corrige uma resposta. Grava Attempt só na 1ª vez do exercício sob o token.
export async function gradeAttempt(userId, exerciseId, sessionToken, submitted) {
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return { error: 'not-found' };
  const correct = grade(exercise, submitted);
  const existing = sessionToken
    ? await prisma.attempt.findFirst({ where: { userId, exerciseId, sessionToken } })
    : null;
  if (!existing) {
    await prisma.attempt.create({
      data: { userId, exerciseId, correct, sessionToken: sessionToken ?? null },
    });
  }
  return { correct, solution: JSON.parse(exercise.answer) };
}

// Conclui a aula por limiar (>=80% de acerto de 1ª tentativa sob o token).
export async function completeSession(userId, lessonId, sessionToken) {
  const view = await getLesson(lessonId, userId);
  if (!view) return { error: 'not-found' };
  if (view.status === 'locked') return { error: 'locked' };

  const attempts = await prisma.attempt.findMany({
    where: { userId, sessionToken, exercise: { lessonId } },
    select: { correct: true },
  });
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const score = total ? Math.round((correct / total) * 100) : 0;

  if (total === 0 || score < PASS_THRESHOLD) {
    return { ok: true, completed: false, score };
  }

  await prisma.progress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { status: 'completed', score, completedAt: new Date() },
    create: { userId, lessonId, status: 'completed', score },
  });

  // Próxima aula + se a matéria ficou completa (reaproveita o nextLessonId já derivado por getLesson).
  const siblings = await prisma.lesson.findMany({
    where: { course: { slug: view.courseSlug } },
    select: { id: true },
    orderBy: { order: 'asc' },
  });
  const done = await prisma.progress.findMany({
    where: { userId, lessonId: { in: siblings.map((l) => l.id) }, status: 'completed' },
    select: { lessonId: true },
  });
  const courseCompleted = siblings.length > 0 && done.length === siblings.length;
  return { ok: true, completed: true, score, nextLessonId: view.nextLessonId, courseCompleted };
}
```

- [ ] **Step 5: Remover `completeLesson` de `content/service.js` e ajustar seus testes**

Em `server/src/content/service.js`, **apagar** a função `completeLesson` inteira (do `export async function completeLesson` até o `}` final). As leituras (`listRoadmaps`/`getRoadmap`/`getCourse`/`getLesson` e os helpers `completedLessonIds`/`isCourseLocked`/`deriveCourseState`) permanecem.

Em `server/tests/content.service.test.js`, **remover** os blocos que importam/usam `completeLesson`: apague `completeLesson` da lista de imports e apague inteiro o `describe('completeLesson — destrava em sequência', ...)`. Mantenha os testes de `listRoadmaps`/`getRoadmap`/`getCourse`/`getLesson`. (O destravamento após conclusão passa a ser coberto por `session.engine.test.js`.)

- [ ] **Step 6: Adicionar `GET /lessons/:id/session` e trocar a conclusão em `content.js`**

Em `server/src/routes/content.js`, ajustar os imports do serviço de conteúdo (remover `completeLesson`) e importar do motor de sessão:
```js
import { listRoadmaps, getRoadmap, getCourse, getLesson } from '../content/service.js';
import { buildLessonSession, completeSession } from '../ai/session.js';
```
Adicionar a rota de sessão (logo após `GET /lessons/:id`):
```js
router.get('/lessons/:id/session', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido.' });
    const result = await buildLessonSession(req.user.id, id);
    if (result.error === 'not-found') return res.status(404).json({ error: 'Aula não encontrada.' });
    if (result.error === 'locked') return res.status(409).json({ error: 'Aula bloqueada. Conclua a anterior primeiro.' });
    res.json(result);
  } catch (e) {
    next(e);
  }
});
```
Substituir o handler de `POST /lessons/:id/complete` por:
```js
router.post('/lessons/:id/complete', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido.' });
    const { sessionToken } = req.body ?? {};
    if (!sessionToken) return res.status(400).json({ error: 'sessionToken é obrigatório.' });
    const result = await completeSession(req.user.id, id, sessionToken);
    if (result.error === 'not-found') return res.status(404).json({ error: 'Aula não encontrada.' });
    if (result.error === 'locked') return res.status(409).json({ error: 'Aula bloqueada. Conclua a anterior primeiro.' });
    res.json(result);
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 7: Implementar `routes/exercises.js` e montar no `app.js`**

`server/src/routes/exercises.js`:
```js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { gradeAttempt } from '../ai/session.js';

const router = Router();

router.post('/exercises/:id/attempt', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido.' });
    const { sessionToken, answer } = req.body ?? {};
    const result = await gradeAttempt(req.user.id, id, sessionToken, answer);
    if (result.error === 'not-found') return res.status(404).json({ error: 'Exercício não encontrado.' });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
```
Em `server/src/app.js`, importar e montar **antes** do `notFound`:
```js
import exerciseRouter from './routes/exercises.js';
```
```js
app.use('/api', contentRouter);
app.use('/api', exerciseRouter);
```

- [ ] **Step 8: Reescrever o bloco de conclusão em `content.routes.test.js`**

Em `server/tests/content.routes.test.js`, **substituir** o `describe('Conclusão de aula', ...)` pelo fluxo de sessão abaixo (o helper `authedAgent`/`htmlLessonIds` já existe no arquivo; mantenha-os):
```js
describe('Sessão e conclusão de aula', () => {
  it('GET /session monta sessão sem answer; conclui com 100%', async () => {
    const { agent, csrf } = await authedAgent();
    const [first] = await htmlLessonIds();

    const sess = await agent.get(`/api/lessons/${first}/session`);
    expect(sess.status).toBe(200);
    expect(Array.isArray(sess.body.exercises)).toBe(true);
    for (const ex of sess.body.exercises) expect(ex).not.toHaveProperty('answer');
    const token = sess.body.sessionToken;

    // Responde tudo certo (busca o answer real no banco — server-side, é teste).
    const prisma = (await import('../src/db/client.js')).default;
    for (const ex of sess.body.exercises) {
      const real = await prisma.exercise.findUnique({ where: { id: ex.id } });
      const att = await agent.post(`/api/exercises/${ex.id}/attempt`)
        .set('x-csrf-token', csrf)
        .send({ sessionToken: token, answer: JSON.parse(real.answer) });
      expect(att.status).toBe(200);
      expect(att.body.correct).toBe(true);
    }

    const done = await agent.post(`/api/lessons/${first}/complete`)
      .set('x-csrf-token', csrf)
      .send({ sessionToken: token });
    expect(done.status).toBe(200);
    expect(done.body.completed).toBe(true);
    expect(done.body.score).toBeGreaterThanOrEqual(80);
  });

  it('401 sem sessão em GET /session e POST /attempt', async () => {
    const ids = await htmlLessonIds();
    expect((await request(app).get(`/api/lessons/${ids[0]}/session`)).status).toBe(401);
    expect((await request(app).post(`/api/exercises/${ids[0]}/attempt`).send({})).status).toBe(401);
  });

  it('409 ao montar sessão de aula bloqueada', async () => {
    const { agent } = await authedAgent();
    const css = await agent.get('/api/courses/css');
    const lockedLessonId = css.body.course.lessons[0].id;
    const res = await agent.get(`/api/lessons/${lockedLessonId}/session`);
    expect(res.status).toBe(409);
  });
});
```
> Nota: o `afterAll` do arquivo já limpa `progress`/`user` por e-mail; acrescente a limpeza de `attempt` se ainda não houver — `await prisma.attempt.deleteMany({ where: { userId: user.id } });` antes de deletar o usuário.

- [ ] **Step 9: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `session.engine.test.js`, `content.routes.test.js` (com o novo bloco) e `content.service.test.js` (sem `completeLesson`) verdes; demais suítes verdes.

> **Importante (ordem de execução):** `ai/session.js` importa `maybeGenerate` de `./claudeClient.js`, que só é criado na Task 6. Para esta task fechar verde sozinha, **crie já um stub mínimo** `server/src/ai/claudeClient.js` com `export async function maybeGenerate({ pool }) { return pool; }` neste mesmo commit (a Task 6 substitui o conteúdo pelo cliente completo).

- [ ] **Step 10: Commit**

```bash
git add server/src/ai/bank.js server/src/ai/session.js server/src/ai/claudeClient.js server/src/routes/exercises.js server/src/app.js server/src/content/service.js server/src/routes/content.js server/tests/session.engine.test.js server/tests/exercise.routes.test.js server/tests/content.service.test.js server/tests/content.routes.test.js
git commit -m "feat(server): sessão adaptativa, tentativa e conclusão por limiar de 80%"
```
> Se `server/tests/exercise.routes.test.js` não for usado (os testes de rota foram cobertos em `content.routes.test.js`), não o crie — remova-o do `git add`.

---

### Task 6: Gancho de geração via Claude (`ai/claudeClient.js`) — atrás da flag, off por padrão

O cliente opcional que, **só com `CLAUDE_API_KEY`**, gera um exercício sob medida para uma lacuna de conceito fraco, **valida** o JSON contra o schema de `Exercise` e **cacheia** no banco (`source='ai'`). Sem chave, é no-op e o seletor cai 100% no banco. Usa o `fetch` global do Node 18+ contra a Messages API (sem `@anthropic-ai/sdk`). Testado com a flag **OFF** e com a flag **ON** + `fetch` mockado.

**Files:**
- Modify: `server/src/ai/claudeClient.js` (substitui o stub da Task 5 pelo cliente completo)
- Modify: `server/.env.example` (acrescentar `CLAUDE_API_KEY=`)
- Test: `server/tests/claudeClient.test.js`

**Interfaces:**
- Consumes: `prisma`; `process.env.CLAUDE_API_KEY`; `fetch` (global).
- Produces (exports nomeados de `server/src/ai/claudeClient.js`):
  - `aiEnabled(): boolean` — `Boolean(process.env.CLAUDE_API_KEY)`.
  - `validateExercise(obj, { concept, difficulty }): object|null` — **puro**: valida o JSON da IA; retorna o registro pronto p/ `prisma.exercise.create` (`{ type, prompt, options, answer, difficulty, conceptTag, source:'ai' }`, com `options`/`answer` já serializados) ou `null` se inválido.
  - `generateExercise({ concept, difficulty, fewShot }): Promise<object|null>` — chama a Messages API, parseia, valida; `null` em qualquer falha.
  - `maybeGenerate({ concepts, mastery, pool }): Promise<Exercise[]>` — sem chave: retorna `pool`. Com chave: para o 1º conceito **fraco** sem exercício na dificuldade alvo, gera+valida+cacheia e devolve o pool acrescido; falha de rede ⇒ devolve o pool original (degrada para o banco).

- [ ] **Step 1: Escrever os testes que falham**

`server/tests/claudeClient.test.js`:
```js
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { validateExercise, aiEnabled, maybeGenerate } from '../src/ai/claudeClient.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CLAUDE_API_KEY;
});

describe('validateExercise (puro)', () => {
  it('aceita um multiple-choice bem formado e serializa options/answer', () => {
    const rec = validateExercise(
      { type: 'multiple-choice', prompt: 'p?', options: ['a', 'b'], answer: 1, difficulty: 2 },
      { concept: 'flexbox', difficulty: 2 }
    );
    expect(rec.source).toBe('ai');
    expect(rec.conceptTag).toBe('flexbox');
    expect(JSON.parse(rec.options)).toEqual(['a', 'b']);
    expect(JSON.parse(rec.answer)).toBe(1);
  });

  it('rejeita tipo inválido, prompt vazio, options não-array e dificuldade fora de 1-3', () => {
    const base = { type: 'multiple-choice', prompt: 'p', options: [], answer: 0, difficulty: 1 };
    expect(validateExercise({ ...base, type: 'x' }, { concept: 'c', difficulty: 1 })).toBeNull();
    expect(validateExercise({ ...base, prompt: '   ' }, { concept: 'c', difficulty: 1 })).toBeNull();
    expect(validateExercise({ ...base, options: 'naoarray' }, { concept: 'c', difficulty: 1 })).toBeNull();
    expect(validateExercise({ ...base, difficulty: 9 }, { concept: 'c', difficulty: 9 })).toBeNull();
    expect(validateExercise(null, { concept: 'c', difficulty: 1 })).toBeNull();
  });
});

describe('maybeGenerate', () => {
  it('sem CLAUDE_API_KEY é no-op e devolve o pool intacto', async () => {
    expect(aiEnabled()).toBe(false);
    const pool = [{ id: 1, conceptTag: 'flexbox', difficulty: 1 }];
    const out = await maybeGenerate({ concepts: ['flexbox'], mastery: new Map([['flexbox', { level: 'weak' }]]), pool });
    expect(out).toBe(pool); // mesma referência: nada gerado
  });

  it('com chave + fetch mockado, gera e acrescenta um exercício ao pool', async () => {
    process.env.CLAUDE_API_KEY = 'test-key';
    const aiExercise = { type: 'fill-blank', prompt: 'Complete: ____', options: [], answer: 'gap', difficulty: 3 };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify(aiExercise) }] }),
    })));
    // mock do create para não depender do banco neste teste unitário:
    const prisma = (await import('../src/db/client.js')).default;
    const spy = vi.spyOn(prisma.exercise, 'create').mockResolvedValue({ id: 999, ...aiExercise, conceptTag: 'flexbox', source: 'ai', options: '[]', answer: '"gap"' });

    const pool = []; // sem dificuldade 3 para flexbox -> deve gerar
    const out = await maybeGenerate({ concepts: ['flexbox'], mastery: new Map([['flexbox', { level: 'weak' }]]), pool });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(out.length).toBe(1);
    expect(out[0].source).toBe('ai');
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — o stub atual de `claudeClient.js` não exporta `validateExercise`/`aiEnabled`/`generateExercise`.

- [ ] **Step 3: Implementar o cliente completo (substitui o stub)**

`server/src/ai/claudeClient.js`:
```js
// Gancho de geração via Claude, isolado e OFF por padrão (flag CLAUDE_API_KEY).
// Sem chave: no-op (o seletor cai 100% no banco embutido).
// Com chave: gera p/ lacuna de conceito fraco, valida e cacheia (source='ai').
// Usa o fetch global do Node 18+ contra a Messages API (sem @anthropic-ai/sdk — nenhuma dep nova).
import prisma from '../db/client.js';

const MODEL = 'claude-opus-4-8';
const TYPES = new Set(['multiple-choice', 'fill-blank', 'predict-output', 'order-lines']);

export function aiEnabled() {
  return Boolean(process.env.CLAUDE_API_KEY);
}

// Schema mínimo que a IA deve devolver (estrutura de um Exercise sem o lessonId/source).
const EXERCISE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'prompt', 'options', 'answer', 'difficulty'],
  properties: {
    type: { type: 'string', enum: [...TYPES] },
    prompt: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    answer: {}, // índice, string ou array de índices, conforme o tipo
    difficulty: { type: 'integer' },
  },
};

// Validação pura do JSON devolvido pela IA. Retorna o registro pronto p/ create, ou null.
export function validateExercise(obj, { concept, difficulty }) {
  if (!obj || typeof obj !== 'object') return null;
  if (!TYPES.has(obj.type)) return null;
  if (typeof obj.prompt !== 'string' || !obj.prompt.trim()) return null;
  if (!Array.isArray(obj.options)) return null;
  if (obj.answer === undefined || obj.answer === null) return null;
  const diff = Number(obj.difficulty) || difficulty;
  if (!Number.isInteger(diff) || diff < 1 || diff > 3) return null;
  return {
    type: obj.type,
    prompt: obj.prompt,
    options: JSON.stringify(obj.options),
    answer: JSON.stringify(obj.answer),
    difficulty: diff,
    conceptTag: concept,
    source: 'ai',
  };
}

function buildPrompt(concept, difficulty, fewShot) {
  const examples = (fewShot ?? []).slice(0, 2)
    .map((e) => JSON.stringify({ type: e.type, prompt: e.prompt, options: JSON.parse(e.options), answer: JSON.parse(e.answer), difficulty: e.difficulty }))
    .join('\n');
  return [
    `Gere UM exercício de programação para iniciantes em português.`,
    `Conceito: "${concept}". Dificuldade: ${difficulty} (1=fácil, 3=difícil).`,
    `Tipos válidos: multiple-choice (answer=índice), fill-blank (answer=string),`,
    `predict-output (answer=saída), order-lines (options=linhas, answer=índices na ordem correta).`,
    examples ? `Exemplos do banco:\n${examples}` : '',
    `Responda apenas com o JSON do exercício.`,
  ].filter(Boolean).join('\n');
}

// Chama a Messages API (raw fetch). Retorna o registro validado, ou null em qualquer falha.
export async function generateExercise({ concept, difficulty, fewShot }) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        output_config: { format: { type: 'json_schema', schema: EXERCISE_SCHEMA } },
        messages: [{ role: 'user', content: buildPrompt(concept, difficulty, fewShot) }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.find((b) => b.type === 'text')?.text ?? '';
    const parsed = JSON.parse(text);
    return validateExercise(parsed, { concept, difficulty });
  } catch {
    return null;
  }
}

// Off por padrão. Com chave: cobre a 1ª lacuna de conceito fraco (sem dificuldade alvo no pool).
export async function maybeGenerate({ concepts, mastery, pool }) {
  if (!aiEnabled()) return pool;
  const targetDifficulty = 2;
  for (const concept of concepts) {
    if ((mastery.get(concept)?.level ?? 'new') !== 'weak') continue;
    const has = pool.some((e) => e.conceptTag === concept && e.difficulty === targetDifficulty);
    if (has) continue;
    const fewShot = pool.filter((e) => e.conceptTag === concept).slice(0, 2);
    const rec = await generateExercise({ concept, difficulty: targetDifficulty, fewShot });
    if (!rec) continue;
    const lessonId = pool.find((e) => e.conceptTag === concept)?.lessonId;
    const created = await prisma.exercise.create({ data: { ...rec, lessonId: lessonId ?? null } });
    return [...pool, created];
  }
  return pool;
}
```
> Nota: o caso real exige `lessonId` (NOT NULL). Quando o pool tem ao menos um exercício do conceito, `lessonId` vem dele. O teste mockado de Step 1 não exercita esse caminho de `lessonId` (mocka `create`), então fica robusto; em produção, conceitos sempre têm exercícios de banco, garantindo `lessonId`.

- [ ] **Step 4: Acrescentar a flag ao `.env.example`**

Em `server/.env.example`, acrescentar (vazia — off por padrão):
```
# Opcional: liga a geração de exercícios via Claude. Vazio = 100% banco embutido.
CLAUDE_API_KEY=
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `claudeClient.test.js` (4) verde; demais suítes verdes (sem `CLAUDE_API_KEY` no ambiente, `maybeGenerate` é no-op e a sessão usa só o banco).

- [ ] **Step 6: Commit**

```bash
git add server/src/ai/claudeClient.js server/.env.example server/tests/claudeClient.test.js
git commit -m "feat(server): gancho de geração via Claude isolado atrás da flag (off por padrão)"
```

---

### Task 7: Frontend — sessão de exercícios na tela de Aula

A tela de Aula passa a oferecer teoria + sessão Duolingo: um `ExerciseCard` por vez (4 tipos), feedback imediato, re-enfileira erro até acertar, barra de progresso, e tela de resultado (passou/refazer + próxima). Correção 100% no servidor.

**Files:**
- Create: `web/src/components/ExerciseCard.jsx`
- Create: `web/src/components/ExerciseSession.jsx`
- Modify: `web/src/pages/Lesson.jsx` (teoria + iniciar sessão; remove o botão manual)
- Modify: `web/src/styles/roadmap.css` (estilos de exercício/sessão)
- Modify: `web/tests/Content.test.jsx` (atualizar o teste da Aula para o fluxo de sessão)

**Interfaces:**
- Consumes: `apiGet`/`apiPost` (`web/src/lib/api.js`); `LessonContent` (Fase 3); rotas `GET /lessons/:id/session`, `POST /exercises/:id/attempt`, `POST /lessons/:id/complete`.
- Produces:
  - `ExerciseCard.jsx` — `export default function ExerciseCard({ exercise, disabled, onSubmit })` — renderiza por `exercise.type`, gerencia o input local e chama `onSubmit(answer)`.
  - `ExerciseSession.jsx` — `export default function ExerciseSession({ lessonId, courseSlug, onDone })` — busca a sessão, conduz o fluxo, conclui e chama `onDone(result)`.

- [ ] **Step 1: Atualizar o teste da Aula que falha**

Em `web/tests/Content.test.jsx`, **substituir** o `describe('Tela de Aula', ...)` por um teste do fluxo de sessão. Acrescente ao `mockApi()` as rotas de sessão/tentativa/conclusão (junto das já existentes), e o novo teste:
```js
// dentro de mockApi(), antes do `return ok({});` final:
    if (url.endsWith('/api/lessons/1/session')) return ok({
      ok: true, sessionToken: 'tok', lessonTitle: 'O que é HTML', courseSlug: 'html',
      exercises: [{ id: 10, type: 'multiple-choice', prompt: 'Qual cria link?', options: ['<p>', '<a>'], difficulty: 1, conceptTag: 'tags' }],
    });
    if (url.endsWith('/api/exercises/10/attempt')) return ok({ correct: true, solution: 1 });
    if (url.endsWith('/api/lessons/1/complete')) return ok({ ok: true, completed: true, score: 100, nextLessonId: null, courseCompleted: false });
```
```js
describe('Tela de Aula — sessão de exercícios', () => {
  it('mostra a teoria, inicia a sessão e conclui com aprovação', async () => {
    renderAt('/aula/1');
    // teoria primeiro
    expect(await screen.findByText('Uma página mínima')).toBeInTheDocument();
    // inicia a sessão
    fireEvent.click(await screen.findByRole('button', { name: /começar exercícios/i }));
    // o exercício aparece
    expect(await screen.findByText('Qual cria link?')).toBeInTheDocument();
    // escolhe a alternativa correta e verifica
    fireEvent.click(await screen.findByRole('button', { name: '<a>' }));
    fireEvent.click(await screen.findByRole('button', { name: /verificar/i }));
    // feedback de acerto e avançar -> conclui -> resultado de aprovação
    fireEvent.click(await screen.findByRole('button', { name: /continuar/i }));
    expect(await screen.findByText(/aula concluída/i)).toBeInTheDocument();
    // o attempt foi enviado com CSRF (via apiPost):
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/exercises/10/attempt'),
        expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-CSRF-Token': expect.any(String) }) })
      )
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd web && npm test
```
Expected: FAIL — `Lesson.jsx` ainda mostra "Concluir aula" (não há "Começar exercícios"); `ExerciseSession`/`ExerciseCard` não existem.

- [ ] **Step 3: Implementar `ExerciseCard.jsx`**

`web/src/components/ExerciseCard.jsx`:
```jsx
import { useState } from 'react';

export default function ExerciseCard({ exercise, disabled, onSubmit }) {
  const { type, prompt, options } = exercise;
  const [choice, setChoice] = useState(null);
  const [text, setText] = useState('');
  const [order, setOrder] = useState(options ? options.map((_, i) => i) : []);

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }

  function submit() {
    if (type === 'multiple-choice') onSubmit(choice);
    else if (type === 'order-lines') onSubmit(order);
    else onSubmit(text);
  }

  const canSubmit =
    type === 'multiple-choice' ? choice !== null :
    type === 'order-lines' ? true :
    text.trim().length > 0;

  return (
    <div className="ex-card">
      <p className="ex-prompt">{prompt}</p>

      {type === 'multiple-choice' && (
        <div className="ex-options">
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`ex-option ${choice === i ? 'is-selected' : ''}`}
              disabled={disabled}
              onClick={() => setChoice(i)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {(type === 'fill-blank' || type === 'predict-output') && (
        <input
          className="ex-input"
          type="text"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          placeholder={type === 'predict-output' ? 'Digite a saída esperada' : 'Sua resposta'}
        />
      )}

      {type === 'order-lines' && (
        <ul className="ex-order">
          {order.map((optIdx, i) => (
            <li key={optIdx} className="ex-order-line">
              <code>{options[optIdx]}</code>
              <span className="ex-order-ctrls">
                <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
                <button type="button" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} aria-label="Descer">↓</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button className="btn btn-primary ex-check" disabled={disabled || !canSubmit} onClick={submit}>
        Verificar
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Implementar `ExerciseSession.jsx`**

`web/src/components/ExerciseSession.jsx`:
```jsx
import { useEffect, useState } from 'react';
import ExerciseCard from './ExerciseCard.jsx';
import { apiGet, apiPost } from '../lib/api.js';

export default function ExerciseSession({ lessonId, onDone }) {
  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);     // exercícios restantes (re-enfileira erro)
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null); // { correct, solution }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // resultado da conclusão
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    apiGet(`/lessons/${lessonId}/session`)
      .then((s) => { setSession(s); setQueue(s.exercises); })
      .catch((e) => setError(e.message));
  }, [lessonId]);

  async function answer(submitted) {
    if (busy || !queue.length) return;
    setBusy(true);
    const current = queue[0];
    try {
      const res = await apiPost(`/exercises/${current.id}/attempt`, { sessionToken: session.sessionToken, answer: submitted });
      setFeedback(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    const current = queue[0];
    const wasCorrect = feedback?.correct;
    setFeedback(null);
    // Erro: re-enfileira ao final para repetir até acertar (Duolingo). Acerto: remove.
    const rest = wasCorrect ? queue.slice(1) : [...queue.slice(1), current];
    if (wasCorrect) setDoneCount((c) => c + 1);
    if (rest.length === 0) {
      try {
        const r = await apiPost(`/lessons/${lessonId}/complete`, { sessionToken: session.sessionToken });
        setResult(r);
        onDone?.(r);
      } catch (e) {
        setError(e.message);
      }
    }
    setQueue(rest);
  }

  if (error) return <p className="rm-error">{error}</p>;
  if (!session) return <p>Carregando exercícios…</p>;

  if (result) {
    return (
      <div className="ex-result">
        {result.completed
          ? <p className="ex-pass">✓ Aula concluída — {result.score}% de acerto!</p>
          : <p className="ex-fail">Você fez {result.score}%. São necessários 80% — refaça para concluir.</p>}
        {result.completed && result.nextLessonId && (
          <a className="btn btn-primary" href={`/aula/${result.nextLessonId}`}>Próxima aula</a>
        )}
        {result.completed && !result.nextLessonId && (
          <a className="btn btn-primary" href={`/curso/${session.courseSlug}`}>Voltar à matéria</a>
        )}
        {!result.completed && (
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Refazer</button>
        )}
      </div>
    );
  }

  const total = session.exercises.length;
  const current = queue[0];
  return (
    <div className="ex-session">
      <div className="progress ex-progress"><span style={{ width: `${(doneCount / total) * 100}%` }} /></div>
      {current && (
        <ExerciseCard exercise={current} disabled={!!feedback} onSubmit={answer} />
      )}
      {feedback && (
        <div className={`ex-feedback ${feedback.correct ? 'is-ok' : 'is-bad'}`}>
          <p>{feedback.correct ? 'Correto!' : 'Ainda não. Vamos repetir esse mais tarde.'}</p>
          <button className="btn btn-primary" onClick={next}>Continuar</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Reescrever `Lesson.jsx` (teoria → iniciar sessão)**

`web/src/pages/Lesson.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import LessonContent from '../components/LessonContent.jsx';
import ExerciseSession from '../components/ExerciseSession.jsx';
import { apiGet } from '../lib/api.js';

export default function Lesson() {
  const { id } = useParams();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setLesson(null);
    setStarted(false);
    apiGet(`/lessons/${id}`)
      .then((d) => setLesson(d.lesson))
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <>
      <Header />
      <main className="container lesson-page">
        {error && <p className="rm-error">{error}</p>}
        {lesson && (
          <>
            <p className="lesson-eyebrow">{lesson.courseTitle} · Aula {lesson.order}</p>
            <h1>{lesson.title}</h1>
            {!started ? (
              <>
                <LessonContent blocks={lesson.content} />
                <button className="btn btn-primary lesson-cta" onClick={() => setStarted(true)}>
                  Começar exercícios
                </button>
              </>
            ) : (
              <ExerciseSession lessonId={Number(id)} />
            )}
          </>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 6: Estilos de exercício em `roadmap.css`**

Acrescentar ao final de `web/src/styles/roadmap.css`:
```css
/* ===== Sessão de exercícios (Fase 4) ===== */
.ex-session { margin-top: 24px; }
.ex-progress { margin-bottom: 20px; }
.ex-card { background: var(--c-card); border: 1px solid var(--c-border); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-card); }
.ex-prompt { font-size: 1.1rem; margin-bottom: 16px; }
.ex-options { display: flex; flex-direction: column; gap: 10px; }
.ex-option { text-align: left; padding: 12px 16px; border: 1px solid var(--c-border); border-radius: var(--radius); background: transparent; color: var(--c-text); cursor: pointer; }
.ex-option.is-selected { border-color: var(--c-purple); background: rgba(124, 58, 237, 0.12); }
.ex-input { width: 100%; padding: 12px 16px; border: 1px solid var(--c-border); border-radius: var(--radius); background: transparent; color: var(--c-text); font-family: inherit; }
.ex-order { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ex-order-line { display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--c-border); border-radius: var(--radius); padding: 8px 12px; }
.ex-order-ctrls button { background: transparent; border: 1px solid var(--c-border); color: var(--c-text); border-radius: 6px; margin-left: 6px; cursor: pointer; padding: 2px 8px; }
.ex-check { margin-top: 18px; }
.ex-feedback { margin-top: 16px; padding: 14px 16px; border-radius: var(--radius); }
.ex-feedback.is-ok { background: rgba(34, 197, 94, 0.14); border: 1px solid var(--c-green); }
.ex-feedback.is-bad { background: rgba(239, 68, 68, 0.12); border: 1px solid #ef4444; }
.ex-result { margin-top: 24px; display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
.ex-pass { color: var(--c-green); font-size: 1.15rem; }
.ex-fail { color: #f59e0b; font-size: 1.05rem; }
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run:
```bash
cd web && npm test
```
Expected: PASS — `Content.test.jsx` (Roadmap + nova Aula) verde, stderr limpo.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/ExerciseCard.jsx web/src/components/ExerciseSession.jsx web/src/pages/Lesson.jsx web/src/styles/roadmap.css web/tests/Content.test.jsx
git commit -m "feat(web): sessão de exercícios estilo Duolingo na tela de Aula"
```

---

### Task 8: Onboarding (semeia maestria) + saída (verificação E2E, docs, Vault)

O quiz de 3 perguntas pós-cadastro que semeia a maestria inicial, o `onboardedAt` exposto ao frontend, o redirect pós-cadastro, e o fechamento da fase: suíte verde nas duas pontas, smoke E2E do fluxo adaptativo, docs e atualização do Vault.

**Files:**
- Modify: `server/src/routes/auth.js` (`toPublicUser` inclui `onboardedAt`)
- Create: `server/src/routes/onboarding.js`
- Modify: `server/src/app.js` (montar `onboardingRouter`)
- Create: `web/src/pages/Onboarding.jsx`
- Modify: `web/src/App.jsx` (rota protegida `/onboarding`)
- Modify: `web/src/pages/Register.jsx` (redirect para `/onboarding`)
- Test: `server/tests/onboarding.routes.test.js`
- Test: `web/tests/Onboarding.test.jsx`
- Modify: `README.md` e/ou `GETTING-STARTED.md` (passo do banco de exercícios + flag opcional)

**Interfaces:**
- Consumes: `requireAuth`, `verifyCsrf`, `prisma`, `gradeAttempt` (Task 5), `getLesson`-independent.
- Produces:
  - `GET /api/onboarding` → `{ questions: [{ id, type, prompt, options, conceptTag }] }` — 3 exercícios de dificuldade 1, um por área (HTML/CSS/JS), **sem `answer`**.
  - `POST /api/onboarding` (`verifyCsrf`) → grava 1 Attempt por resposta (via `gradeAttempt` com `sessionToken: 'onboarding'`), marca `User.onboardedAt = now()`, devolve `{ ok:true }`. Idempotente (re-marca sem duplicar critério).
  - `toPublicUser(u)` passa a incluir `onboardedAt`.

- [ ] **Step 1: Escrever os testes de onboarding que falham (server)**

`server/tests/onboarding.routes.test.js`:
```js
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const password = 'Sup3rSecret';
const email = `onb-${randomUUID()}@neurocode.dev`;

async function authedAgent() {
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/csrf')).body.csrfToken;
  await agent.post('/api/auth/register').set('x-csrf-token', csrf).send({ name: 'Onb', email, password });
  return { agent, csrf };
}

describe('Onboarding', () => {
  it('novo usuário tem onboardedAt null em /me', async () => {
    const { agent } = await authedAgent();
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.onboardedAt).toBeNull();
  });

  it('GET /onboarding devolve 3 perguntas sem answer', async () => {
    const { agent } = await authedAgent();
    const res = await agent.get('/api/onboarding');
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(3);
    for (const q of res.body.questions) expect(q).not.toHaveProperty('answer');
  });

  it('POST /onboarding grava tentativas, marca onboardedAt e exige CSRF', async () => {
    const { agent, csrf } = await authedAgent();
    const q = (await agent.get('/api/onboarding')).body.questions;
    const answers = q.map((x) => ({ exerciseId: x.id, answer: 0 }));

    const noCsrf = await request(app).post('/api/onboarding').send({ answers: [] });
    expect(noCsrf.status).toBe(401); // sem sessão

    const res = await agent.post('/api/onboarding').set('x-csrf-token', csrf).send({ answers });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const me = await agent.get('/api/auth/me');
    expect(me.body.user.onboardedAt).not.toBeNull();

    const user = await prisma.user.findUnique({ where: { email } });
    const count = await prisma.attempt.count({ where: { userId: user.id } });
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.attempt.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `/api/onboarding` não existe (404 do `notFound`); `onboardedAt` ausente em `/me`.

- [ ] **Step 3: Expor `onboardedAt` em `toPublicUser`**

Em `server/src/routes/auth.js`, no objeto retornado por `toPublicUser(u)`, acrescentar a linha:
```js
    onboardedAt: u.onboardedAt,
```

- [ ] **Step 4: Implementar `routes/onboarding.js` e montar no `app.js`**

`server/src/routes/onboarding.js`:
```js
import { Router } from 'express';
import prisma from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { gradeAttempt } from '../ai/session.js';

const router = Router();

// 3 perguntas de dificuldade 1, uma por matéria do roadmap Front-end.
async function onboardingExercises() {
  const slugs = ['html', 'css', 'javascript'];
  const out = [];
  for (const slug of slugs) {
    const ex = await prisma.exercise.findFirst({
      where: { difficulty: 1, lesson: { course: { slug } } },
      orderBy: { id: 'asc' },
    });
    if (ex) out.push(ex);
  }
  return out;
}

router.get('/onboarding', requireAuth, async (req, res, next) => {
  try {
    const exercises = await onboardingExercises();
    const questions = exercises.map((e) => ({
      id: e.id, type: e.type, prompt: e.prompt, options: JSON.parse(e.options), conceptTag: e.conceptTag,
    }));
    res.json({ questions });
  } catch (e) {
    next(e);
  }
});

router.post('/onboarding', requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const { answers } = req.body ?? {};
    if (Array.isArray(answers)) {
      for (const a of answers) {
        const id = Number(a?.exerciseId);
        if (Number.isInteger(id)) await gradeAttempt(req.user.id, id, 'onboarding', a.answer);
      }
    }
    await prisma.user.update({ where: { id: req.user.id }, data: { onboardedAt: new Date() } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
```
Em `server/src/app.js`, importar e montar antes do `notFound`:
```js
import onboardingRouter from './routes/onboarding.js';
```
```js
app.use('/api', exerciseRouter);
app.use('/api', onboardingRouter);
```
> Nota: `gradeAttempt` com `sessionToken: 'onboarding'` grava só a 1ª tentativa por exercício sob esse token, tornando o POST idempotente em relação às Attempts de onboarding.

- [ ] **Step 5: Rodar e confirmar que passa (server)**

Run:
```bash
cd server && npm test
```
Expected: PASS — `onboarding.routes.test.js` (3) verde; demais suítes verdes.

- [ ] **Step 6: Escrever o teste de Onboarding que falha (web)**

`web/tests/Onboarding.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const user = { id: 1, name: 'Rangel', email: 'r@neuro.dev', plan: 'free', xp: 0, level: 1, neuroPoints: 0, streak: 0, onboardedAt: null };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn((url, opts = {}) => {
  const ok = (b) => Promise.resolve({ ok: true, json: () => Promise.resolve(b) });
  if (url.endsWith('/api/auth/me')) return ok({ user });
  if (url.endsWith('/api/csrf')) return ok({ csrfToken: 't' });
  if (url.endsWith('/api/onboarding') && opts.method === 'POST') return ok({ ok: true });
  if (url.endsWith('/api/onboarding')) return ok({ questions: [
    { id: 1, type: 'multiple-choice', prompt: 'P1?', options: ['a', 'b'], conceptTag: 'tags' },
    { id: 2, type: 'multiple-choice', prompt: 'P2?', options: ['a', 'b'], conceptTag: 'seletores' },
    { id: 3, type: 'multiple-choice', prompt: 'P3?', options: ['a', 'b'], conceptTag: 'variaveis' },
  ] });
  return ok({});
})));
afterEach(() => vi.unstubAllGlobals());

describe('Onboarding', () => {
  it('mostra a 1ª pergunta e envia as respostas', async () => {
    renderAt('/onboarding');
    expect(await screen.findByText('P1?')).toBeInTheDocument();
    // responde as 3 (escolhe a 1ª alternativa e avança)
    for (let i = 0; i < 3; i++) {
      fireEvent.click(await screen.findByRole('button', { name: 'a' }));
      fireEvent.click(await screen.findByRole('button', { name: /próxima|concluir/i }));
    }
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/onboarding'),
        expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-CSRF-Token': expect.any(String) }) })
      )
    );
  });
});
```

- [ ] **Step 7: Rodar e confirmar que falha**

Run:
```bash
cd web && npm test
```
Expected: FAIL — `Onboarding.jsx` e a rota `/onboarding` não existem.

- [ ] **Step 8: Implementar `Onboarding.jsx`, a rota e o redirect**

`web/src/pages/Onboarding.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiGet, apiPost } from '../lib/api.js';

export default function Onboarding() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [choice, setChoice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/onboarding').then((d) => setQuestions(d.questions)).catch((e) => setError(e.message));
  }, []);

  async function advance() {
    const q = questions[idx];
    const next = [...answers, { exerciseId: q.id, answer: choice ?? 0 }];
    setChoice(null);
    if (idx + 1 < questions.length) {
      setAnswers(next);
      setIdx(idx + 1);
    } else {
      try {
        await apiPost('/onboarding', { answers: next });
        await refresh();
        navigate('/dashboard');
      } catch (e) {
        setError(e.message);
      }
    }
  }

  const q = questions[idx];
  const last = idx + 1 === questions.length;

  return (
    <>
      <Header />
      <main className="container onboarding-page">
        <h1>Vamos calibrar seu aprendizado</h1>
        <p className="onboarding-sub">3 perguntas rápidas para personalizar seus exercícios.</p>
        {error && <p className="rm-error">{error}</p>}
        {q && (
          <div className="ex-card">
            <p className="ex-prompt">{q.prompt}</p>
            <div className="ex-options">
              {q.options.map((opt, i) => (
                <button key={i} type="button"
                  className={`ex-option ${choice === i ? 'is-selected' : ''}`}
                  onClick={() => setChoice(i)}>
                  {opt}
                </button>
              ))}
            </div>
            <button className="btn btn-primary ex-check" disabled={choice === null} onClick={advance}>
              {last ? 'Concluir' : 'Próxima'}
            </button>
          </div>
        )}
      </main>
    </>
  );
}
```
Em `web/src/App.jsx`, importar e adicionar a rota dentro de `<ProtectedRoute>`:
```jsx
import Onboarding from './pages/Onboarding.jsx';
```
```jsx
        <Route path="/onboarding" element={<Onboarding />} />
```
Em `web/src/pages/Register.jsx`, trocar o destino pós-cadastro (a função `register` devolve o `user`):
```jsx
      const u = await register(name, email, password);
      navigate(u?.onboardedAt ? '/dashboard' : '/onboarding');
```

- [ ] **Step 9: Rodar e confirmar que passa (web)**

Run:
```bash
cd web && npm test
```
Expected: PASS — `Onboarding.test.jsx` verde; demais suítes web verdes.

- [ ] **Step 10: Verificação completa nas duas pontas**

Run:
```bash
npm test
```
Expected: PASS — server (todas as suítes, incl. `grade`/`mastery`/`selector`/`exercise.seed`/`session.engine`/`claudeClient`/`onboarding` + as da Fase 3 ajustadas) **e** web (incl. `Content` e `Onboarding`) verdes, stderr limpo.

- [ ] **Step 11: Smoke E2E ao vivo (curl) — fluxo adaptativo offline**

Em um terminal: `cd server && npm run dev`. Em outro, exercitar o fluxo (sem `CLAUDE_API_KEY` → 100% banco):
```bash
# 1) csrf + registrar (guarda cookies)
curl -s -c /tmp/nc.txt http://localhost:4000/api/csrf
CSRF=$(curl -s -b /tmp/nc.txt -c /tmp/nc.txt http://localhost:4000/api/csrf | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
curl -s -b /tmp/nc.txt -c /tmp/nc.txt -X POST http://localhost:4000/api/auth/register \
  -H "content-type: application/json" -H "x-csrf-token: $CSRF" \
  -d '{"name":"Smoke","email":"smoke-fase4@neurocode.dev","password":"Sup3rSecret"}'
# 2) onboarding
curl -s -b /tmp/nc.txt http://localhost:4000/api/onboarding
# 3) sessão da 1ª aula de HTML (descobrir o id via /courses/html), montar e checar que NÃO há answer
curl -s -b /tmp/nc.txt http://localhost:4000/api/courses/html
```
Expected: `/onboarding` devolve 3 perguntas; `/courses/html` lista as aulas; `GET /lessons/<id>/session` devolve `sessionToken` + `exercises` **sem** `answer`. (Conclusão por limiar já é coberta pelos testes automatizados.)

- [ ] **Step 12: Atualizar docs do repo (seed + flag opcional)**

Em `README.md` (e/ou `GETTING-STARTED.md`), na seção de seed/rodar, acrescentar uma linha:
> O `npm run seed` agora também popula o **banco de exercícios** (Fase 4). Para ligar a geração ao vivo via Claude, copie `server/.env.example` → `server/.env` e preencha `CLAUDE_API_KEY` (opcional — sem a chave o app roda 100% com o banco embutido).

- [ ] **Step 13: Commit do código + docs**

```bash
git add server/src/routes/auth.js server/src/routes/onboarding.js server/src/app.js web/src/pages/Onboarding.jsx web/src/App.jsx web/src/pages/Register.jsx server/tests/onboarding.routes.test.js web/tests/Onboarding.test.jsx README.md GETTING-STARTED.md
git commit -m "feat: onboarding que semeia maestria + saída da Fase 4 (verificação, docs)"
```

- [ ] **Step 14: Atualizar o Vault (convenção do projeto)**

Convenção standing (Rangel, 2026-06-18): toda mudança do NeuroCode atualiza o Vault no mesmo movimento. Editar (no Vault Obsidian):
- `C:\Users\Admin\Documents\Neuro\03 Projetos\NeuroCode\02 Desenvolvimento\(C) Plano de Implementação — Fatia Vertical.md` — marcar a **Fase 4 como ✅ concluída** na tabela de fases, acrescentar o bloco "Estado da execução — Fase 4" (tasks/commits/resultado), e atualizar "Próximo passo" para a **Fase 5 (Gamificação)**.
- `C:\Users\Admin\Documents\Neuro\03 Projetos\NeuroCode\CLAUDE.md` — atualizar o bloco **Current Status** (Fase 4 feita: modelos `Exercise`/`Attempt`, banco embutido, motor adaptativo puro, sessão Duolingo com limiar 80%, onboarding, gancho Claude off por padrão; próximo = Fase 5).

Não há commit de código aqui (o Vault é um repositório separado); registrar a edição conforme a convenção.

## Convenção: atualização do Vault

> **Standing:** toda vez que planejar, atualizar, escrever ou mudar algo do NeuroCode, atualizo o Vault no mesmo movimento (índice + design/conceito + status). Pedido de Rangel em 2026-06-18.

## Self-review (preenchido na escrita do plano)

- **Cobertura do escopo (design §Seção 2 / decisões de Rangel):** modelos `Exercise`/`Attempt` (T1) · banco embutido etiquetado por conceito+dificuldade (T4) · maestria + seletor puros (T3) · contagem adaptativa base 3/+2/teto 8 (T3) · sessão Duolingo na Aula (T7) · conclusão por limiar ≥80% (T5) · onboarding que semeia maestria (T8) · gancho Claude isolado off por padrão (T6) · zero gamificação (T5: conclusão só grava `Progress`+`score`). ✔
- **Consistência de tipos/nomes:** `grade(exercise, submitted)` (T2) usado por `gradeAttempt` (T5) e onboarding (T8); `computeMastery`/`buildSession` (T3) usados por `buildLessonSession` (T5); `maybeGenerate({concepts,mastery,pool})` (T6) chamado em `buildLessonSession` (T5, com stub criado em T5 Step 9); `sessionToken` em `Attempt` (T1) usado por `gradeAttempt`/`completeSession` (T5); `onboardedAt` (T1) exposto por `toPublicUser` (T8) e usado no redirect (T8). ✔
- **Sem placeholders de código:** todo passo que altera código mostra o código. Exceção deliberada e **verificável por teste**: o conteúdo CSS/JS do banco de exercícios (T4) é preenchido seguindo o padrão HTML dado, com o teste de cobertura (T4 Step 1) definindo "pronto" — não é um TODO solto, é um contrato checado por máquina. ✔
- **Ordem de execução:** T5 importa de T6; resolvido criando o stub `maybeGenerate` em T5 e substituindo pelo cliente completo em T6. Fase 3 tocada só onde necessário (remoção de `completeLesson` + reescrita do bloco de conclusão), com os testes ajustados no mesmo passo. ✔
