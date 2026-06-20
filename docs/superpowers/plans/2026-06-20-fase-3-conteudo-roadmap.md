# Fase 3 — Conteúdo + Roadmap · Plano de Implementação (NeuroCode)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a camada de conteúdo do NeuroCode — modelos `Roadmap`/`Course`/`Lesson`/`Progress`, seed do roadmap **Desenvolvedor Front-end** (HTML → CSS → JS) e as telas **Roadmap / Matéria / Aula**, todas protegidas por `requireAuth`, com destravamento sequencial de matérias e aulas conforme o progresso do aluno.

**Architecture:** O backend ganha quatro modelos Prisma (`Roadmap → Course → Lesson`, mais `Progress` por aluno/aula) e um módulo `content/` com dois arquivos: `seed.js` (dados estáticos + `seedContent(prisma)` idempotente) e `service.js` (consultas + derivação de bloqueio/disponibilidade, sem mutar XP/pontos — isso é da Fase 5). Um router `content.js` expõe rotas **somente-leitura** de roadmap/matéria/aula e uma rota de **conclusão de aula** (que só persiste `Progress`, sem recompensa). O frontend ganha três páginas (`Roadmap`, `Course`, `Lesson`), um componente `LessonContent` que renderiza blocos de teoria estruturados, rotas protegidas e um CSS próprio. Cada tarefa entrega software testável.

**Tech Stack:** Node 18+ (ESM), Express 4, Prisma 5 + SQLite, Vitest 2 + Supertest (server); React 18, Vite 5, react-router-dom 6, Vitest 2 + @testing-library/react + jsdom (web). **Sem novas dependências de runtime** — conteúdo de aula é JSON estruturado renderizado por componente próprio (nada de `react-markdown`).

## Global Constraints

- **Node.js 18+** (recomendado 20 LTS). Gerenciador: **npm**.
- `server/` e `web/` são **ESM** (`"type": "module"`).
- API em **`http://localhost:4000`**, prefixo de rotas **`/api`**. Frontend: **Vite na porta 5173**, proxy de `/api` → `http://localhost:4000`.
- Banco: **SQLite via Prisma 5**, `DATABASE_URL="file:./dev.db"` (arquivo em `server/prisma/dev.db`). **Os testes do server rodam contra `server/prisma/test.db`** (nunca `dev.db`), recriado e semeado pelo `global-setup`.
- Testes: **Vitest** (`npm test` = `vitest run`). Backend usa Supertest; frontend usa `@testing-library/react` + jsdom. Assertivas de UI são **assíncronas** (`findBy*`), com future flags do Router e `vi.unstubAllGlobals()` no `afterEach`.
- **Toda rota de conteúdo exige sessão** — o router de conteúdo é montado atrás de `requireAuth`. Rotas que mudam estado (POST de conclusão) também passam por `verifyCsrf`.
- **Rotas de conteúdo (exatas):** `GET /api/roadmaps`, `GET /api/roadmaps/:slug`, `GET /api/courses/:slug`, `GET /api/lessons/:id`, `POST /api/lessons/:id/complete`.
- **Escopo travado (design §Seção 3 / spec §Subsistema 3):**
  - Estrutura **Roadmap → Course → Lesson** (+ **Progress** por aluno/aula). `Exercise`/`Attempt` ficam para a **Fase 4** (motor adaptativo) — **não** entram aqui.
  - Fatia: 1 roadmap **Desenvolvedor Front-end** com 3 matérias (**HTML**, **CSS**, **JavaScript**), cada uma com 3 aulas (teoria curta). Demais roadmaps (DevOps, Back-end, Data) entram **bloqueados** (`isLocked = true`, sem matérias).
  - Tela de **Roadmap** = trilha visual de nós; matérias destravam **em sequência**; aulas destravam **em sequência** dentro da matéria.
  - **Gamificação fica para a Fase 5.** A conclusão de aula nesta fase **só grava `Progress` (status `completed`)** — **não** mexe em `xp`, `neuroPoints`, `level`, nem emite badge/certificado.
- **Campos dos modelos (spec — copiar verbatim):**
  - **Roadmap** — `slug`, `title`, `description`, `icon`, `isLocked`.
  - **Course** — `roadmapId`, `slug`, `title`, `description`, `order`, `badgeName`, `badgeIcon`, `pointsReward`.
  - **Lesson** — `courseId`, `title`, `order`, `content` (teoria), `conceptTags`. Endereçada por **`id` numérico** (sem slug).
  - **Progress** — `userId`, `lessonId`, `status` (`completed`), `score?`, `completedAt`. Único por `(userId, lessonId)`.
- **Representação de conteúdo:** `Lesson.content` e `Lesson.conceptTags` são **strings JSON** no SQLite; a camada de serviço faz `JSON.parse` antes de responder. `content` é um **array de blocos** `{ type, ... }` com `type ∈ { heading, paragraph, code, list }`. `conceptTags` é um array de strings. (Decisão: blocos estruturados em vez de markdown cru — determinístico, testável e sem dependência nova.)
- **Ícones:** `icon`/`badgeIcon` guardam **strings** (nomes Lucide, p/ wiring futuro). A UI desta fase **não** adiciona `lucide-react`; renderiza glifos de status (`✓`, cadeado, nº da etapa) com CSS.
- O `.gitignore` raiz já ignora `node_modules/`, `*.db`, `*.sqlite`, `.env` (mantém `.env.example`). **`server/.env` nunca é versionado.**
- **Toda mensagem de commit termina com os dois trailers padrão** (anexar ao final, omitidos dos passos por brevidade):
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M4GLWrrakCikMhWDKqX9fe
  ```
- Todos os comandos rodam a partir da raiz do repo (`Trabalho Neurocode/`), com `cd` explícito para `server/` ou `web/` quando indicado.

## Estado herdado da Fase 2 (ponto de partida)

- `server/prisma/schema.prisma` tem `User` e `Session`. Ganha `Roadmap`/`Course`/`Lesson`/`Progress` na Task 1 (+ relação `progress Progress[]` em `User`).
- `server/src/db/client.js` exporta o singleton `prisma` (`import 'dotenv/config'` no topo, que **não** sobrescreve env já definida). **Inalterado.**
- `server/src/app.js` monta: `helmet` → `cors(credentials)` → `express.json` → `cookieParser(SESSION_SECRET)` → `issueCsrfToken` → `GET /api/csrf` → `/api` (health) → `/api/auth` (auth) → `notFound` → `errorHandler`. A Task 4 insere o `contentRouter` em `/api` **antes** do `notFound`.
- `server/src/middleware/auth.js` exporta `requireAuth` (lê `req.signedCookies['nc_session']`, popula `req.user`, senão 401). **Reutilizado.**
- `server/src/middleware/csrf.js` exporta `verifyCsrf`. **Reutilizado** na rota de conclusão.
- `server/tests/global-setup.js` recria `prisma/test.db` via `npx prisma migrate deploy`. A Task 2 adiciona a **semeadura** do conteúdo logo após o migrate.
- `web/src/lib/api.js` exporta `apiGet(path)` / `apiPost(path, body)` (fetch `/api${path}`, `credentials:'include'`, CSRF no POST, lança `ApiError`). **Reutilizado direto** pelas páginas — nenhuma mudança.
- `web/src/App.jsx` mapeia `/`, `/login`, `/register` e `/dashboard` (dentro de `<ProtectedRoute>`). A Task 5 adiciona `/roadmap`, `/curso/:slug`, `/aula/:id` dentro do `<ProtectedRoute>`.
- `web/src/context/AuthContext.jsx` expõe `useAuth()` (`{ user, loading, login, register, logout, refresh }`). **Reutilizado.**
- `web/src/main.jsx` importa `variables/base/components/landing/auth.css`. A Task 5 adiciona `roadmap.css`.
- Tokens de design disponíveis (`web/src/styles/variables.css`): `--grad-brand`, `--grad-brand-cyan`, `--c-card`, `--c-border`, `--c-text`, `--c-text-muted`, `--c-green`, `--c-purple`, `--radius`, `--radius-lg`, `--shadow-card`. Classes utilitárias (`components.css`): `.card`, `.badge`/`.badge.is-green`/`.is-cyan`/`.is-gold`, `.progress > span`, `.btn`/`.btn-primary`/`.btn-ghost`/`.btn-block`, `.container`.

---

### Task 1: Modelos de conteúdo (`Roadmap`/`Course`/`Lesson`/`Progress`) + migração

Os quatro modelos do design, com as relações e o índice único de progresso. Sem rotas nem seed ainda — só o schema, a migração e um teste de banco que prova as relações e o `@@unique([userId, lessonId])`.

**Files:**
- Modify: `server/prisma/schema.prisma` (4 modelos novos + relação `progress` em `User`)
- Create: `server/prisma/migrations/<timestamp>_add_content_models/` (gerada pelo CLI)
- Test: `server/tests/content.model.test.js`

**Interfaces:**
- Consumes: o client `prisma` (`server/src/db/client.js`); o modelo `User`.
- Produces (modelos Prisma — nomes/tipos que as Tasks 2–4 consomem):
  - **`Roadmap`**: `id Int @id`, `slug String @unique`, `title String`, `description String`, `icon String`, `isLocked Boolean @default(false)`, `order Int @default(0)`, `courses Course[]`.
  - **`Course`**: `id Int @id`, `roadmapId Int`, `roadmap Roadmap @relation(onDelete: Cascade)`, `slug String @unique`, `title String`, `description String`, `order Int`, `badgeName String`, `badgeIcon String`, `pointsReward Int @default(0)`, `lessons Lesson[]`.
  - **`Lesson`**: `id Int @id`, `courseId Int`, `course Course @relation(onDelete: Cascade)`, `title String`, `order Int`, `content String` (JSON de blocos), `conceptTags String` (JSON de strings), `progress Progress[]`.
  - **`Progress`**: `id Int @id`, `userId Int`, `user User @relation(onDelete: Cascade)`, `lessonId Int`, `lesson Lesson @relation(onDelete: Cascade)`, `status String @default("completed")`, `score Int?`, `completedAt DateTime @default(now())`, `@@unique([userId, lessonId])`.
  - `User` ganha `progress Progress[]`.

- [ ] **Step 1: Escrever o teste de banco que falha**

`server/tests/content.model.test.js`:
```js
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `prisma.roadmap` / `prisma.course` / `prisma.lesson` / `prisma.progress` não existem no client (modelos ainda não estão no schema).

- [ ] **Step 3: Acrescentar os modelos ao schema**

Em `server/prisma/schema.prisma`, adicionar `progress Progress[]` ao `User` e os quatro modelos no fim do arquivo. O `User` fica:
```prisma
model User {
  id             Int       @id @default(autoincrement())
  name           String
  email          String    @unique
  passwordHash   String
  plan           String    @default("free")
  xp             Int       @default(0)
  level          Int       @default(1)
  neuroPoints    Int       @default(0)
  streak         Int       @default(0)
  lastActiveDate DateTime?
  createdAt      DateTime  @default(now())
  sessions       Session[]
  progress       Progress[]
}
```
E ao final do arquivo:
```prisma
model Roadmap {
  id          Int      @id @default(autoincrement())
  slug        String   @unique
  title       String
  description String
  icon        String
  isLocked    Boolean  @default(false)
  order       Int      @default(0)
  courses     Course[]
}

model Course {
  id           Int      @id @default(autoincrement())
  roadmapId    Int
  roadmap      Roadmap  @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  slug         String   @unique
  title        String
  description  String
  order        Int
  badgeName    String
  badgeIcon    String
  pointsReward Int      @default(0)
  lessons      Lesson[]
}

model Lesson {
  id          Int        @id @default(autoincrement())
  courseId    Int
  course      Course     @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title       String
  order       Int
  content     String
  conceptTags String
  progress    Progress[]
}

model Progress {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lessonId    Int
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  status      String   @default("completed")
  score       Int?
  completedAt DateTime @default(now())

  @@unique([userId, lessonId])
}
```

- [ ] **Step 4: Criar a migração (gera o client com os modelos)**

Run:
```bash
cd server && npx prisma migrate dev --name add_content_models
```
Expected: cria `server/prisma/migrations/<timestamp>_add_content_models/`, aplica no `dev.db` e regenera `@prisma/client` com `Roadmap`/`Course`/`Lesson`/`Progress`. (O `global-setup` aplicará essa migração ao `test.db` na próxima rodada via `migrate deploy`.)

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `content.model.test.js` (2) verde; o `global-setup` recriou `test.db` já com as tabelas novas. Demais suítes seguem verdes.

- [ ] **Step 6: Confirmar que o dev.db não vazou no diff de código**

Run:
```bash
cd server && git status --porcelain
```
Expected: aparecem `prisma/schema.prisma`, a pasta nova de migração e o teste; `*.db` continua ignorado.

- [ ] **Step 7: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations server/tests/content.model.test.js
git commit -m "feat(server): modelos Roadmap/Course/Lesson/Progress + migração"
```

---

### Task 2: Seed do conteúdo Front-end — módulo idempotente + CLI + semeadura nos testes

Os dados estáticos do roadmap Front-end (3 matérias × 3 aulas) + 3 roadmaps bloqueados, num módulo `seedContent(prisma)` **idempotente** (upsert por slug). O CLI `prisma/seed.js` passa a chamá-lo, `prisma db seed` fica configurado (dívida herdada), e o `global-setup` semeia o `test.db` para as Tasks 3–4 terem dados.

**Files:**
- Create: `server/src/content/seed.js`
- Modify: `server/prisma/seed.js` (CLI fino chamando `seedContent`)
- Modify: `server/package.json` (bloco `"prisma": { "seed": ... }`)
- Modify: `server/tests/global-setup.js` (semear o test.db após o migrate)
- Test: `server/tests/content.seed.test.js`

**Interfaces:**
- Consumes: o client `prisma`; os modelos da Task 1.
- Produces:
  - `CONTENT` — export nomeado de `server/src/content/seed.js`: array de roadmaps (com `courses` aninhando `lessons`) descrevendo a fatia. Slugs estáveis: roadmap `desenvolvedor-front-end`; matérias `html`, `css`, `javascript`; bloqueados `devops`, `back-end`, `data`.
  - `seedContent(prisma): Promise<void>` — export nomeado; idempotente (upsert por `slug` em roadmap/course; aulas recriadas por matéria a cada execução via `deleteMany`+`create` para refletir edições de conteúdo). Não toca usuários nem `Progress`.

- [ ] **Step 1: Escrever o teste que falha**

`server/tests/content.seed.test.js`:
```js
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
    const roadmaps = await prisma.roadmap.count();
    expect(roadmaps).toBe(CONTENT.length);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/content/seed.js` não existe; o `global-setup` ainda não semeia, então `roadmap.findUnique` devolve `null`.

- [ ] **Step 3: Criar o módulo de seed (dados + função idempotente)**

`server/src/content/seed.js`:
```js
// Conteúdo estático da fatia vertical (Fase 3). Blocos de aula:
//   { type: 'heading', text }       — subtítulo
//   { type: 'paragraph', text }     — parágrafo de teoria
//   { type: 'code', lang, text }    — exemplo de código
//   { type: 'list', items: [...] }  — lista de itens
// Endereçamento: roadmap/course por `slug`; aula por `id` (sem slug).

export const CONTENT = [
  {
    slug: 'desenvolvedor-front-end',
    title: 'Desenvolvedor Front-end',
    description: 'Construa interfaces na web do zero: HTML, CSS e JavaScript.',
    icon: 'Code2',
    isLocked: false,
    order: 1,
    courses: [
      {
        slug: 'html',
        title: 'HTML',
        description: 'A estrutura das páginas: tags, texto, links e imagens.',
        order: 1,
        badgeName: 'Estruturador',
        badgeIcon: 'FileCode',
        pointsReward: 100,
        lessons: [
          {
            title: 'O que é HTML',
            order: 1,
            conceptTags: ['html-basico', 'tags'],
            content: [
              { type: 'paragraph', text: 'HTML (HyperText Markup Language) é a linguagem que descreve a estrutura de uma página web. Não é programação: é marcação. Você usa "tags" para dizer ao navegador o que cada pedaço de conteúdo é.' },
              { type: 'heading', text: 'Uma página mínima' },
              { type: 'code', lang: 'html', text: '<!DOCTYPE html>\n<html>\n  <head>\n    <title>Minha página</title>\n  </head>\n  <body>\n    <h1>Olá, mundo!</h1>\n  </body>\n</html>' },
              { type: 'paragraph', text: 'O <head> guarda metadados (título, idioma, links). O <body> guarda tudo o que aparece na tela.' },
            ],
          },
          {
            title: 'Tags e estrutura',
            order: 2,
            conceptTags: ['elementos', 'estrutura-documento'],
            content: [
              { type: 'paragraph', text: 'Um elemento HTML quase sempre tem uma tag de abertura e uma de fechamento, com conteúdo no meio.' },
              { type: 'code', lang: 'html', text: '<p>Isto é um parágrafo.</p>\n<h2>Isto é um subtítulo</h2>' },
              { type: 'heading', text: 'Tags comuns' },
              { type: 'list', items: ['<h1>…<h6> — títulos, do mais ao menos importante', '<p> — parágrafo de texto', '<ul>/<ol> + <li> — listas', '<div> — agrupador genérico'] },
            ],
          },
          {
            title: 'Links e imagens',
            order: 3,
            conceptTags: ['ancoras', 'imagens'],
            content: [
              { type: 'paragraph', text: 'Links conectam páginas; imagens trazem conteúdo visual. Ambos usam atributos para informar o destino/origem.' },
              { type: 'code', lang: 'html', text: '<a href="https://exemplo.com">Visite o exemplo</a>\n<img src="gato.png" alt="Um gato dormindo" />' },
              { type: 'paragraph', text: 'O atributo alt descreve a imagem para leitores de tela e quando ela não carrega — acessibilidade importa.' },
            ],
          },
        ],
      },
      {
        slug: 'css',
        title: 'CSS',
        description: 'A aparência das páginas: cores, espaçamento e layout.',
        order: 2,
        badgeName: 'Estilista',
        badgeIcon: 'Palette',
        pointsReward: 120,
        lessons: [
          {
            title: 'Seletores',
            order: 1,
            conceptTags: ['seletores', 'especificidade'],
            content: [
              { type: 'paragraph', text: 'CSS (Cascading Style Sheets) estiliza o HTML. Você seleciona elementos e aplica regras a eles.' },
              { type: 'code', lang: 'css', text: 'p { color: purple; }\n.destaque { font-weight: bold; }\n#topo { padding: 20px; }' },
              { type: 'list', items: ['tag — seleciona por elemento (p, h1)', '.classe — seleciona por atributo class', '#id — seleciona um elemento único por id'] },
            ],
          },
          {
            title: 'Box model',
            order: 2,
            conceptTags: ['box-model', 'espacamento'],
            content: [
              { type: 'paragraph', text: 'Todo elemento é uma caixa com quatro camadas: conteúdo, padding (interno), border e margin (externo).' },
              { type: 'code', lang: 'css', text: '.card {\n  padding: 16px;   /* espaço interno */\n  border: 1px solid #ccc;\n  margin: 24px;    /* espaço externo */\n}' },
              { type: 'paragraph', text: 'Entender o box model é o que separa um layout bagunçado de um alinhado.' },
            ],
          },
          {
            title: 'Flexbox',
            order: 3,
            conceptTags: ['flexbox', 'layout'],
            content: [
              { type: 'paragraph', text: 'Flexbox alinha e distribui elementos em uma linha ou coluna. É a ferramenta padrão para layouts de componentes.' },
              { type: 'code', lang: 'css', text: '.barra {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n}' },
              { type: 'list', items: ['justify-content — alinha no eixo principal', 'align-items — alinha no eixo cruzado', 'gap — espaço entre os itens'] },
            ],
          },
        ],
      },
      {
        slug: 'javascript',
        title: 'JavaScript',
        description: 'O comportamento das páginas: variáveis, funções e interação.',
        order: 3,
        badgeName: 'Programador',
        badgeIcon: 'Braces',
        pointsReward: 150,
        lessons: [
          {
            title: 'Variáveis e tipos',
            order: 1,
            conceptTags: ['variaveis', 'tipos'],
            content: [
              { type: 'paragraph', text: 'JavaScript dá comportamento à página. Variáveis guardam valores; use const para o que não muda e let para o que muda.' },
              { type: 'code', lang: 'js', text: "const nome = 'Rangel';\nlet pontos = 0;\npontos = pontos + 10;\nconsole.log(nome, pontos); // Rangel 10" },
              { type: 'list', items: ['string — texto', 'number — números', 'boolean — true/false', 'array/object — coleções'] },
            ],
          },
          {
            title: 'Funções',
            order: 2,
            conceptTags: ['funcoes', 'escopo'],
            content: [
              { type: 'paragraph', text: 'Funções empacotam um pedaço de lógica reutilizável que recebe entradas e devolve uma saída.' },
              { type: 'code', lang: 'js', text: 'function dobro(n) {\n  return n * 2;\n}\nconst soma = (a, b) => a + b;\ndobro(21); // 42' },
              { type: 'paragraph', text: 'Arrow functions (=>) são uma forma curta de escrever funções.' },
            ],
          },
          {
            title: 'Eventos no DOM',
            order: 3,
            conceptTags: ['dom', 'eventos'],
            content: [
              { type: 'paragraph', text: 'O DOM é a representação da página como objetos. Com JS você lê e muda elementos e reage a eventos do usuário.' },
              { type: 'code', lang: 'js', text: "const botao = document.querySelector('#salvar');\nbotao.addEventListener('click', () => {\n  alert('Salvo!');\n});" },
              { type: 'paragraph', text: 'addEventListener conecta uma ação (clique, tecla) a uma função que roda quando ela acontece.' },
            ],
          },
        ],
      },
    ],
  },
  { slug: 'devops', title: 'DevOps', description: 'CI/CD, containers e infraestrutura. Em breve.', icon: 'Server', isLocked: true, order: 2, courses: [] },
  { slug: 'back-end', title: 'Back-end', description: 'APIs, bancos de dados e autenticação. Em breve.', icon: 'Database', isLocked: true, order: 3, courses: [] },
  { slug: 'data', title: 'Data Science', description: 'Análise de dados, Python e visualização. Em breve.', icon: 'BarChart3', isLocked: true, order: 4, courses: [] },
];

export async function seedContent(prisma) {
  for (const rm of CONTENT) {
    const roadmap = await prisma.roadmap.upsert({
      where: { slug: rm.slug },
      update: { title: rm.title, description: rm.description, icon: rm.icon, isLocked: rm.isLocked, order: rm.order },
      create: { slug: rm.slug, title: rm.title, description: rm.description, icon: rm.icon, isLocked: rm.isLocked, order: rm.order },
    });
    for (const c of rm.courses ?? []) {
      const course = await prisma.course.upsert({
        where: { slug: c.slug },
        update: {
          roadmapId: roadmap.id, title: c.title, description: c.description, order: c.order,
          badgeName: c.badgeName, badgeIcon: c.badgeIcon, pointsReward: c.pointsReward,
        },
        create: {
          roadmapId: roadmap.id, slug: c.slug, title: c.title, description: c.description, order: c.order,
          badgeName: c.badgeName, badgeIcon: c.badgeIcon, pointsReward: c.pointsReward,
        },
      });
      // Recria as aulas da matéria para refletir edições de conteúdo sem duplicar.
      // onDelete: Cascade limpa Progress órfão das aulas removidas.
      await prisma.lesson.deleteMany({ where: { courseId: course.id } });
      for (const l of c.lessons ?? []) {
        await prisma.lesson.create({
          data: {
            courseId: course.id,
            title: l.title,
            order: l.order,
            content: JSON.stringify(l.content),
            conceptTags: JSON.stringify(l.conceptTags),
          },
        });
      }
    }
  }
}
```

- [ ] **Step 4: Transformar o CLI `prisma/seed.js` num chamador fino**

`server/prisma/seed.js` (substituir o conteúdo):
```js
import prisma from '../src/db/client.js';
import { seedContent } from '../src/content/seed.js';

async function main() {
  await seedContent(prisma);
  console.log('Seed: conteúdo Front-end (HTML/CSS/JS) + roadmaps bloqueados aplicados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 5: Configurar `prisma db seed` no `server/package.json`**

Em `server/package.json`, adicionar o bloco `"prisma"` no nível raiz (logo após o objeto `"scripts": { ... },`):
```json
  "prisma": {
    "seed": "node prisma/seed.js"
  },
```
(O script `"seed": "node prisma/seed.js"` continua existindo; o bloco habilita `npx prisma db seed` e o seed automático pós-`migrate reset`.)

- [ ] **Step 6: Semear o `test.db` no `global-setup`**

`server/tests/global-setup.js` (substituir o conteúdo):
```js
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// Roda UMA vez antes de toda a suíte. Recria um banco descartável a partir
// das migrações commitadas e semeia o conteúdo estático, garantindo
// isolamento total do dev.db e dados prontos para os testes de conteúdo.
export default async function setup() {
  rmSync('prisma/test.db', { force: true });
  rmSync('prisma/test.db-journal', { force: true });
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });

  // Importante: fixar o DATABASE_URL ANTES de importar o client. O `dotenv/config`
  // em client.js não sobrescreve env já definida, então o test.db vence o .env.
  process.env.DATABASE_URL = 'file:./test.db';
  const { default: prisma } = await import('../src/db/client.js');
  const { seedContent } = await import('../src/content/seed.js');
  await seedContent(prisma);
  await prisma.$disconnect();
}
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `content.seed.test.js` (4) verde; o console mostra o `migrate deploy` aplicando `add_content_models` ao `test.db` antes da suíte. Demais suítes seguem verdes.

- [ ] **Step 8: Smoke do seed no dev.db (opcional mas recomendado)**

Run:
```bash
cd server && npm run seed
```
Expected: imprime "Seed: conteúdo Front-end (HTML/CSS/JS) + roadmaps bloqueados aplicados." sem erro. Rodar duas vezes não duplica (idempotente).

- [ ] **Step 9: Commit**

```bash
git add server/src/content/seed.js server/prisma/seed.js server/package.json server/tests/global-setup.js server/tests/content.seed.test.js
git commit -m "feat(server): seed do roadmap Front-end + db seed e semeadura de teste"
```

---

### Task 3: Serviço de conteúdo — leitura + derivação de bloqueio/progresso

A lógica que transforma os dados crus em respostas com **status por matéria e por aula** para um usuário: matéria destrava quando a anterior é concluída; aula destrava quando a anterior é concluída. Mais a conclusão de aula (só persiste `Progress`, com guarda contra concluir aula bloqueada). Nada de XP/pontos.

**Files:**
- Create: `server/src/content/service.js`
- Test: `server/tests/content.service.test.js`

**Interfaces:**
- Consumes: o client `prisma`; os modelos da Task 1; o conteúdo semeado (Task 2).
- Produces (exports nomeados de `server/src/content/service.js`):
  - `listRoadmaps(): Promise<Array<{ slug, title, description, icon, isLocked, order }>>` — todos os roadmaps, ordenados por `order`. Sem matérias.
  - `getRoadmap(slug, userId): Promise<RoadmapView|null>` — `{ slug, title, description, icon, isLocked, courses: CourseSummary[] }`. Cada `CourseSummary` = `{ slug, title, description, order, badgeName, badgeIcon, pointsReward, locked, completed, lessonsTotal, lessonsCompleted }`. `locked` da 1ª matéria = `false`; das seguintes = `true` até a anterior estar `completed`. Roadmap `isLocked` ⇒ todas as matérias `locked`.
  - `getCourse(slug, userId): Promise<CourseView|null>` — `{ slug, title, description, order, badgeName, badgeIcon, pointsReward, roadmapSlug, locked, completed, lessons: LessonSummary[] }`. `LessonSummary` = `{ id, title, order, status, conceptTags }`, `status ∈ { completed, available, locked }`: `completed` se há `Progress`; senão a **primeira aula não concluída** de uma matéria destravada é `available`, as demais `locked`.
  - `getLesson(id, userId): Promise<LessonView|null>` — `{ id, title, order, content, conceptTags, courseSlug, courseTitle, status, nextLessonId }`. `content`/`conceptTags` já parseados (array). `nextLessonId` = id da próxima aula da matéria (por `order`), ou `null`.
  - `completeLesson(userId, lessonId): Promise<{ ok:true, nextLessonId, courseCompleted } | { error:'not-found'|'locked' }>` — recusa (`locked`) se a aula está bloqueada para o usuário; senão faz upsert de `Progress(status:'completed')` (idempotente) e devolve a próxima aula + se a matéria ficou completa. **Não** altera `xp`/`neuroPoints`/`level`/badges.

- [ ] **Step 1: Escrever os testes que falham**

`server/tests/content.service.test.js`:
```js
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';
import {
  listRoadmaps,
  getRoadmap,
  getCourse,
  getLesson,
  completeLesson,
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

describe('completeLesson — destrava em sequência', () => {
  it('recusa concluir uma aula bloqueada', async () => {
    const lessons = await htmlLessons();
    const res = await completeLesson(userId, lessons[2].id);
    expect(res).toEqual({ error: 'locked' });
  });

  it('conclui a aula disponível e libera a próxima', async () => {
    const lessons = await htmlLessons();
    const res = await completeLesson(userId, lessons[0].id);
    expect(res.ok).toBe(true);
    expect(res.nextLessonId).toBe(lessons[1].id);
    expect(res.courseCompleted).toBe(false);

    const c = await getCourse('html', userId);
    expect(c.lessons[0].status).toBe('completed');
    expect(c.lessons[1].status).toBe('available');
  });

  it('concluir todas as aulas completa a matéria e destrava a próxima', async () => {
    const lessons = await htmlLessons();
    await completeLesson(userId, lessons[1].id);
    const last = await completeLesson(userId, lessons[2].id);
    expect(last.courseCompleted).toBe(true);
    expect(last.nextLessonId).toBeNull();

    const rm = await getRoadmap('desenvolvedor-front-end', userId);
    const bySlug = Object.fromEntries(rm.courses.map((c) => [c.slug, c]));
    expect(bySlug.html.completed).toBe(true);
    expect(bySlug.css.locked).toBe(false);
  });

  it('é idempotente e devolve not-found para aula inexistente', async () => {
    const lessons = await htmlLessons();
    const again = await completeLesson(userId, lessons[0].id);
    expect(again.ok).toBe(true);
    expect(await completeLesson(userId, 999999)).toEqual({ error: 'not-found' });
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/content/service.js` não existe.

- [ ] **Step 3: Implementar o serviço**

`server/src/content/service.js`:
```js
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
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `content.service.test.js` (todos) verde; demais suítes seguem verdes.

- [ ] **Step 5: Commit**

```bash
git add server/src/content/service.js server/tests/content.service.test.js
git commit -m "feat(server): serviço de conteúdo com bloqueio sequencial e conclusão de aula"
```

---

### Task 4: Rotas de conteúdo (somente-leitura + conclusão) atrás de `requireAuth`

As cinco rotas do design, todas exigindo sessão. A leitura é protegida por `requireAuth`; a conclusão também passa por `verifyCsrf`. O router é montado em `/api` no `app.js`.

**Files:**
- Create: `server/src/routes/content.js`
- Modify: `server/src/app.js` (montar `contentRouter` em `/api`, antes do `notFound`)
- Test: `server/tests/content.routes.test.js`

**Interfaces:**
- Consumes: `requireAuth` (`server/src/middleware/auth.js`), `verifyCsrf` (`server/src/middleware/csrf.js`), e `listRoadmaps`/`getRoadmap`/`getCourse`/`getLesson`/`completeLesson` (Task 3).
- Produces — router default de `server/src/routes/content.js`, montado em `/api`, com `requireAuth` aplicado a todo o router:
  - `GET /api/roadmaps` → 200 `{ roadmaps }`.
  - `GET /api/roadmaps/:slug` → 200 `{ roadmap }` ou 404 `{ error: 'Roadmap não encontrado.' }`.
  - `GET /api/courses/:slug` → 200 `{ course }` ou 404 `{ error: 'Matéria não encontrada.' }`.
  - `GET /api/lessons/:id` → 200 `{ lesson }`; 400 `{ error: 'Id inválido.' }` se `:id` não é inteiro; 404 `{ error: 'Aula não encontrada.' }`.
  - `POST /api/lessons/:id/complete` (`verifyCsrf`) → 200 `{ ok:true, nextLessonId, courseCompleted }`; 400 id inválido; 404 aula inexistente; 409 `{ error: 'Aula bloqueada. Conclua a anterior primeiro.' }` se bloqueada.
  - Sem sessão, **toda** rota responde 401 (via `requireAuth`).

- [ ] **Step 1: Escrever os testes que falham**

`server/tests/content.routes.test.js`:
```js
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const password = 'Sup3rSecret';
const email = `route-${randomUUID()}@neurocode.dev`;

// Agent autenticado: registra um usuário e guarda o token CSRF.
async function authedAgent() {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/csrf');
  const csrf = csrfRes.body.csrfToken;
  await agent.post('/api/auth/register').set('x-csrf-token', csrf)
    .send({ name: 'Rota', email, password });
  return { agent, csrf };
}

async function htmlLessonIds() {
  const course = await prisma.course.findUnique({
    where: { slug: 'html' },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });
  return course.lessons.map((l) => l.id);
}

describe('Rotas de conteúdo — exigem sessão', () => {
  it('401 sem sessão em GET /api/roadmaps', async () => {
    const res = await request(app).get('/api/roadmaps');
    expect(res.status).toBe(401);
  });
});

describe('Leitura de conteúdo (autenticado)', () => {
  it('lista roadmaps e abre o Front-end', async () => {
    const { agent } = await authedAgent();
    const list = await agent.get('/api/roadmaps');
    expect(list.status).toBe(200);
    expect(list.body.roadmaps[0].slug).toBe('desenvolvedor-front-end');

    const rm = await agent.get('/api/roadmaps/desenvolvedor-front-end');
    expect(rm.status).toBe(200);
    expect(rm.body.roadmap.courses.find((c) => c.slug === 'html').locked).toBe(false);

    const course = await agent.get('/api/courses/html');
    expect(course.status).toBe(200);
    expect(course.body.course.lessons[0].status).toBe('available');

    const lessonId = course.body.course.lessons[0].id;
    const lesson = await agent.get(`/api/lessons/${lessonId}`);
    expect(lesson.status).toBe(200);
    expect(Array.isArray(lesson.body.lesson.content)).toBe(true);
  });

  it('404 para roadmap inexistente e 400 para id de aula inválido', async () => {
    const { agent } = await authedAgent();
    expect((await agent.get('/api/roadmaps/nao-existe')).status).toBe(404);
    expect((await agent.get('/api/lessons/abc')).status).toBe(400);
  });
});

describe('Conclusão de aula', () => {
  it('exige CSRF, conclui a aula disponível e libera a próxima', async () => {
    const { agent, csrf } = await authedAgent();
    const [first, second] = await htmlLessonIds();

    const noCsrf = await request(app).post(`/api/lessons/${first}/complete`).send({});
    expect(noCsrf.status).toBe(401); // sem sessão nem CSRF

    const ok = await agent.post(`/api/lessons/${first}/complete`).set('x-csrf-token', csrf).send({});
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ ok: true, nextLessonId: second, courseCompleted: false });
  });

  it('409 ao tentar concluir uma aula bloqueada', async () => {
    const { agent, csrf } = await authedAgent();
    const ids = await htmlLessonIds();
    const blocked = await agent.post(`/api/lessons/${ids[2]}/complete`).set('x-csrf-token', csrf).send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('Aula bloqueada. Conclua a anterior primeiro.');
  });
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.progress.deleteMany({ where: { userId: user.id } });
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
Expected: FAIL — `../src/routes/content.js` não existe; não há rotas em `/api/roadmaps` (hoje devolvem o 404 JSON do `notFound`, não 401/200).

- [ ] **Step 3: Implementar o router de conteúdo**

`server/src/routes/content.js`:
```js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import {
  listRoadmaps,
  getRoadmap,
  getCourse,
  getLesson,
  completeLesson,
} from '../content/service.js';

const router = Router();

// Todo o conteúdo exige sessão.
router.use(requireAuth);

router.get('/roadmaps', async (req, res, next) => {
  try {
    res.json({ roadmaps: await listRoadmaps() });
  } catch (e) {
    next(e);
  }
});

router.get('/roadmaps/:slug', async (req, res, next) => {
  try {
    const roadmap = await getRoadmap(req.params.slug, req.user.id);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap não encontrado.' });
    res.json({ roadmap });
  } catch (e) {
    next(e);
  }
});

router.get('/courses/:slug', async (req, res, next) => {
  try {
    const course = await getCourse(req.params.slug, req.user.id);
    if (!course) return res.status(404).json({ error: 'Matéria não encontrada.' });
    res.json({ course });
  } catch (e) {
    next(e);
  }
});

router.get('/lessons/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido.' });
    const lesson = await getLesson(id, req.user.id);
    if (!lesson) return res.status(404).json({ error: 'Aula não encontrada.' });
    res.json({ lesson });
  } catch (e) {
    next(e);
  }
});

router.post('/lessons/:id/complete', verifyCsrf, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id inválido.' });
    const result = await completeLesson(req.user.id, id);
    if (result.error === 'not-found') return res.status(404).json({ error: 'Aula não encontrada.' });
    if (result.error === 'locked') {
      return res.status(409).json({ error: 'Aula bloqueada. Conclua a anterior primeiro.' });
    }
    res.json({ ok: true, nextLessonId: result.nextLessonId, courseCompleted: result.courseCompleted });
  } catch (e) {
    next(e);
  }
});

export default router;
```

- [ ] **Step 4: Montar o router de conteúdo no `app.js`**

Em `server/src/app.js`, adicionar o import junto aos outros routers e montá-lo em `/api` **depois** do auth e **antes** do `notFound`:
```js
import authRouter from './routes/auth.js';
import contentRouter from './routes/content.js';
// ...
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api', contentRouter);

app.use(notFound);
app.use(errorHandler);
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `content.routes.test.js` (todos) verde; demais suítes seguem verdes.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/content.js server/src/app.js server/tests/content.routes.test.js
git commit -m "feat(server): rotas de conteúdo (roadmaps/courses/lessons/complete) com requireAuth"
```

---

### Task 5: Frontend — telas Roadmap, Matéria e Aula + renderer de teoria

As três telas do design, protegidas por `ProtectedRoute`: a trilha de nós do roadmap (com carreiras bloqueadas), a lista de aulas da matéria e a aula (teoria + "Concluir aula" que destrava a próxima). Reutiliza `apiGet`/`apiPost` e os tokens de design existentes.

**Files:**
- Create: `web/src/pages/Roadmap.jsx`
- Create: `web/src/pages/Course.jsx`
- Create: `web/src/pages/Lesson.jsx`
- Create: `web/src/components/LessonContent.jsx`
- Create: `web/src/styles/roadmap.css`
- Modify: `web/src/App.jsx` (rotas `/roadmap`, `/curso/:slug`, `/aula/:id` dentro de `<ProtectedRoute>`)
- Modify: `web/src/main.jsx` (import de `roadmap.css`)
- Modify: `web/src/pages/Dashboard.jsx` (link "Ir para o roadmap")
- Test: `web/tests/Content.test.jsx`

**Interfaces:**
- Consumes: `apiGet(path)` / `apiPost(path, body)` (`web/src/lib/api.js`); `useAuth()` (contexto); endpoints da Task 4.
- Produces:
  - `LessonContent` (default de `web/src/components/LessonContent.jsx`): recebe `{ blocks }` e renderiza cada bloco por `type` (`heading` → `<h3>`, `paragraph` → `<p>`, `code` → `<pre><code>`, `list` → `<ul><li>`). Tipo desconhecido é ignorado.
  - `Roadmap` (default, rota `/roadmap`): no mount busca `GET /api/roadmaps/desenvolvedor-front-end` (trilha de matérias) e `GET /api/roadmaps` (carreiras). Renderiza nós de matéria com status (`completed`/`available`/`locked`); matéria destravada vira `<Link to={'/curso/' + slug}>`. Carreiras `isLocked` aparecem como cards bloqueados.
  - `Course` (default, rota `/curso/:slug`): busca `GET /api/courses/:slug`. Cabeçalho (título, descrição, badge + pontos a ganhar) e lista de aulas; aula `available`/`completed` vira `<Link to={'/aula/' + id}>`.
  - `Lesson` (default, rota `/aula/:id`): busca `GET /api/lessons/:id`. Renderiza `<LessonContent blocks={content} />` e um botão "Concluir aula" → `POST /api/lessons/:id/complete` → se `nextLessonId` navega para `/aula/:next`, senão para `/curso/:courseSlug`.

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/Content.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const user = { id: 1, name: 'Rangel', email: 'r@neuro.dev', plan: 'free', xp: 0, level: 1, neuroPoints: 0, streak: 0 };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

const roadmapFE = {
  slug: 'desenvolvedor-front-end', title: 'Desenvolvedor Front-end', description: 'x', icon: 'Code2', isLocked: false,
  courses: [
    { slug: 'html', title: 'HTML', description: 'estrutura', order: 1, badgeName: 'Estruturador', badgeIcon: 'FileCode', pointsReward: 100, locked: false, completed: false, lessonsTotal: 3, lessonsCompleted: 0 },
    { slug: 'css', title: 'CSS', description: 'estilo', order: 2, badgeName: 'Estilista', badgeIcon: 'Palette', pointsReward: 120, locked: true, completed: false, lessonsTotal: 3, lessonsCompleted: 0 },
  ],
};
const lesson1 = {
  id: 1, title: 'O que é HTML', order: 1, courseSlug: 'html', courseTitle: 'HTML', status: 'available', nextLessonId: 2,
  conceptTags: ['html-basico'],
  content: [{ type: 'heading', text: 'Uma página mínima' }, { type: 'paragraph', text: 'HTML descreve a estrutura.' }],
};

function mockApi() {
  return vi.fn((url, opts = {}) => {
    const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    if (url.endsWith('/api/auth/me')) return ok({ user });
    if (url.endsWith('/api/csrf')) return ok({ csrfToken: 't' });
    if (url.endsWith('/api/roadmaps/desenvolvedor-front-end')) return ok({ roadmap: roadmapFE });
    if (url.endsWith('/api/roadmaps')) return ok({ roadmaps: [{ slug: 'desenvolvedor-front-end', title: 'Desenvolvedor Front-end', description: 'x', icon: 'Code2', isLocked: false, order: 1 }, { slug: 'devops', title: 'DevOps', description: 'em breve', icon: 'Server', isLocked: true, order: 2 }] });
    if (url.endsWith('/api/lessons/1/complete')) return ok({ ok: true, nextLessonId: 2, courseCompleted: false });
    if (url.endsWith('/api/lessons/1')) return ok({ lesson: lesson1 });
    return ok({});
  });
}

beforeEach(() => vi.stubGlobal('fetch', mockApi()));
afterEach(() => vi.unstubAllGlobals());

describe('Tela de Roadmap', () => {
  it('mostra a matéria HTML e a carreira bloqueada DevOps', async () => {
    renderAt('/roadmap');
    expect(await screen.findByText('HTML')).toBeInTheDocument();
    expect(await screen.findByText('DevOps')).toBeInTheDocument();
  });
});

describe('Tela de Aula', () => {
  it('renderiza a teoria e conclui a aula', async () => {
    renderAt('/aula/1');
    expect(await screen.findByText('Uma página mínima')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /concluir aula/i }));
    // Após concluir, navega para a próxima aula (id 2): a chamada de complete foi disparada.
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/lessons/1/complete'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd web && npm test
```
Expected: FAIL — não há rotas `/roadmap` nem `/aula/:id`; os componentes não existem.

- [ ] **Step 3: Criar o renderer de teoria**

`web/src/components/LessonContent.jsx`:
```jsx
export default function LessonContent({ blocks }) {
  return (
    <div className="lesson-content">
      {(blocks ?? []).map((b, i) => {
        if (b.type === 'heading') return <h3 key={i}>{b.text}</h3>;
        if (b.type === 'paragraph') return <p key={i}>{b.text}</p>;
        if (b.type === 'code')
          return (
            <pre key={i} className="lesson-code">
              <code>{b.text}</code>
            </pre>
          );
        if (b.type === 'list')
          return (
            <ul key={i} className="lesson-list">
              {(b.items ?? []).map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        return null;
      })}
    </div>
  );
}
```

- [ ] **Step 4: Criar a página de Roadmap**

`web/src/pages/Roadmap.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGet } from '../lib/api.js';

const FE_SLUG = 'desenvolvedor-front-end';

function CourseNode({ course }) {
  const glyph = course.completed ? '✓' : course.locked ? '🔒' : course.order;
  const body = (
    <div className={`rm-node rm-node--${course.completed ? 'done' : course.locked ? 'locked' : 'open'}`}>
      <span className="rm-node-glyph">{glyph}</span>
      <div className="rm-node-info">
        <strong>{course.title}</strong>
        <span className="rm-node-sub">
          {course.lessonsCompleted}/{course.lessonsTotal} aulas · +{course.pointsReward} pts
        </span>
      </div>
    </div>
  );
  return course.locked ? body : <Link to={`/curso/${course.slug}`}>{body}</Link>;
}

export default function Roadmap() {
  const [roadmap, setRoadmap] = useState(null);
  const [careers, setCareers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([apiGet(`/roadmaps/${FE_SLUG}`), apiGet('/roadmaps')])
      .then(([a, b]) => {
        setRoadmap(a.roadmap);
        setCareers(b.roadmaps.filter((r) => r.slug !== FE_SLUG));
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Header />
      <main className="container rm-page">
        {error && <p className="rm-error">{error}</p>}
        {roadmap && (
          <>
            <h1>{roadmap.title}</h1>
            <p className="rm-lead">{roadmap.description}</p>
            <div className="rm-trail">
              {roadmap.courses.map((c) => (
                <CourseNode key={c.slug} course={c} />
              ))}
            </div>
            <h2 className="rm-careers-title">Outras carreiras</h2>
            <div className="rm-careers">
              {careers.map((c) => (
                <div key={c.slug} className="rm-career card">
                  <strong>{c.title}</strong>
                  <p>{c.description}</p>
                  <span className="badge">🔒 Bloqueado</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 5: Criar a página de Matéria**

`web/src/pages/Course.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGet } from '../lib/api.js';

function LessonRow({ lesson }) {
  const glyph = lesson.status === 'completed' ? '✓' : lesson.status === 'locked' ? '🔒' : '▶';
  const row = (
    <div className={`course-lesson course-lesson--${lesson.status}`}>
      <span className="course-lesson-glyph">{glyph}</span>
      <span>{lesson.title}</span>
    </div>
  );
  return lesson.status === 'locked' ? row : <Link to={`/aula/${lesson.id}`}>{row}</Link>;
}

export default function Course() {
  const { slug } = useParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet(`/courses/${slug}`)
      .then((d) => setCourse(d.course))
      .catch((e) => setError(e.message));
  }, [slug]);

  return (
    <>
      <Header />
      <main className="container course-page">
        {error && <p className="rm-error">{error}</p>}
        {course && (
          <>
            <Link to="/roadmap" className="course-back">← Roadmap</Link>
            <h1>{course.title}</h1>
            <p className="rm-lead">{course.description}</p>
            <p className="badge is-gold">
              Badge: {course.badgeName} · +{course.pointsReward} NeuroPoints
            </p>
            <div className="course-lessons">
              {course.lessons.map((l) => (
                <LessonRow key={l.id} lesson={l} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 6: Criar a página de Aula**

`web/src/pages/Lesson.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import LessonContent from '../components/LessonContent.jsx';
import { apiGet, apiPost } from '../lib/api.js';

export default function Lesson() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLesson(null);
    apiGet(`/lessons/${id}`)
      .then((d) => setLesson(d.lesson))
      .catch((e) => setError(e.message));
  }, [id]);

  async function concluir() {
    setSaving(true);
    try {
      const res = await apiPost(`/lessons/${id}/complete`, {});
      if (res.nextLessonId) navigate(`/aula/${res.nextLessonId}`);
      else navigate(`/curso/${lesson.courseSlug}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container lesson-page">
        {error && <p className="rm-error">{error}</p>}
        {lesson && (
          <>
            <p className="lesson-eyebrow">{lesson.courseTitle} · Aula {lesson.order}</p>
            <h1>{lesson.title}</h1>
            <LessonContent blocks={lesson.content} />
            <button className="btn btn-primary lesson-cta" onClick={concluir} disabled={saving}>
              {saving ? 'Salvando…' : 'Concluir aula'}
            </button>
          </>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 7: Adicionar as rotas protegidas no `App.jsx`**

`web/src/App.jsx` (adicionar imports e rotas dentro do `<ProtectedRoute>`):
```jsx
import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Roadmap from './pages/Roadmap.jsx';
import Course from './pages/Course.jsx';
import Lesson from './pages/Lesson.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/curso/:slug" element={<Course />} />
        <Route path="/aula/:id" element={<Lesson />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 8: Importar o CSS de conteúdo e criar `roadmap.css`**

Em `web/src/main.jsx`, adicionar após `import './styles/auth.css';`:
```jsx
import './styles/roadmap.css';
```

`web/src/styles/roadmap.css`:
```css
/* ==========================================================================
   NeuroCode · Conteúdo (Roadmap / Matéria / Aula)
   ========================================================================== */
.rm-page,
.course-page,
.lesson-page { padding-top: 32px; padding-bottom: 64px; max-width: 760px; }

.rm-lead { color: var(--c-text-muted); margin-bottom: 24px; }
.rm-error { color: var(--c-red-soft); }

/* Trilha de matérias */
.rm-trail { display: flex; flex-direction: column; gap: 14px; margin-bottom: 40px; }
.rm-trail a { text-decoration: none; color: inherit; }
.rm-node {
  display: flex; align-items: center; gap: 16px;
  background: var(--c-card); border: 1px solid var(--c-border);
  border-radius: var(--radius-lg); padding: 18px 22px;
  transition: transform 0.2s var(--ease), border-color 0.2s var(--ease);
}
.rm-trail a:hover .rm-node { transform: translateY(-2px); border-color: var(--c-purple); }
.rm-node-glyph {
  display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0;
  border-radius: 50%; font-weight: 700; background: var(--grad-brand); color: #fff;
}
.rm-node--locked { opacity: 0.55; }
.rm-node--locked .rm-node-glyph { background: var(--c-card-4); }
.rm-node--done .rm-node-glyph { background: var(--grad-brand-cyan); }
.rm-node-info { display: flex; flex-direction: column; }
.rm-node-sub { color: var(--c-text-muted); font-size: 0.85rem; }

/* Outras carreiras (bloqueadas) */
.rm-careers-title { font-size: 1.1rem; margin-bottom: 14px; }
.rm-careers { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.rm-career { padding: 18px; opacity: 0.7; }
.rm-career p { color: var(--c-text-muted); font-size: 0.88rem; margin: 8px 0 12px; }

/* Matéria */
.course-back { color: var(--c-text-muted); text-decoration: none; font-size: 0.9rem; }
.course-lessons { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
.course-lessons a { text-decoration: none; color: inherit; }
.course-lesson {
  display: flex; align-items: center; gap: 14px;
  background: var(--c-card); border: 1px solid var(--c-border);
  border-radius: var(--radius); padding: 14px 18px;
}
.course-lessons a:hover .course-lesson { border-color: var(--c-purple); }
.course-lesson--locked { opacity: 0.5; }
.course-lesson--completed .course-lesson-glyph { color: var(--c-green); }
.course-lesson-glyph { width: 22px; text-align: center; }

/* Aula */
.lesson-eyebrow { color: var(--c-purple-accent); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
.lesson-content { margin: 20px 0 32px; line-height: 1.7; }
.lesson-content h3 { margin: 22px 0 8px; }
.lesson-content p { color: var(--c-text); margin: 0 0 12px; }
.lesson-code {
  background: #0d0a22; border: 1px solid var(--c-border);
  border-radius: var(--radius-sm); padding: 16px; overflow-x: auto;
  font-family: var(--font-mono); font-size: 0.86rem; color: #d6d3ff;
}
.lesson-list { margin: 0 0 12px; padding-left: 22px; color: var(--c-text-muted); }
.lesson-list li { margin-bottom: 6px; }
.lesson-cta { margin-top: 12px; }
```

- [ ] **Step 9: Adicionar o link para o roadmap na Dashboard**

Em `web/src/pages/Dashboard.jsx`, importar `Link` e adicionar um CTA. Resultado:
```jsx
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <>
      <Header />
      <main className="container">
        <h1>Dashboard</h1>
        <p>Olá, {user?.name}. Bem-vindo de volta.</p>
        <ul className="dash-stats">
          <li>Nível {user?.level}</li>
          <li>{user?.xp} XP</li>
          <li>{user?.neuroPoints} NeuroPoints</li>
          <li>Plano: {user?.plan}</li>
        </ul>
        <Link to="/roadmap" className="btn btn-primary">Ir para o roadmap</Link>
        <button className="btn btn-ghost" onClick={logout}>Sair</button>
      </main>
    </>
  );
}
```

- [ ] **Step 10: Rodar e confirmar que passa**

Run:
```bash
cd web && npm test
```
Expected: PASS — `Content.test.jsx` (2) verde; as suítes web anteriores (`App`, `Auth`, `Landing`) seguem verdes e o stderr fica limpo.

- [ ] **Step 11: Commit**

```bash
git add web/src/pages/Roadmap.jsx web/src/pages/Course.jsx web/src/pages/Lesson.jsx web/src/components/LessonContent.jsx web/src/styles/roadmap.css web/src/App.jsx web/src/main.jsx web/src/pages/Dashboard.jsx web/tests/Content.test.jsx
git commit -m "feat(web): telas de roadmap, matéria e aula com destravamento sequencial"
```

---

### Task 6: Verificação ponta-a-ponta + docs

Fechar a fase: suíte completa verde nas duas pontas, smoke manual do fluxo (login → roadmap → matéria → aula → concluir → próxima aula), e atualizar a documentação de setup com o passo de seed.

**Files:**
- Modify: `README.md` (passo `npm run seed` + descrição da fatia de conteúdo)
- Modify: `GETTING-STARTED.md` (seed antes do dev)

**Interfaces:**
- Consumes: tudo das Tasks 1–5.
- Produces: documentação de execução atualizada; nenhum símbolo de código novo.

- [ ] **Step 1: Rodar a suíte completa das duas pontas**

Run (a partir da raiz):
```bash
npm test
```
Expected: PASS — server (health/db/isolation/app/password/validation/csrf/session/auth/ratelimit/csrf-budget + content.model/content.seed/content.service/content.routes) e web (App/Auth/Landing/Content) todos verdes.

- [ ] **Step 2: Smoke manual do fluxo de conteúdo**

Em dois terminais (ou `npm run dev` na raiz). Primeiro garanta o seed do dev.db:
```bash
cd server && npm run seed && cd .. && npm run dev
```
No navegador (`http://localhost:5173`): cadastre/entre → clique "Ir para o roadmap" → veja HTML disponível e CSS/JS + carreiras bloqueadas → abra HTML → abra a 1ª aula → "Concluir aula" leva à 2ª → conclua as 3 → CSS destrava no roadmap.
Expected: o destravamento sequencial funciona ponta-a-ponta; recarregar a página preserva o progresso (persistido em `Progress`).

> Se preferir um smoke sem navegador, use `curl` com cookies: `GET /api/csrf` → `POST /api/auth/register` → `GET /api/roadmaps` → `GET /api/courses/html` → `POST /api/lessons/<id>/complete` (com `X-CSRF-Token`).

- [ ] **Step 3: Atualizar o `README.md`**

No `README.md`, na seção de como rodar, garantir o passo de seed e descrever a fatia de conteúdo. Acrescentar (ou ajustar) o trecho de setup do server para:
```markdown
### Servidor (API :4000)

```bash
cd server
npm install
npx prisma migrate dev      # cria/atualiza o banco
npm run seed                # semeia o roadmap Front-end (HTML/CSS/JS)
npm run dev
```

O seed popula 1 roadmap **Desenvolvedor Front-end** (matérias HTML → CSS → JavaScript, 3 aulas cada) e 3 carreiras bloqueadas (DevOps, Back-end, Data). As telas de roadmap/matéria/aula exigem login.
```

- [ ] **Step 4: Atualizar o `GETTING-STARTED.md`**

No `GETTING-STARTED.md`, incluir o passo de seed antes do `npm run dev` (ajustar ao formato existente do arquivo), com a observação de que o conteúdo só aparece após `npm run seed` no `server/`.

- [ ] **Step 5: Verificação final + commit**

Run:
```bash
npm test
```
Expected: PASS nas duas pontas (repetição de confirmação após edição de docs — docs não afetam testes, mas confirma a árvore limpa).

```bash
git add README.md GETTING-STARTED.md
git commit -m "docs: passo de seed e descrição da fatia de conteúdo (Fase 3)"
```

---

## Self-Review (preenchido na escrita do plano)

- **Cobertura do escopo (design §Seção 3 / spec §Subsistema 3):**
  - Estrutura Roadmap → Course → Lesson (+ Progress) → **Task 1**. ✔
  - Seed Front-end (HTML/CSS/JS) + roadmaps bloqueados + `prisma db seed` (dívida herdada #2) → **Task 2**. ✔
  - Destravamento sequencial de matérias **e** aulas → **Task 3** (derivação) + **Task 4** (rotas) + **Task 5** (UI). ✔
  - Telas roadmap (trilha de nós + carreiras bloqueadas) / matéria / aula protegidas por `requireAuth` → **Tasks 4–5**. ✔
  - Gamificação (XP/pontos/badge na conclusão) **fora de escopo** aqui — explicitado nas Global Constraints (Fase 5). ✔
- **Escopo adiado consciente:** `Exercise`/`Attempt` e a sessão de exercícios estilo Duolingo são da **Fase 4**; a aula desta fase mostra só teoria + "Concluir". `Enrollment` não é necessário (YAGNI) — o roadmap Front-end é acessível a qualquer usuário autenticado; gating por plano é da Fase 6.
- **Consistência de tipos:** `slug` (roadmap/course) vs `id` (lesson) usados de forma consistente nas rotas, serviço, seed e UI. `status ∈ {completed,available,locked}` idêntico em serviço, rotas e componentes. `completeLesson` retorna `{ ok, nextLessonId, courseCompleted }` consumido igual em rota e UI. `userId_lessonId` (compound unique) bate com `@@unique([userId, lessonId])`.
- **Sem placeholders:** todo passo de código traz o código completo (seed com as 9 aulas reais, serviço, rotas, 3 páginas, CSS).

## Convenção: atualização do Vault

Ao concluir cada task (ou a fase), atualizar o Vault (`03 Projetos/NeuroCode/`): o índice de fases (`02 Desenvolvimento/(C) Plano de Implementação — Fatia Vertical.md`) e o `Current Status` do `CLAUDE.md`. Padrão acordado com Rangel (2026-06-18).
