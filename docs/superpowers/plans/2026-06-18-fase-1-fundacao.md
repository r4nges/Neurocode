# Fase 1 — Fundação · Plano de Implementação (NeuroCode)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar o esqueleto full-stack do protótipo NeuroCode — API Node/Express com SQLite via Prisma, e app React/Vite com o design system portado e a landing — provando a integração frontend↔backend de ponta a ponta.

**Architecture:** Dois pacotes npm independentes no mesmo repo: `server/` (Express + Prisma/SQLite, testado com Vitest + Supertest) e `web/` (React + Vite + React Router, testado com Vitest + Testing Library). Em dev o Vite faz proxy de `/api` para a API. Cada tarefa entrega software testável.

**Tech Stack:** Node 18+ (ESM), Express 4, Prisma 5 + SQLite, React 18, Vite 5, react-router-dom 6, Vitest 2, Supertest, @testing-library/react, jsdom, dotenv, concurrently.

## Global Constraints

- **Node.js 18+** (recomendado 20 LTS). Gerenciador: **npm**.
- `server/` e `web/` são **ESM** (`"type": "module"`).
- API em **`http://localhost:4000`**, prefixo de rotas **`/api`**.
- Banco: **SQLite via Prisma 5**, `DATABASE_URL="file:./dev.db"` (arquivo em `server/prisma/dev.db`).
- Frontend: **Vite na porta 5173**, proxy de `/api` → `http://localhost:4000`.
- Testes: **Vitest** (`npm test` = `vitest run`). Backend usa Supertest; frontend usa `@testing-library/react` + jsdom.
- Os **design tokens** são copiados *verbatim* dos arquivos legados já presentes no repo: `static/css/variables.css`, `static/css/base.css`, `static/css/components.css`.
- O `.gitignore` raiz já existe e ignora `node_modules/`, `*.db`, `*.sqlite`, `.env` (mantém `.env.example`), `__pycache__/` e `data/inscricoes.json`.
- **Toda mensagem de commit termina com os dois trailers padrão** (anexar ao final, omitidos dos passos por brevidade):
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WzgYtLnPcMp8EPaUQq9xsY
  ```
- Todos os comandos rodam a partir da raiz do repo (`Trabalho Neurocode/`), com `cd` explícito para `server/` ou `web/` quando indicado.

---

### Task 1: Backend scaffold + endpoint de health

**Files:**
- Create: `server/package.json`
- Create: `server/src/app.js`
- Create: `server/src/index.js`
- Create: `server/src/routes/health.js`
- Test: `server/tests/health.test.js`

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces: `app` — export default de `server/src/app.js`, uma aplicação Express com `app.use(express.json())` e a rota **`GET /api/health` → 200 `{ status: 'ok' }`**. `server/src/index.js` importa `app` e chama `app.listen(process.env.PORT || 4000)`.

- [ ] **Step 1: Criar `server/package.json` e instalar dependências**

`server/package.json`:
```json
{
  "name": "neurocode-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "test": "vitest run",
    "seed": "node prisma/seed.js",
    "migrate": "prisma migrate dev"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^2.1.0"
  }
}
```

Run:
```bash
cd server && npm install
```
Expected: cria `node_modules/` e `package-lock.json` sem erros.

- [ ] **Step 2: Escrever o teste que falha**

`server/tests/health.test.js`:
```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/health', () => {
  it('responde 200 com { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — não consegue resolver `../src/app.js` (módulo inexistente).

- [ ] **Step 4: Implementar a rota, o app e o bootstrap**

`server/src/routes/health.js`:
```js
import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
```

`server/src/app.js`:
```js
import express from 'express';
import healthRouter from './routes/health.js';

const app = express();
app.use(express.json());
app.use('/api', healthRouter);

export default app;
```

`server/src/index.js`:
```js
import app from './app.js';

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`NeuroCode API em http://localhost:${PORT}`);
});
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS (1 teste).

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/package-lock.json server/src server/tests
git commit -m "feat(server): scaffold Express + endpoint /api/health com teste"
```

---

### Task 2: Prisma + SQLite + modelo User + client + seed scaffold

**Files:**
- Modify: `server/package.json` (adiciona deps Prisma/dotenv)
- Create: `server/prisma/schema.prisma`
- Create: `server/src/db/client.js`
- Create: `server/prisma/seed.js`
- Create: `server/.env`
- Create: `server/.env.example`
- Modify: `server/src/index.js` (carrega dotenv)
- Test: `server/tests/db.test.js`

**Interfaces:**
- Consumes: nada do código da Task 1 (independente).
- Produces:
  - `prisma` — export default de `server/src/db/client.js`, instância única de `PrismaClient` (com `import 'dotenv/config'` no topo para carregar `DATABASE_URL`).
  - Modelo **`User`**: `id Int @id @default(autoincrement())`, `name String`, `email String @unique`, `passwordHash String`, `plan String @default("free")`, `xp Int @default(0)`, `level Int @default(1)`, `neuroPoints Int @default(0)`, `streak Int @default(0)`, `lastActiveDate DateTime?`, `createdAt DateTime @default(now())`.

- [ ] **Step 1: Instalar Prisma e dotenv**

Run:
```bash
cd server && npm install @prisma/client dotenv && npm install -D prisma
```
Expected: deps adicionadas ao `package.json` sem erros.

- [ ] **Step 2: Criar `.env` e `.env.example`**

`server/.env` (NÃO versionado — coberto pelo `.gitignore`):
```
DATABASE_URL="file:./dev.db"
PORT=4000
# CLAUDE_API_KEY=    # opcional — liga a geração de exercícios ao vivo (fases futuras)
```

`server/.env.example` (versionado):
```
DATABASE_URL="file:./dev.db"
PORT=4000
# CLAUDE_API_KEY=    # opcional — liga a geração de exercícios ao vivo (fases futuras)
```

- [ ] **Step 3: Escrever o teste que falha**

`server/tests/db.test.js`:
```js
import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../src/db/client.js';

const email = `test-${randomUUID()}@neurocode.dev`;

describe('Modelo User', () => {
  it('cria e lê um usuário com os defaults corretos', async () => {
    const created = await prisma.user.create({
      data: { name: 'Teste', email, passwordHash: 'x' },
    });
    expect(typeof created.id).toBe('number');
    expect(created.plan).toBe('free');
    expect(created.level).toBe(1);
    expect(created.xp).toBe(0);

    const found = await prisma.user.findUnique({ where: { email } });
    expect(found?.name).toBe('Teste');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run:
```bash
cd server && npm test
```
Expected: FAIL — `../src/db/client.js` não existe (e o client Prisma ainda não foi gerado).

- [ ] **Step 5: Criar o schema do Prisma**

`server/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

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
}
```

- [ ] **Step 6: Rodar a migração (gera o banco e o client)**

Run:
```bash
cd server && npx prisma migrate dev --name init
```
Expected: cria `server/prisma/dev.db`, `server/prisma/migrations/<timestamp>_init/`, e gera o `@prisma/client`. Confirma a mensagem "Your database is now in sync with your schema".

- [ ] **Step 7: Criar o client singleton, o seed scaffold e carregar dotenv no index**

`server/src/db/client.js`:
```js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
```

`server/prisma/seed.js`:
```js
import prisma from '../src/db/client.js';

async function main() {
  console.log('Seed: nada para semear ainda (o conteúdo entra na Fase 3).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

`server/src/index.js` (substituir o conteúdo para carregar o `.env`):
```js
import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`NeuroCode API em http://localhost:${PORT}`);
});
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run:
```bash
cd server && npm test
```
Expected: PASS (2 arquivos de teste, todos verdes).

- [ ] **Step 9: Commit**

```bash
git add server/package.json server/package-lock.json server/prisma server/src/db server/src/index.js server/.env.example server/tests/db.test.js
git commit -m "feat(server): Prisma + SQLite, modelo User e client singleton"
```
> Confirme que `server/.env` e `server/prisma/dev.db` **não** aparecem em `git status` (devem estar ignorados).

---

### Task 3: Frontend scaffold (Vite + React + Router + tokens) + setup de testes

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.js`
- Create: `web/index.html`
- Create: `web/src/test/setup.js`
- Create: `web/src/styles/variables.css` (cópia de `static/css/variables.css`)
- Create: `web/src/styles/base.css` (cópia de `static/css/base.css`)
- Create: `web/src/main.jsx`
- Create: `web/src/App.jsx`
- Test: `web/tests/App.test.jsx`

**Interfaces:**
- Consumes: nada (frontend independente nesta fase; a integração com a API vem na Task 4).
- Produces: `App` — export default de `web/src/App.jsx`, define `<Routes>` com a rota `/` renderizando uma Landing placeholder cujo `<h1>` é **"Seu cérebro, seu ritmo, seu código."**. O `<BrowserRouter>` é provido por `main.jsx`; os testes envolvem `App` em `<MemoryRouter>`.

- [ ] **Step 1: Criar `web/package.json` e instalar dependências**

`web/package.json`:
```json
{
  "name": "neurocode-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

Run:
```bash
cd web && npm install
```
Expected: instala sem erros.

- [ ] **Step 2: Criar config do Vite/Vitest, setup de teste, index.html e copiar tokens**

`web/vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
});
```

`web/src/test/setup.js`:
```js
import '@testing-library/jest-dom';
```

`web/index.html`:
```html
<!doctype html>
<html lang="pt-BR" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NeuroCode</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Caveat:wght@600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Copiar os tokens (a partir de `web/`):
```bash
cd web && mkdir -p src/styles && \
cp ../static/css/variables.css src/styles/variables.css && \
cp ../static/css/base.css src/styles/base.css
```
Expected: os dois arquivos existem em `web/src/styles/`.

- [ ] **Step 3: Escrever o teste que falha**

`web/tests/App.test.jsx`:
```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

describe('App — roteamento', () => {
  it('renderiza a landing em "/"', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(
      screen.getByRole('heading', { name: /seu código/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run:
```bash
cd web && npm test
```
Expected: FAIL — `../src/App.jsx` não existe.

- [ ] **Step 5: Implementar `App.jsx` e `main.jsx`**

`web/src/App.jsx`:
```jsx
import { Routes, Route } from 'react-router-dom';

function Landing() {
  return <h1>Seu cérebro, seu ritmo, seu código.</h1>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
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
import './styles/variables.css';
import './styles/base.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run:
```bash
cd web && npm test
```
Expected: PASS (1 teste).

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/package-lock.json web/vite.config.js web/index.html web/src
git commit -m "feat(web): scaffold Vite + React + Router com tokens portados"
```

---

### Task 4: Landing real (Header + Hero + CTA) + client de API + wiring de health

**Files:**
- Create: `web/src/lib/api.js`
- Create: `web/src/components/Header.jsx`
- Create: `web/src/pages/Landing.jsx`
- Create: `web/src/styles/landing.css`
- Create: `web/src/styles/components.css` (cópia de `static/css/components.css`)
- Modify: `web/src/App.jsx` (usa a página `Landing` real + rotas placeholder `/login` e `/register`)
- Modify: `web/src/main.jsx` (importa `components.css` e `landing.css`)
- Test: `web/tests/Landing.test.jsx`

**Interfaces:**
- Consumes: `App`/`Landing` da Task 3 (substitui a Landing placeholder pela página real, mantendo o `<h1>` "Seu cérebro, seu ritmo, seu código."); endpoint `GET /api/health` da Task 1.
- Produces:
  - `apiGet(path)` e `apiPost(path, body)` — exports nomeados de `web/src/lib/api.js`; fazem `fetch` em `/api${path}` com `credentials: 'include'` e retornam o JSON (lançam `Error` em status não-ok).
  - Páginas placeholder no `App`: `/login` → `<h1>Entrar</h1>`, `/register` → `<h1>Criar conta</h1>` (preenchidas na Fase 2).

- [ ] **Step 1: Copiar `components.css`, criar `landing.css` e importá-los**

Copiar (a partir de `web/`):
```bash
cd web && cp ../static/css/components.css src/styles/components.css
```

`web/src/styles/landing.css`:
```css
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--c-border, #2D2860);
}
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
}
.brand {
  font-size: 1.25rem;
  text-decoration: none;
  color: var(--c-text, #fff);
}
.brand .accent {
  color: var(--c-cyan, #00CFFF);
}
.nav-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.hero {
  text-align: center;
  padding: 80px 0 100px;
}
.hero h1 {
  font-size: clamp(2.2rem, 5vw, 3.4rem);
  line-height: 1.1;
  margin-bottom: 18px;
}
.hero-lead {
  max-width: 620px;
  margin: 0 auto 28px;
  color: var(--c-text-dim, #b9b6d8);
  font-size: 1.1rem;
}
.hero-cta {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}
.api-status {
  margin-top: 26px;
  font-size: 0.85rem;
  color: var(--c-green, #00C896);
}
.api-status.off {
  color: var(--c-pink, #FF6B9D);
}
```

`web/src/main.jsx` (acrescentar os dois imports de CSS após os existentes):
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/landing.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 2: Escrever o teste que falha**

`web/tests/Landing.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
    )
  );
});

describe('Landing', () => {
  it('mostra o heading do hero', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(
      screen.getByRole('heading', { name: /seu código/i })
    ).toBeInTheDocument();
  });

  it('navega para /register ao clicar em "Comece grátis"', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    fireEvent.click(screen.getAllByRole('link', { name: /comece grátis/i })[0]);
    expect(
      await screen.findByRole('heading', { name: /criar conta/i })
    ).toBeInTheDocument();
  });

  it('exibe "API online" quando /api/health responde ok', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByText(/api online/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run:
```bash
cd web && npm test
```
Expected: FAIL — `../src/pages/Landing.jsx` / `../src/lib/api.js` não existem e não há rota `/register`.

- [ ] **Step 4: Implementar `api.js`, `Header.jsx`, `Landing.jsx` e atualizar `App.jsx`**

`web/src/lib/api.js`:
```js
const BASE = '/api';

export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET ${path} falhou: ${res.status}`);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} falhou: ${res.status}`);
  return res.json();
}
```

`web/src/components/Header.jsx`:
```jsx
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="site-header">
      <nav className="nav container">
        <Link to="/" className="brand">
          <b>Neuro</b><span className="accent">Code</span>
        </Link>
        <div className="nav-actions">
          <Link to="/login" className="btn btn-ghost btn-sm">Entrar</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Comece grátis</Link>
        </div>
      </nav>
    </header>
  );
}
```

`web/src/pages/Landing.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGet } from '../lib/api.js';

export default function Landing() {
  const [apiOk, setApiOk] = useState(null);

  useEffect(() => {
    apiGet('/health')
      .then((d) => setApiOk(d.status === 'ok'))
      .catch(() => setApiOk(false));
  }, []);

  return (
    <>
      <Header />
      <main className="hero">
        <div className="container">
          <h1>Seu cérebro, seu ritmo, seu código.</h1>
          <p className="hero-lead">
            A plataforma de programação que se adapta a como você aprende.
            Trilhas gamificadas, exercícios gerados por IA e progresso no seu ritmo.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary">Comece grátis</Link>
            <Link to="/login" className="btn btn-ghost">Entrar</Link>
          </div>
          {apiOk === true && <p className="api-status">● API online</p>}
          {apiOk === false && <p className="api-status off">● API offline</p>}
        </div>
      </main>
    </>
  );
}
```

`web/src/App.jsx` (substituir o conteúdo):
```jsx
import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';

function Login() {
  return <h1>Entrar</h1>;
}

function Register() {
  return <h1>Criar conta</h1>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run:
```bash
cd web && npm test
```
Expected: PASS — `App.test.jsx` (1) + `Landing.test.jsx` (3), todos verdes.

- [ ] **Step 6: Commit**

```bash
git add web/src web/package.json
git commit -m "feat(web): landing com header/hero/CTA, client de API e status de health"
```

---

### Task 5: Orquestração na raiz + guia de execução + verificação da fundação

**Files:**
- Create: `package.json` (raiz)
- Create: `GETTING-STARTED.md` (raiz)
- Modify: `README.md` (raiz — uma linha apontando para o guia)

**Interfaces:**
- Consumes: scripts `dev`/`test` de `server/` (Tasks 1–2) e `web/` (Tasks 3–4).
- Produces: na raiz, `npm run dev` sobe API + web juntos (via `concurrently`); `npm test` roda as duas suítes; `npm run setup` instala ambos os pacotes.

- [ ] **Step 1: Criar `package.json` na raiz e instalar `concurrently`**

`package.json` (raiz):
```json
{
  "name": "neurocode",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "setup": "npm --prefix server install && npm --prefix web install",
    "dev": "concurrently -n api,web -c blue,magenta \"npm --prefix server run dev\" \"npm --prefix web run dev\"",
    "test": "npm --prefix server test && npm --prefix web test"
  },
  "devDependencies": {
    "concurrently": "^9.0.1"
  }
}
```

Run (a partir da raiz):
```bash
npm install
```
Expected: instala `concurrently` na raiz.

- [ ] **Step 2: Criar o guia de execução**

`GETTING-STARTED.md`:
```markdown
# NeuroCode — Como rodar (protótipo)

## Pré-requisitos
- Node.js 18+ (recomendado 20 LTS) e npm.

## Setup (uma vez)
```bash
npm run setup
cd server && npx prisma migrate dev --name init && cd ..
```

## Rodar em desenvolvimento
```bash
npm run dev
```
- API: http://localhost:4000 (teste: http://localhost:4000/api/health)
- App: http://localhost:5173

O Vite faz proxy de `/api` para a API, então o front fala com o back sem CORS.

## Rodar os testes
```bash
npm test
```

## Ligar a IA real (opcional, fases futuras)
Copie `server/.env.example` para `server/.env` e preencha `CLAUDE_API_KEY`.
Sem a chave, o protótipo roda 100% offline.

> A landing/marketing legada (Flask + HTML estático) continua em `app.py` e `static/`
> apenas como referência de design — não faz parte do app Node/React.
```

- [ ] **Step 3: Apontar o README para o guia**

Em `README.md`, logo abaixo do título principal (primeira linha `# ...`), inserir:
```markdown

> 🚧 **Protótipo da plataforma (Node + React):** veja [GETTING-STARTED.md](GETTING-STARTED.md).
> O conteúdo abaixo descreve a landing legada (Flask), mantida como referência de design.
```

- [ ] **Step 4: Verificar a fundação inteira (testes)**

Run (a partir da raiz):
```bash
npm test
```
Expected: as duas suítes passam — `server` (2 arquivos) e `web` (2 arquivos), todos verdes.

- [ ] **Step 5: Verificar o end-to-end manualmente**

Run:
```bash
npm run dev
```
Em outro terminal:
```bash
curl http://localhost:4000/api/health
```
Expected: `{"status":"ok"}`. Abrir http://localhost:5173 e confirmar a landing com o hero e o selo **"● API online"**. Encerrar com `Ctrl+C`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json GETTING-STARTED.md README.md
git commit -m "chore: orquestração na raiz (dev/test/setup) e guia de execução"
```

---

## Critério de sucesso da Fase 1

- `npm run setup` + migração + `npm run dev` sobem API (4000) e app (5173).
- A landing renderiza com o design system portado (paleta roxo/ciano, fontes) e mostra **"API online"** — prova de que frontend e backend se falam.
- `npm test` verde nas duas suítes.
- Banco SQLite criado via Prisma, com o modelo `User` pronto para a Fase 2 (auth).

## Próxima fase (preview)

**Fase 2 — Auth segura:** registro/login com hash argon2id, sessão por cookie httpOnly, validação (zod), rate-limit, CSRF, e guarda de rotas no React. Consome o modelo `User` e as páginas placeholder `/login` e `/register` criadas aqui.
