# Fase 2 — Auth segura · Plano de Implementação (NeuroCode)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar autenticação segura ponta-a-ponta — registro, login, logout e sessão por cookie httpOnly — sobre o esqueleto da Fase 1, com hash argon2id, validação zod, rate-limit, CSRF e guarda de rotas no React.

**Architecture:** O backend ganha uma camada de auth isolada (`auth/`, `middleware/`, `lib/`): senha com argon2id, sessão persistida no SQLite (modelo `Session`) referenciada por um cookie httpOnly assinado, validação com zod, proteção CSRF por double-submit cookie, e rate-limit no login. O app endurece com helmet, cors e um middleware de erro central. O frontend ganha um `AuthContext`, telas reais de Login/Register, um `ProtectedRoute` e um client de API ciente de CSRF. Cada tarefa entrega software testável. **A primeira tarefa isola o banco de teste** (dívida herdada da Fase 1) — nenhum teste de auth toca o `dev.db`.

**Tech Stack:** Node 18+ (ESM), Express 4, Prisma 5 + SQLite, argon2, zod, cookie-parser, express-rate-limit, helmet, cors, Vitest 2 + Supertest (server); React 18, Vite 5, react-router-dom 6, Vitest 2 + @testing-library/react + jsdom (web).

## Global Constraints

- **Node.js 18+** (recomendado 20 LTS). Gerenciador: **npm**.
- `server/` e `web/` são **ESM** (`"type": "module"`).
- API em **`http://localhost:4000`**, prefixo de rotas **`/api`**.
- Banco: **SQLite via Prisma 5**, `DATABASE_URL="file:./dev.db"` (arquivo em `server/prisma/dev.db`). **Os testes do server rodam contra `server/prisma/test.db`** (nunca `dev.db`).
- Frontend: **Vite na porta 5173**, proxy de `/api` → `http://localhost:4000`.
- Testes: **Vitest** (`npm test` = `vitest run`). Backend usa Supertest; frontend usa `@testing-library/react` + jsdom.
- **Rotas de auth (exatas):** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- **Segurança (requisitos do design, Subsistema 1 — copiar verbatim):**
  - Senha com **hash argon2id** — nunca em texto puro.
  - Sessão via **cookie httpOnly + SameSite=Lax + Secure (em produção)**, assinado com `SESSION_SECRET`.
  - **Validação de entrada com zod** em todas as rotas de escrita.
  - **Rate-limit no login** (anti força-bruta).
  - **Proteção CSRF** para requisições que mudam estado (POST/PUT/PATCH/DELETE).
  - **Mensagens de erro genéricas no login** (sem revelar se o e-mail existe → evita enumeração).
  - **Checagem de força de senha** no cadastro (mín. 8, com maiúscula, minúscula e número).
  - Apenas e-mail/senha (sem OAuth — YAGNI no protótipo).
- **Nomes fixos (consistência entre tarefas):** cookie de sessão **`nc_session`** (httpOnly, assinado); cookie CSRF **`nc_csrf`** (legível por JS); header CSRF **`X-CSRF-Token`**.
- O `.gitignore` raiz já ignora `node_modules/`, `*.db` (cobre `dev.db` e `test.db`), `*.sqlite`, `.env` (mantém `.env.example`), `__pycache__/` e `data/inscricoes.json`. **`server/.env` nunca é versionado**; `server/.env.example` sim.
- **Toda mensagem de commit termina com os dois trailers padrão** (anexar ao final, omitidos dos passos por brevidade):
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WzgYtLnPcMp8EPaUQq9xsY
  ```
- Todos os comandos rodam a partir da raiz do repo (`Trabalho Neurocode/`), com `cd` explícito para `server/` ou `web/` quando indicado.

## Estado herdado da Fase 1 (ponto de partida)

- `server/src/app.js` monta `express.json()` + `healthRouter` em `/api`. **Será reescrito** na Task 2.
- `server/src/db/client.js` exporta o singleton `prisma` (`import 'dotenv/config'` no topo). **Inalterado.**
- `server/prisma/schema.prisma` tem só o modelo `User`. Ganha `Session` na Task 5.
- `server/tests/db.test.js` exercita o `User`. Hoje roda no `dev.db` real — a Task 1 corrige isso.
- `web/src/lib/api.js` exporta `apiGet`/`apiPost` (fetch `/api${path}`, `credentials:'include'`). **Será endurecido** (CSRF + erros) na Task 7.
- `web/src/App.jsx` tem rotas `/` (Landing real), `/login` e `/register` como placeholders (`<h1>Entrar</h1>` / `<h1>Criar conta</h1>`). **Preenchidas** na Task 7.

---

### Task 1: Isolamento do banco de teste (dívida herdada — pré-requisito de tudo)

Hoje `server/tests/db.test.js` roda contra `prisma/dev.db`. Antes de qualquer teste de auth (que cria/apaga usuários e sessões), o server precisa rodar testes contra um banco descartável `prisma/test.db`, recriado a cada execução a partir das migrações.

**Files:**
- Create: `server/vitest.config.js`
- Create: `server/tests/global-setup.js`
- Create: `server/tests/isolation.test.js`
- Modify: `server/tests/db.test.js` (assertar todos os defaults do `User` — fecha a lacuna do spec da Fase 1)
- Modify: `server/package.json` (campo `engines`)

**Interfaces:**
- Consumes: o client `prisma` (`server/src/db/client.js`) e as migrações Prisma existentes (`server/prisma/migrations/`).
- Produces: ambiente de teste do server com `DATABASE_URL="file:./test.db"` e `SESSION_SECRET` de teste injetados via `vitest.config.js`; `prisma/test.db` recriado pelo `global-setup` antes da suíte. Nenhum símbolo de código novo.

- [ ] **Step 1: Escrever o teste-guarda que falha**

`server/tests/isolation.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('Isolamento do banco de teste', () => {
  it('os testes apontam para test.db, nunca para dev.db', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.DATABASE_URL).toContain('test.db');
    expect(process.env.DATABASE_URL).not.toContain('dev.db');
  });

  it('um SESSION_SECRET de teste está disponível', () => {
    expect(process.env.SESSION_SECRET).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL em `isolation.test.js` — `DATABASE_URL` ainda aponta para `file:./dev.db` (vindo de `.env`) e `SESSION_SECRET` é `undefined`.

- [ ] **Step 3: Criar o global-setup que recria o test.db a partir das migrações**

`server/tests/global-setup.js`:
```js
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// Roda UMA vez antes de toda a suíte. Recria um banco descartável a partir
// das migrações commitadas, garantindo isolamento total do dev.db.
export default function setup() {
  rmSync('prisma/test.db', { force: true });
  rmSync('prisma/test.db-journal', { force: true });
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
```

- [ ] **Step 4: Criar o `vitest.config.js` injetando o ambiente de teste**

`server/vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';

// O DATABASE_URL é injetado aqui ANTES de qualquer import. Como o
// `dotenv/config` em client.js não sobrescreve variáveis já definidas,
// o test.db vence o .env. Assim nenhum teste toca o dev.db.
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'file:./test.db',
      SESSION_SECRET: 'test-secret-not-for-production',
      NODE_ENV: 'test',
    },
    globalSetup: './tests/global-setup.js',
  },
});
```

- [ ] **Step 5: Fechar a lacuna de defaults em `db.test.js`**

`server/tests/db.test.js` (substituir o corpo do `it` para assertar todos os defaults do `User`):
```js
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';

const email = `test-${randomUUID()}@neurocode.dev`;

describe('Modelo User', () => {
  it('cria e lê um usuário com todos os defaults corretos', async () => {
    const created = await prisma.user.create({
      data: { name: 'Teste', email, passwordHash: 'x' },
    });
    expect(typeof created.id).toBe('number');
    expect(created.plan).toBe('free');
    expect(created.xp).toBe(0);
    expect(created.level).toBe(1);
    expect(created.neuroPoints).toBe(0);
    expect(created.streak).toBe(0);
    expect(created.lastActiveDate).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);

    const found = await prisma.user.findUnique({ where: { email } });
    expect(found?.name).toBe('Teste');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 6: Adicionar o campo `engines` ao `server/package.json`**

Em `server/package.json`, logo após a linha `"type": "module",`, inserir:
```json
  "engines": {
    "node": ">=18"
  },
```

- [ ] **Step 7: Rodar e confirmar que passa (contra test.db)**

Run:
```bash
cd server && npm test
```
Expected: PASS — `global-setup` recria `prisma/test.db` via `migrate deploy`, e as 3 suítes (`health`, `db`, `isolation`) ficam verdes. Confirme no console a linha do Prisma aplicando a migração `init` em `test.db`.

- [ ] **Step 8: Confirmar que o dev.db não foi tocado**

Run:
```bash
cd server && git status --porcelain
```
Expected: nenhuma alteração em `prisma/dev.db` listada (e `test.db` está ignorado por `*.db`). Apenas arquivos novos/modificados de código aparecem.

- [ ] **Step 9: Commit**

```bash
git add server/vitest.config.js server/tests/global-setup.js server/tests/isolation.test.js server/tests/db.test.js server/package.json
git commit -m "test(server): isola banco de teste em test.db via global-setup"
```

---

### Task 2: Endurecer o app — helmet, cors, cookie-parser, erro central + 404

Antes das rotas de auth, o app precisa de cabeçalhos de segurança (helmet), CORS com credenciais (para o `fetch` com cookies), o parser de cookies (assinados, base da sessão e do CSRF) e um tratamento de erro/404 que sempre responde JSON.

**Files:**
- Modify: `server/package.json` (deps: helmet, cors, cookie-parser)
- Create: `server/src/middleware/error.js`
- Modify: `server/src/app.js`
- Test: `server/tests/app.test.js`

**Interfaces:**
- Consumes: `healthRouter` (`server/src/routes/health.js`) da Fase 1.
- Produces:
  - `notFound(req, res)` e `errorHandler(err, req, res, next)` — exports nomeados de `server/src/middleware/error.js`. `notFound` responde 404 `{ error: 'Recurso não encontrado.' }`; `errorHandler` responde `err.status || 500` com `{ error: err.publicMessage || 'Erro interno.' }` e loga no console quando status ≥ 500.
  - `app` (default de `server/src/app.js`) agora aplica, nesta ordem: `helmet()`, `cors({ origin, credentials:true })`, `express.json()`, `cookieParser(SESSION_SECRET)`, rotas (`/api` health, depois auth na Task 6), `notFound`, `errorHandler`. `SESSION_SECRET` vem de `process.env.SESSION_SECRET` (fallback `'dev-insecure-secret'` fora de produção; lança erro se ausente em produção).

- [ ] **Step 1: Instalar as dependências de endurecimento**

Run:
```bash
cd server && npm install helmet cors cookie-parser
```
Expected: três deps adicionadas a `dependencies` sem erros.

- [ ] **Step 2: Escrever os testes que falham**

`server/tests/app.test.js`:
```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('App endurecido', () => {
  it('mantém GET /api/health respondendo 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('responde 404 em JSON para rota desconhecida', async () => {
    const res = await request(app).get('/api/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Recurso não encontrado.' });
  });

  it('aplica cabeçalhos de segurança do helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — a rota desconhecida hoje devolve o 404 HTML padrão do Express (não JSON) e o header `x-content-type-options` não existe.

- [ ] **Step 4: Criar o middleware de erro/404**

`server/src/middleware/error.js`:
```js
export function notFound(req, res) {
  res.status(404).json({ error: 'Recurso não encontrado.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.publicMessage || 'Erro interno.' });
}
```

- [ ] **Step 5: Reescrever o `app.js` com o pipeline endurecido**

`server/src/app.js`:
```js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health.js';
import { notFound, errorHandler } from './middleware/error.js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret';
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET é obrigatório em produção.');
}

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));

app.use('/api', healthRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `app.test.js` (3) e as suítes anteriores verdes.

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json server/src/app.js server/src/middleware/error.js server/tests/app.test.js
git commit -m "feat(server): endurece app com helmet, cors, cookie-parser e erro central"
```

---

### Task 3: Primitivas de auth — hash argon2id + validação zod

Duas bibliotecas puras e testáveis, consumidas pelas rotas de auth: o hashing de senha (argon2id) e os schemas de validação (zod) com checagem de força de senha.

**Files:**
- Modify: `server/package.json` (deps: argon2, zod)
- Create: `server/src/lib/password.js`
- Create: `server/src/lib/validation.js`
- Test: `server/tests/password.test.js`
- Test: `server/tests/validation.test.js`

**Interfaces:**
- Consumes: nada (unidades puras).
- Produces:
  - `hashPassword(password: string): Promise<string>` e `verifyPassword(hash: string, password: string): Promise<boolean>` — exports nomeados de `server/src/lib/password.js`, usando argon2id.
  - `registerSchema` e `loginSchema` — exports nomeados (objetos zod) de `server/src/lib/validation.js`. `registerSchema` valida `{ name, email, password }` (email normalizado p/ minúsculas; senha mín. 8 com maiúscula, minúscula e número). `loginSchema` valida `{ email, password }` (email normalizado; senha não-vazia). Ambos exportam `.safeParse(data)`.

> **Nota de instalação:** `argon2` traz binário nativo. Em Windows x64 com Node 18/20 há prebuilds — instala sem build tools. Se a instalação falhar por falta de toolchain, troque por `@node-rs/argon2` (mesma API `hash`/`verify`, prebuilds napi) e ajuste o import; reporte como DONE_WITH_CONCERNS.

- [ ] **Step 1: Instalar argon2 e zod**

Run:
```bash
cd server && npm install argon2 zod
```
Expected: duas deps adicionadas sem erros.

- [ ] **Step 2: Escrever os testes que falham**

`server/tests/password.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

describe('password (argon2id)', () => {
  it('gera um hash argon2id diferente do texto puro', async () => {
    const hash = await hashPassword('Sup3rSecret');
    expect(hash).not.toBe('Sup3rSecret');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifica a senha correta', async () => {
    const hash = await hashPassword('Sup3rSecret');
    expect(await verifyPassword(hash, 'Sup3rSecret')).toBe(true);
  });

  it('rejeita a senha errada', async () => {
    const hash = await hashPassword('Sup3rSecret');
    expect(await verifyPassword(hash, 'errada')).toBe(false);
  });
});
```

`server/tests/validation.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../src/lib/validation.js';

describe('registerSchema', () => {
  it('aceita um cadastro válido e normaliza o e-mail', () => {
    const r = registerSchema.safeParse({
      name: 'Rangel',
      email: 'RANGEL@Neuro.DEV',
      password: 'Sup3rSecret',
    });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('rangel@neuro.dev');
  });

  it('rejeita senha fraca (sem número)', () => {
    const r = registerSchema.safeParse({
      name: 'Rangel',
      email: 'rangel@neuro.dev',
      password: 'semnumeros',
    });
    expect(r.success).toBe(false);
  });

  it('rejeita e-mail inválido', () => {
    const r = registerSchema.safeParse({
      name: 'Rangel',
      email: 'nao-eh-email',
      password: 'Sup3rSecret',
    });
    expect(r.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('aceita credenciais bem formadas', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', password: 'x' });
    expect(r.success).toBe(true);
  });

  it('rejeita e-mail ausente', () => {
    const r = loginSchema.safeParse({ password: 'x' });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/lib/password.js` e `../src/lib/validation.js` não existem.

- [ ] **Step 4: Implementar as primitivas**

`server/src/lib/password.js`:
```js
import argon2 from 'argon2';

export function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash, password) {
  return argon2.verify(hash, password);
}
```

`server/src/lib/validation.js`:
```js
import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'A senha precisa de ao menos 8 caracteres.')
  .regex(/[a-z]/, 'Inclua uma letra minúscula.')
  .regex(/[A-Z]/, 'Inclua uma letra maiúscula.')
  .regex(/[0-9]/, 'Inclua um número.');

const emailSchema = z
  .string()
  .trim()
  .email('E-mail inválido.')
  .transform((v) => v.toLowerCase());

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.'),
});
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `password.test.js` (3) + `validation.test.js` (5) verdes.

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/package-lock.json server/src/lib/password.js server/src/lib/validation.js server/tests/password.test.js server/tests/validation.test.js
git commit -m "feat(server): hash argon2id e validação zod (com força de senha)"
```

---

### Task 4: Proteção CSRF (double-submit cookie) + endpoint de token

Double-submit: o app emite um cookie `nc_csrf` legível por JS; toda requisição que muda estado precisa repetir o token no header `X-CSRF-Token`, e o middleware compara header com cookie. Um endpoint `GET /api/csrf` devolve o token para o SPA.

**Files:**
- Create: `server/src/middleware/csrf.js`
- Modify: `server/src/app.js` (montar `issueCsrfToken` global + rota `GET /api/csrf`)
- Test: `server/tests/csrf.test.js`

**Interfaces:**
- Consumes: `cookieParser` já montado (Task 2) — `req.cookies` populado.
- Produces:
  - `issueCsrfToken(req, res, next)` — export nomeado de `server/src/middleware/csrf.js`; se `req.cookies['nc_csrf']` não existir, gera 32 bytes hex, seta o cookie `nc_csrf` (`httpOnly:false`, `sameSite:'lax'`, `secure` em prod) e popula `req.cookies['nc_csrf']` para a mesma requisição.
  - `verifyCsrf(req, res, next)` — export nomeado; em métodos seguros (GET/HEAD/OPTIONS) passa direto; nos demais, exige `req.cookies['nc_csrf']` igual ao header `x-csrf-token`, senão responde 403 `{ error: 'Falha na validação CSRF.' }`.
  - `CSRF_COOKIE = 'nc_csrf'` — export nomeado (constante).
  - Rota `GET /api/csrf` → 200 `{ csrfToken: <token> }`.

- [ ] **Step 1: Escrever os testes que falham**

`server/tests/csrf.test.js`:
```js
import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { issueCsrfToken, verifyCsrf } from '../src/middleware/csrf.js';

// App mínimo só para exercitar o CSRF isoladamente (sem depender de auth).
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser('test-secret'));
  app.use(issueCsrfToken);
  app.get('/csrf', (req, res) => res.json({ csrfToken: req.cookies['nc_csrf'] }));
  app.post('/protegido', verifyCsrf, (req, res) => res.json({ ok: true }));
  return app;
}

describe('CSRF double-submit', () => {
  it('emite um cookie nc_csrf e o devolve em GET /csrf', async () => {
    const res = await request(makeApp()).get('/csrf');
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    expect(res.headers['set-cookie'].join(';')).toContain('nc_csrf=');
  });

  it('bloqueia POST sem o header X-CSRF-Token (403)', async () => {
    const agent = request.agent(makeApp());
    await agent.get('/csrf');
    const res = await agent.post('/protegido').send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Falha na validação CSRF.' });
  });

  it('aceita POST quando o header bate com o cookie', async () => {
    const agent = request.agent(makeApp());
    const { body } = await agent.get('/csrf');
    const res = await agent
      .post('/protegido')
      .set('x-csrf-token', body.csrfToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/middleware/csrf.js` não existe.

- [ ] **Step 3: Implementar o middleware de CSRF**

`server/src/middleware/csrf.js`:
```js
import { randomBytes } from 'node:crypto';

export const CSRF_COOKIE = 'nc_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function issueCsrfToken(req, res, next) {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    req.cookies = req.cookies || {};
    req.cookies[CSRF_COOKIE] = token;
  }
  next();
}

export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Falha na validação CSRF.' });
  }
  next();
}
```

- [ ] **Step 4: Montar o CSRF global e a rota de token no `app.js`**

Em `server/src/app.js`: adicionar o import e, **logo após** `app.use(cookieParser(SESSION_SECRET));`, inserir a emissão global do token e o endpoint. Resultado da região central do arquivo:
```js
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health.js';
import { issueCsrfToken } from './middleware/csrf.js';
import { notFound, errorHandler } from './middleware/error.js';

// ... (criação do app, helmet, cors, json) ...
app.use(cookieParser(SESSION_SECRET));
app.use(issueCsrfToken);

app.get('/api/csrf', (req, res) => {
  res.json({ csrfToken: req.cookies['nc_csrf'] });
});

app.use('/api', healthRouter);

app.use(notFound);
app.use(errorHandler);
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `csrf.test.js` (3) verde; demais suítes seguem verdes.

- [ ] **Step 6: Commit**

```bash
git add server/src/middleware/csrf.js server/src/app.js server/tests/csrf.test.js
git commit -m "feat(server): proteção CSRF double-submit e endpoint /api/csrf"
```

---

### Task 5: Modelo `Session` + serviço de sessão

A sessão é persistida no SQLite (`Session`) e referenciada por um cookie httpOnly assinado `nc_session`. O serviço cria, resolve (com expiração) e destrói sessões.

**Files:**
- Modify: `server/prisma/schema.prisma` (modelo `Session` + relação em `User`)
- Create: `server/src/auth/session.js`
- Test: `server/tests/session.test.js`

**Interfaces:**
- Consumes: o client `prisma` (`server/src/db/client.js`); o modelo `User`.
- Produces:
  - Modelo **`Session`**: `id String @id @default(cuid())`, `userId Int`, `user User @relation(fields:[userId], references:[id], onDelete: Cascade)`, `expiresAt DateTime`, `createdAt DateTime @default(now())`. `User` ganha `sessions Session[]`.
  - `SESSION_COOKIE = 'nc_session'` — export nomeado (constante).
  - `sessionCookieOptions` — export nomeado: `{ httpOnly:true, sameSite:'lax', secure: NODE_ENV==='production', signed:true, path:'/', maxAge: 7 dias em ms }`.
  - `createSession(userId: number): Promise<string>` — cria a sessão (TTL 7 dias) e retorna o `id` (token a guardar no cookie).
  - `getUserBySessionId(sessionId?: string): Promise<User|null>` — retorna o usuário se a sessão existe e não expirou; apaga e retorna `null` se expirada; `null` se ausente/inexistente.
  - `destroySession(sessionId?: string): Promise<void>` — apaga a sessão (no-op se ausente).

- [ ] **Step 1: Adicionar o modelo `Session` ao schema**

`server/prisma/schema.prisma` — acrescentar a relação no `User` e o novo modelo:
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
}

model Session {
  id        String   @id @default(cuid())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Criar a migração (gera o client com `Session`)**

Run:
```bash
cd server && npx prisma migrate dev --name add_session
```
Expected: cria `server/prisma/migrations/<timestamp>_add_session/`, aplica no `dev.db` e regenera o `@prisma/client` com o modelo `Session`. (O `global-setup` dos testes aplicará essa migração ao `test.db` na próxima rodada.)

- [ ] **Step 3: Escrever o teste que falha**

`server/tests/session.test.js`:
```js
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';
import {
  createSession,
  getUserBySessionId,
  destroySession,
} from '../src/auth/session.js';

const email = `sess-${randomUUID()}@neurocode.dev`;
let userId;

async function user() {
  if (!userId) {
    const u = await prisma.user.create({
      data: { name: 'Sessão', email, passwordHash: 'x' },
    });
    userId = u.id;
  }
  return userId;
}

describe('serviço de sessão', () => {
  it('cria uma sessão e resolve o usuário pelo token', async () => {
    const token = await createSession(await user());
    expect(typeof token).toBe('string');
    const resolved = await getUserBySessionId(token);
    expect(resolved?.id).toBe(userId);
  });

  it('retorna null para token ausente ou inexistente', async () => {
    expect(await getUserBySessionId(undefined)).toBeNull();
    expect(await getUserBySessionId('nao-existe')).toBeNull();
  });

  it('não resolve sessão expirada e a remove', async () => {
    const token = await createSession(await user());
    await prisma.session.update({
      where: { id: token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await getUserBySessionId(token)).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull();
  });

  it('destrói a sessão', async () => {
    const token = await createSession(await user());
    await destroySession(token);
    expect(await getUserBySessionId(token)).toBeNull();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 4: Rodar e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/auth/session.js` não existe.

- [ ] **Step 5: Implementar o serviço de sessão**

`server/src/auth/session.js`:
```js
import prisma from '../db/client.js';

export const SESSION_COOKIE = 'nc_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  signed: true,
  path: '/',
  maxAge: SESSION_TTL_MS,
};

export async function createSession(userId) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await prisma.session.create({ data: { userId, expiresAt } });
  return session.id;
}

export async function getUserBySessionId(sessionId) {
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function destroySession(sessionId) {
  if (!sessionId) return;
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS — `session.test.js` (4) verde; o `global-setup` recriou o `test.db` já com a tabela `Session`.

- [ ] **Step 7: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations server/src/auth/session.js server/tests/session.test.js
git commit -m "feat(server): modelo Session + serviço de sessão (cookie httpOnly)"
```

---

### Task 6: Rotas de auth + guarda + rate-limit no login

As quatro rotas do design, costurando tudo: zod (validação), argon2 (hash/verify), sessão (cookie httpOnly), CSRF (escrita) e rate-limit (login). Mais o middleware `requireAuth` que protege `/me`, `/logout` e (na Fase 3) rotas de conteúdo.

**Files:**
- Modify: `server/package.json` (dep: express-rate-limit)
- Create: `server/src/middleware/auth.js`
- Create: `server/src/middleware/rateLimit.js`
- Create: `server/src/routes/auth.js`
- Modify: `server/src/app.js` (montar `authRouter` em `/api/auth`)
- Test: `server/tests/auth.test.js`
- Test: `server/tests/auth.ratelimit.test.js`

**Interfaces:**
- Consumes: `registerSchema`/`loginSchema` (Task 3), `hashPassword`/`verifyPassword` (Task 3), `createSession`/`getUserBySessionId`/`destroySession`/`SESSION_COOKIE`/`sessionCookieOptions` (Task 5), `verifyCsrf` (Task 4), client `prisma`.
- Produces:
  - `requireAuth(req, res, next)` — export nomeado de `server/src/middleware/auth.js`; lê `req.signedCookies[SESSION_COOKIE]`, resolve o usuário; em sucesso seta `req.user` e segue; senão 401 `{ error: 'Não autenticado.' }`.
  - `loginLimiter` — export nomeado de `server/src/middleware/rateLimit.js`; janela 15 min, máx. 5, `skipSuccessfulRequests: true`, handler 429 `{ error: 'Muitas tentativas. Tente novamente mais tarde.' }`.
  - Router em `server/src/routes/auth.js` (default), montado em `/api/auth`:
    - `POST /register` (verifyCsrf): 400 zod inválido; 409 genérico se e-mail existe; senão cria user (hash argon2id), cria sessão, seta cookie, 201 `{ user }`.
    - `POST /login` (loginLimiter → verifyCsrf): 400 zod inválido; 401 genérico `{ error: 'Credenciais inválidas.' }` se e-mail não existe **ou** senha errada; senão cria sessão, seta cookie, 200 `{ user }`.
    - `POST /logout` (verifyCsrf → requireAuth): destrói a sessão, limpa o cookie, 200 `{ ok: true }`.
    - `GET /me` (requireAuth): 200 `{ user }`.
    - `user` em todas as respostas é o objeto público (sem `passwordHash`): `{ id, name, email, plan, xp, level, neuroPoints, streak }`.

- [ ] **Step 1: Instalar express-rate-limit**

Run:
```bash
cd server && npm install express-rate-limit
```
Expected: dep adicionada sem erros.

- [ ] **Step 2: Escrever os testes que falham (fluxo principal)**

`server/tests/auth.test.js`:
```js
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const password = 'Sup3rSecret';
const emails = [];

function newEmail() {
  const e = `auth-${randomUUID()}@neurocode.dev`;
  emails.push(e);
  return e;
}

// Agent com cookies persistentes + token CSRF já obtido.
async function csrfAgent() {
  const agent = request.agent(app);
  const res = await agent.get('/api/csrf');
  return { agent, csrf: res.body.csrfToken };
}

describe('POST /api/auth/register', () => {
  it('cria o usuário, seta cookie de sessão e não vaza o hash', async () => {
    const email = newEmail();
    const { agent, csrf } = await csrfAgent();
    const res = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'Rangel', email, password });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, plan: 'free', level: 1 });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'].join(';')).toContain('nc_session=');

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored.passwordHash).not.toBe(password);
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('bloqueia sem token CSRF (403)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: newEmail(), password });
    expect(res.status).toBe(403);
  });

  it('rejeita senha fraca (400)', async () => {
    const { agent, csrf } = await csrfAgent();
    const res = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'X', email: newEmail(), password: 'fraca' });
    expect(res.status).toBe(400);
  });

  it('rejeita e-mail duplicado com mensagem genérica (409)', async () => {
    const email = newEmail();
    const a = await csrfAgent();
    await a.agent.post('/api/auth/register').set('x-csrf-token', a.csrf)
      .send({ name: 'A', email, password });
    const b = await csrfAgent();
    const res = await b.agent.post('/api/auth/register').set('x-csrf-token', b.csrf)
      .send({ name: 'B', email, password });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Não foi possível concluir o cadastro.');
  });
});

describe('POST /api/auth/login', () => {
  it('autentica com credenciais corretas', async () => {
    const email = newEmail();
    const reg = await csrfAgent();
    await reg.agent.post('/api/auth/register').set('x-csrf-token', reg.csrf)
      .send({ name: 'Rangel', email, password });

    const { agent, csrf } = await csrfAgent();
    const res = await agent.post('/api/auth/login').set('x-csrf-token', csrf)
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it('erro genérico para senha errada (401) — sem revelar se o e-mail existe', async () => {
    const email = newEmail();
    const reg = await csrfAgent();
    await reg.agent.post('/api/auth/register').set('x-csrf-token', reg.csrf)
      .send({ name: 'Rangel', email, password });

    const { agent, csrf } = await csrfAgent();
    const res = await agent.post('/api/auth/login').set('x-csrf-token', csrf)
      .send({ email, password: 'ErradaTotal9' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciais inválidas.');
  });

  it('mesmo erro genérico para e-mail inexistente (401)', async () => {
    const { agent, csrf } = await csrfAgent();
    const res = await agent.post('/api/auth/login').set('x-csrf-token', csrf)
      .send({ email: `nao-existe-${randomUUID()}@x.dev`, password });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciais inválidas.');
  });
});

describe('GET /api/auth/me e POST /api/auth/logout', () => {
  it('401 sem sessão', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('devolve o usuário logado e depois desloga', async () => {
    const email = newEmail();
    const { agent, csrf } = await csrfAgent();
    await agent.post('/api/auth/register').set('x-csrf-token', csrf)
      .send({ name: 'Rangel', email, password });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    const out = await agent.post('/api/auth/logout').set('x-csrf-token', csrf).send({});
    expect(out.status).toBe(200);

    const after = await agent.get('/api/auth/me');
    expect(after.status).toBe(401);
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});
```

- [ ] **Step 3: Escrever o teste de rate-limit (arquivo isolado)**

> Arquivo separado para um store de rate-limit limpo (cada arquivo de teste do Vitest tem seu próprio registro de módulos → `app` e o limiter são novos).

`server/tests/auth.ratelimit.test.js`:
```js
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/db/client.js';

const email = `rl-${randomUUID()}@neurocode.dev`;

async function csrfAgent() {
  const agent = request.agent(app);
  const res = await agent.get('/api/csrf');
  return { agent, csrf: res.body.csrfToken };
}

describe('rate-limit no login', () => {
  it('bloqueia (429) após 5 tentativas falhas', async () => {
    const { agent, csrf } = await csrfAgent();
    const attempt = () =>
      agent.post('/api/auth/login').set('x-csrf-token', csrf)
        .send({ email, password: 'ErradaTotal9' });

    for (let i = 0; i < 5; i++) {
      const r = await attempt();
      expect(r.status).toBe(401);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('Muitas tentativas. Tente novamente mais tarde.');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 4: Rodar e confirmar que falham**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/routes/auth.js`, `../src/middleware/auth.js` e `../src/middleware/rateLimit.js` não existem; não há rotas em `/api/auth`.

- [ ] **Step 5: Implementar guard, rate-limit e rotas**

`server/src/middleware/auth.js`:
```js
import { getUserBySessionId, SESSION_COOKIE } from '../auth/session.js';

export async function requireAuth(req, res, next) {
  try {
    const sessionId = req.signedCookies?.[SESSION_COOKIE];
    const user = await getUserBySessionId(sessionId);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
```

`server/src/middleware/rateLimit.js`:
```js
import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) =>
    res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' }),
});
```

`server/src/routes/auth.js`:
```js
import { Router } from 'express';
import prisma from '../db/client.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { registerSchema, loginSchema } from '../lib/validation.js';
import {
  createSession,
  destroySession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../auth/session.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = Router();

function toPublicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    plan: u.plan,
    xp: u.xp,
    level: u.level,
    neuroPoints: u.neuroPoints,
    streak: u.streak,
  };
}

router.post('/register', verifyCsrf, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        issues: parsed.error.flatten().fieldErrors,
      });
    }
    const { name, email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Não foi possível concluir o cadastro.' });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });
    const sessionId = await createSession(user.id);
    res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions);
    res.status(201).json({ user: toPublicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post('/login', loginLimiter, verifyCsrf, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = user ? await verifyPassword(user.passwordHash, password) : false;
    if (!user || !ok) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const sessionId = await createSession(user.id);
    res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions);
    res.json({ user: toPublicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', verifyCsrf, requireAuth, async (req, res, next) => {
  try {
    await destroySession(req.signedCookies[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

export default router;
```

- [ ] **Step 6: Montar o router de auth no `app.js`**

Em `server/src/app.js`, adicionar o import e montar **depois** do health e **antes** do `notFound`:
```js
import authRouter from './routes/auth.js';
// ...
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);

app.use(notFound);
app.use(errorHandler);
```

- [ ] **Step 7: Rodar e confirmar que passam**

Run:
```bash
cd server && npm test
```
Expected: PASS — `auth.test.js` (todos) + `auth.ratelimit.test.js` (1), e as suítes anteriores seguem verdes.

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/package-lock.json server/src/middleware/auth.js server/src/middleware/rateLimit.js server/src/routes/auth.js server/src/app.js server/tests/auth.test.js server/tests/auth.ratelimit.test.js
git commit -m "feat(server): rotas de auth (register/login/logout/me) com guard e rate-limit"
```

---

### Task 7: Frontend — AuthContext, telas reais, guarda de rotas e client ciente de CSRF

Telas de Login/Register funcionais, um `AuthContext` que conhece o usuário atual, um `ProtectedRoute` que manda visitantes não autenticados para `/login`, uma `Dashboard` placeholder protegida, e o client de API enviando o header CSRF. Também corrige a higiene de testes herdada da Fase 1 (assertivas assíncronas + future flags do Router).

**Files:**
- Modify: `web/src/lib/api.js` (CSRF + `ApiError`)
- Create: `web/src/context/AuthContext.jsx`
- Create: `web/src/components/ProtectedRoute.jsx`
- Create: `web/src/pages/Login.jsx`
- Create: `web/src/pages/Register.jsx`
- Create: `web/src/pages/Dashboard.jsx`
- Create: `web/src/styles/auth.css`
- Modify: `web/src/App.jsx` (rotas reais + `/dashboard` protegida)
- Modify: `web/src/main.jsx` (AuthProvider + future flags + import de `auth.css`)
- Modify: `web/tests/App.test.jsx` (higiene: `findByRole`, future flags, AuthProvider)
- Modify: `web/tests/Landing.test.jsx` (higiene: `findByRole`/`findByText`, `afterEach(unstubAllGlobals)`, future flags)
- Test: `web/tests/Auth.test.jsx`

**Interfaces:**
- Consumes: `POST /api/auth/register|login|logout`, `GET /api/auth/me`, `GET /api/csrf` (Tasks 4 e 6); o `apiGet`/`apiPost` existentes (reescritos).
- Produces:
  - `web/src/lib/api.js`: `apiGet(path)` e `apiPost(path, body)` mantêm a assinatura; `apiPost` agora obtém o token CSRF (cookie `nc_csrf`, buscando `/api/csrf` se ausente) e envia `X-CSRF-Token`. Erros lançam `ApiError` (export nomeado) com `.status` e `.message` vindo de `error` do corpo.
  - `useAuth()` (hook) e `AuthProvider` (componente) — exports de `web/src/context/AuthContext.jsx`. Contexto expõe `{ user, loading, login(email,password), register(name,email,password), logout(), refresh() }`. No mount chama `GET /api/auth/me` e popula `user` (ou `null`). `login`/`register` setam `user` a partir de `res.user`.
  - `ProtectedRoute` (default de `web/src/components/ProtectedRoute.jsx`): enquanto `loading` renderiza `null`; sem `user` → `<Navigate to="/login" replace />`; com `user` → `<Outlet />`.
  - Páginas `Login`, `Register`, `Dashboard` (defaults). `App.jsx` mapeia `/` (Landing), `/login`, `/register`, e `/dashboard` dentro de `<ProtectedRoute>`.

- [ ] **Step 1: Reescrever o client de API (CSRF + ApiError)**

`web/src/lib/api.js`:
```js
const BASE = '/api';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function readCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

async function csrfToken() {
  let token = readCookie('nc_csrf');
  if (!token) {
    await fetch(`${BASE}/csrf`, { credentials: 'include' });
    token = readCookie('nc_csrf');
  }
  return token ?? '';
}

async function parse(res, path) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `${path} falhou (${res.status})`, res.status, data);
  }
  return data;
}

export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  return parse(res, `GET ${path}`);
}

export async function apiPost(path, body) {
  const token = await csrfToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return parse(res, `POST ${path}`);
}
```

- [ ] **Step 2: Escrever o teste que falha (registro + guarda de rota)**

`web/tests/Auth.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

// Roteador de fetch fake para os endpoints de auth/csrf.
function mockApi({ me = null } = {}) {
  return vi.fn((url, opts = {}) => {
    if (url.endsWith('/api/csrf')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ csrfToken: 't' }) });
    }
    if (url.endsWith('/api/auth/me')) {
      return me
        ? Promise.resolve({ ok: true, json: () => Promise.resolve({ user: me }) })
        : Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Não autenticado.' }) });
    }
    if (url.endsWith('/api/auth/register')) {
      const body = JSON.parse(opts.body);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { id: 1, name: body.name, email: body.email, plan: 'free', xp: 0, level: 1, neuroPoints: 0, streak: 0 } }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockApi());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Guarda de rotas', () => {
  it('redireciona visitante não autenticado de /dashboard para /login', async () => {
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument();
  });
});

describe('Cadastro', () => {
  it('cria conta e cai na dashboard', async () => {
    vi.stubGlobal('fetch', mockApi());
    renderAt('/register');
    fireEvent.change(await screen.findByLabelText(/nome/i), { target: { value: 'Rangel' } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'r@neuro.dev' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'Sup3rSecret' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run:
```bash
cd web && npm test
```
Expected: FAIL — `../src/context/AuthContext.jsx` não existe; não há rota `/dashboard` nem formulários reais.

- [ ] **Step 4: Implementar contexto, guarda, páginas e estilos**

`web/src/context/AuthContext.jsx`:
```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { user } = await apiGet('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email, password) {
    const { user } = await apiPost('/auth/login', { email, password });
    setUser(user);
    return user;
  }

  async function register(name, email, password) {
    const { user } = await apiPost('/auth/register', { name, email, password });
    setUser(user);
    return user;
  }

  async function logout() {
    await apiPost('/auth/logout', {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa de um AuthProvider.');
  return ctx;
}
```

`web/src/components/ProtectedRoute.jsx`:
```jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

`web/src/pages/Login.jsx`:
```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Header />
      <main className="auth-page container">
        <h1>Entrar</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary">Entrar</button>
        </form>
        <p className="auth-alt">
          Não tem conta? <Link to="/register">Criar conta</Link>
        </p>
      </main>
    </>
  );
}
```

`web/src/pages/Register.jsx`:
```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Header />
      <main className="auth-page container">
        <h1>Criar conta</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="name">Nome</label>
          <input id="name" type="text" value={name}
            onChange={(e) => setName(e.target.value)} required />
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          <p className="auth-hint">Mín. 8 caracteres, com maiúscula, minúscula e número.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary">Criar conta</button>
        </form>
        <p className="auth-alt">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </main>
    </>
  );
}
```

`web/src/pages/Dashboard.jsx`:
```jsx
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
        <button className="btn btn-ghost" onClick={logout}>Sair</button>
      </main>
    </>
  );
}
```

`web/src/styles/auth.css`:
```css
.auth-page {
  max-width: 420px;
  padding: 60px 0;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 18px;
}
.auth-form label {
  font-size: 0.85rem;
  color: var(--c-text-dim, #b9b6d8);
  margin-top: 10px;
}
.auth-form input {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--c-border, #2D2860);
  background: var(--c-surface, #181433);
  color: var(--c-text, #fff);
}
.auth-form .btn {
  margin-top: 18px;
}
.auth-hint {
  font-size: 0.8rem;
  color: var(--c-text-dim, #b9b6d8);
}
.auth-error {
  color: var(--c-pink, #FF6B9D);
  font-size: 0.9rem;
}
.auth-alt {
  margin-top: 18px;
  font-size: 0.9rem;
}
.dash-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  list-style: none;
  padding: 0;
  margin: 18px 0;
}
.dash-stats li {
  background: var(--c-surface, #181433);
  border: 1px solid var(--c-border, #2D2860);
  border-radius: 10px;
  padding: 12px 16px;
}
```

- [ ] **Step 5: Conectar rotas (`App.jsx`) e providers (`main.jsx`)**

`web/src/App.jsx`:
```jsx
import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
```

`web/src/main.jsx`:
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/landing.css';
import './styles/auth.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 6: Corrigir a higiene dos testes herdados**

`web/tests/App.test.jsx` (envolver com AuthProvider + future flags + fetch stub p/ `/auth/me` e `findByRole`):
```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      url.endsWith('/api/auth/me')
        ? Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'x' }) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
    )
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App — roteamento', () => {
  it('renderiza a landing em "/"', async () => {
    render(
      <MemoryRouter initialEntries={['/']} future={future}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(
      await screen.findByRole('heading', { name: /seu código/i })
    ).toBeInTheDocument();
  });
});
```

`web/tests/Landing.test.jsx` (trocar `getByRole`/`getByText` síncronos por `findBy*`, adicionar `afterEach(unstubAllGlobals)` e future flags; envolver com AuthProvider porque o Header usa o contexto):
```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      url.endsWith('/api/auth/me')
        ? Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'x' }) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
    )
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Landing', () => {
  it('mostra o heading do hero', async () => {
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: /seu código/i })
    ).toBeInTheDocument();
  });

  it('navega para /register ao clicar em "Comece grátis"', async () => {
    renderApp('/');
    fireEvent.click((await screen.findAllByRole('link', { name: /comece grátis/i }))[0]);
    expect(
      await screen.findByRole('heading', { name: /criar conta/i })
    ).toBeInTheDocument();
  });

  it('exibe "API online" quando /api/health responde ok', async () => {
    renderApp('/');
    expect(await screen.findByText(/api online/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Rodar e confirmar que passa (sem ruído no stderr)**

Run:
```bash
cd web && npm test
```
Expected: PASS — `Auth.test.jsx` (2) + `App.test.jsx` (1) + `Landing.test.jsx` (3), sem warnings de `act()` nem de future-flag do Router no stderr.

- [ ] **Step 8: Commit**

```bash
git add web/src web/tests
git commit -m "feat(web): AuthContext, telas de login/cadastro, guarda de rotas e dashboard"
```

---

### Task 8: Critério de saída — npm audit, env/docs e verificação ponta-a-ponta

Fechar a fase: zero vulnerabilidades altas/críticas no `npm audit`, documentar `SESSION_SECRET`/`CORS_ORIGIN`, atualizar o guia e provar o fluxo manual register → dashboard → logout.

**Files:**
- Modify: `server/.env.example` (SESSION_SECRET, CORS_ORIGIN)
- Modify: `server/.env` (local, ignorado — adiciona SESSION_SECRET para o dev rodar assinado)
- Modify: `web/package.json` (campo `engines`)
- Modify: `GETTING-STARTED.md` (passo de `SESSION_SECRET` + nota de auth)

**Interfaces:**
- Consumes: tudo das Tasks 1–7.
- Produces: documentação e configuração de saída; nenhum símbolo de código novo.

- [ ] **Step 1: Rodar a suíte inteira a partir da raiz**

Run:
```bash
npm test
```
Expected: PASS — server (todas as suítes) e web (6 testes) verdes.

- [ ] **Step 2: Auditar dependências (critério de saída)**

Run:
```bash
cd server && npm audit --audit-level=high ; cd ../web && npm audit --audit-level=high
```
Expected: **0 vulnerabilidades de severidade high/critical** em ambos. Se aparecerem, rodar `npm audit fix` (sem `--force`); se sobrarem só transitivas low/moderate, registrar no relatório (aceitáveis no protótipo). Se uma high/critical exigir `--force` (breaking), **não aplicar** — reportar como DONE_WITH_CONCERNS com a vuln e a correção sugerida.

- [ ] **Step 3: Documentar os segredos no `.env.example`**

`server/.env.example` (substituir o conteúdo):
```
DATABASE_URL="file:./dev.db"
PORT=4000
# Segredo p/ assinar o cookie de sessão (obrigatório em produção).
# Gere um valor forte, ex.: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
SESSION_SECRET="troque-por-um-segredo-forte"
# Origem do frontend permitida no CORS (com credenciais).
CORS_ORIGIN="http://localhost:5173"
# CLAUDE_API_KEY=    # opcional — liga a geração de exercícios ao vivo (fases futuras)
```

- [ ] **Step 4: Adicionar `SESSION_SECRET` ao `.env` local (ignorado)**

Em `server/.env` (arquivo local, coberto pelo `.gitignore`), acrescentar uma linha com um segredo de dev real:
```
SESSION_SECRET="dev-troque-por-um-valor-aleatorio-forte"
CORS_ORIGIN="http://localhost:5173"
```
> Confirme depois que `server/.env` **não** aparece em `git status` (continua ignorado).

- [ ] **Step 5: Adicionar `engines` ao `web/package.json`**

Em `web/package.json`, logo após `"type": "module",`, inserir:
```json
  "engines": {
    "node": ">=18"
  },
```

- [ ] **Step 6: Atualizar o `GETTING-STARTED.md`**

Em `GETTING-STARTED.md`, na seção **"Setup (uma vez)"**, após o bloco de comandos atual, acrescentar:
```markdown

### Segredo de sessão (auth)
Copie `server/.env.example` para `server/.env` e defina um `SESSION_SECRET` forte
(o login/cadastro usam-no para assinar o cookie de sessão httpOnly). Em desenvolvimento,
sem o valor o app usa um segredo inseguro só para não travar.
```
E na seção que descreve as rotas/uso, adicionar uma linha:
```markdown
- Auth: `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` (sessão por cookie httpOnly; CSRF via header `X-CSRF-Token`).
```

- [ ] **Step 7: Verificação manual ponta-a-ponta**

Run:
```bash
npm run dev
```
No navegador (http://localhost:5173): abrir `/register`, criar uma conta (senha forte, ex.: `Sup3rSecret`), confirmar redirecionamento para `/dashboard` mostrando "Olá, <nome>"; clicar **Sair** e confirmar volta ao estado deslogado; tentar abrir `/dashboard` direto → redireciona para `/login`. Encerrar com `Ctrl+C`.

- [ ] **Step 8: Commit**

```bash
git add server/.env.example web/package.json GETTING-STARTED.md
git commit -m "chore: documenta SESSION_SECRET/CORS, engines e guia de auth"
```

---

## Critério de sucesso da Fase 2

- `npm test` (raiz) verde: server (health, db, isolation, app, password, validation, csrf, session, auth, auth.ratelimit) + web (6).
- Os testes do server rodam contra `prisma/test.db` — `dev.db` nunca é tocado.
- Fluxo real no navegador: cadastrar → cair na dashboard → deslogar → `/dashboard` protegida redireciona para `/login`.
- Senhas guardadas como hash argon2id; sessão por cookie httpOnly assinado; login com rate-limit e erros genéricos; escrita protegida por CSRF.
- `npm audit --audit-level=high` sem vulnerabilidades altas/críticas.

## Fora de escopo (fica para fases seguintes)

- Onboarding (quiz de perfil) e conteúdo da dashboard real → Fase 3+.
- `prisma db seed` configurado (bloco `"prisma":{"seed"}`) → Fase 3 (quando houver roadmap/matérias a semear).
- Verificação de e-mail, recuperação de senha, "lembrar-me", refresh de sessão → pós-protótipo.
- OAuth / login social → fora de escopo do protótipo (YAGNI).

## Próxima fase (preview)

**Fase 3 — Conteúdo + Roadmap:** seed do roadmap Desenvolvedor Front-end (HTML → CSS → JS) e telas de roadmap/matéria/aula. Consome o `User` autenticado e o `requireAuth` desta fase para proteger as rotas de conteúdo e progresso.
