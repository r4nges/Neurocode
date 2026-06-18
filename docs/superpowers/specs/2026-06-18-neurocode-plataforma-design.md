# NeuroCode — Plataforma de Ensino Adaptativa · Documento de Design

> **Status:** ✅ Design aprovado (2 partes) · Pronto para plano de implementação
> **Data:** 2026-06-18
> **Tipo:** Protótipo funcional (fatia vertical)
> **Home organizacional:** `Neuro/03 Projetos/NeuroCode/` (Vault Obsidian)

---

## Visão geral

NeuroCode é uma plataforma de ensino de linguagens de programação **adaptativa**, *powered by* IA.
A analogia é um **Duolingo para programação**: as tarefas são geradas/selecionadas por IA conforme
as dificuldades e necessidades de cada aluno em cada matéria. O ensino é **gamificado** (XP, níveis,
badges, streaks, ranking). Há **roadmaps de carreira** (ex.: Front-end, DevOps); a cada matéria
concluída o aluno ganha **pontos resgatáveis por certificação** e um **badge** por setor.

Este documento descreve um **protótipo funcional** — uma fatia vertical que demonstra os 6 subsistemas
funcionando de ponta a ponta, reaproveitando o design system já existente (paleta roxo/ciano, tema
escuro, fontes Inter / Caveat / JetBrains Mono, ícones Lucide).

### Decisões travadas (definidas no brainstorming)

| Eixo | Decisão |
|---|---|
| **IA generativa** | Híbrido (LLM + cache). Banco de exercícios embutido + motor adaptativo real; geração ao vivo via Claude API fica *atrás de uma flag* (`CLAUDE_API_KEY`). |
| **Stack** | Node + React (framework maior). O Flask atual vira referência/legado. |
| **Backend** | Node + Express · SQLite via Prisma · auth segura (argon2 + sessão por cookie httpOnly). |
| **Frontend** | React + Vite, portando os tokens/estética do design atual (inclui recriar a landing). |
| **Pagamento** | Checkout **simulado** (sem serviço externo, sem cobrança). |
| **Conteúdo** | 1 roadmap profundo: **Desenvolvedor Front-end** (HTML → CSS → JS). Outros roadmaps aparecem bloqueados. |
| **Chave de IA** | Não disponível agora → banco embutido de qualidade + código "pronto para IA" (liga ao adicionar a chave). |

---

## Arquitetura

```
neurocode/
├── server/                      # API Node + Express
│   ├── prisma/
│   │   ├── schema.prisma        # modelo de dados (SQLite)
│   │   └── seed.js              # roadmap, matérias, aulas + banco de exercícios
│   ├── src/
│   │   ├── index.js             # bootstrap do app
│   │   ├── auth/                # registro, login, sessão, hash de senha
│   │   ├── routes/              # auth, roadmaps, lessons, exercises, progress, gamification, payment
│   │   ├── ai/                  # carregador do banco + seletor adaptativo + cliente Claude (opcional)
│   │   ├── middleware/          # guard de auth, rate-limit, CSRF, tratamento de erros
│   │   └── lib/                 # validação (zod), helpers
│   ├── .env.example             # PORT, SESSION_SECRET, CLAUDE_API_KEY (opcional)
│   └── package.json
├── web/                         # React (Vite)
│   ├── src/
│   │   ├── pages/               # Landing, Login, Register, Onboarding, Dashboard, Roadmap, Course, Lesson, Profile, Pricing/Checkout
│   │   ├── components/          # ExerciseCard, ProgressPanel, RoadmapNode, BadgeGrid, ...
│   │   ├── styles/              # tokens portados (variables, base, components, animations)
│   │   ├── lib/api.js           # wrapper de fetch com credenciais
│   │   └── App.jsx              # rotas + guarda de rota
│   └── package.json
└── README.md                    # pré-requisitos + como rodar + como ligar a IA real
```

**Comunicação:** o frontend (Vite, porta 5173) fala com a API (Express, porta 4000) via `fetch`
com `credentials: 'include'`; o Vite faz proxy de `/api` para o backend em dev.

---

## Modelo de dados (Prisma / SQLite)

- **User** — `id`, `name`, `email` (único), `passwordHash`, `plan` (`free`|`pro`|`career`),
  `xp`, `level`, `neuroPoints`, `streak`, `lastActiveDate`, `createdAt`.
- **Roadmap** (carreira) — `id`, `slug`, `title`, `description`, `icon`, `isLocked`.
- **Course** (matéria) — `id`, `roadmapId`, `slug`, `title`, `description`, `order`,
  `badgeName`, `badgeIcon`, `pointsReward`.
- **Lesson** (aula) — `id`, `courseId`, `title`, `order`, `content` (teoria, markdown), `conceptTags`.
- **Exercise** — `id`, `lessonId`, `type` (`multiple-choice`|`fill-blank`|`predict-output`|`order-lines`),
  `prompt`, `options` (JSON), `answer`, `difficulty` (1–3), `conceptTag`, `source` (`bank`|`ai`).
- **Attempt** — `id`, `userId`, `exerciseId`, `correct`, `answeredAt`. **Alimenta a adaptatividade.**
- **Progress** — `id`, `userId`, `lessonId`, `status` (`locked`|`available`|`completed`), `score`, `completedAt`.
- **Badge** — `id`, `userId`, `courseId`, `name`, `icon`, `earnedAt`.
- **PointsLedger** — `id`, `userId`, `points`, `reason`, `createdAt`. (Histórico de NeuroPoints.)
- **Certificate** — `id`, `userId`, `roadmapId`/`courseId`, `issuedAt`, `pointsSpent`.
- **Transaction** — `id`, `userId`, `plan`, `amount`, `status`, `method`, `createdAt`. (Pagamento simulado.)
- **Enrollment** — `userId` + `roadmapId`.

### Distinção importante das "moedas"
- **XP** → dirige o **nível** (progressão estilo Duolingo).
- **NeuroPoints** → moeda ganha ao concluir **matérias**, **resgatável por certificação**.

---

## Subsistema 1 — Autenticação segura (requisito crítico)

- Senha com **hash argon2id** — nunca armazenada em texto puro.
- Sessão via **cookie httpOnly + SameSite=Lax + Secure (em prod)**, com `SESSION_SECRET`.
- **Validação de entrada com zod** em todas as rotas de escrita.
- **Rate-limit no login** (anti força-bruta).
- **Proteção CSRF** para requisições que mudam estado.
- **Mensagens de erro genéricas** no login (sem revelar se o e-mail existe → evita enumeração).
- **Checagem de força de senha** no cadastro.
- Escopo: apenas e-mail/senha (sem OAuth — YAGNI no protótipo).
- Rotas: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

---

## Subsistema 2 — Motor adaptativo + IA (o coração)

É aqui que "a IA se adapta às dificuldades de cada aluno" vira algo real e demonstrável.

1. Cada **Exercise** é etiquetado por **`conceptTag`** (ex.: `css-flexbox`, `js-variables`) e **`difficulty`** (1–3).
2. A cada resposta, o motor atualiza a **maestria por conceito** do aluno (acurácia recente via `Attempt`).
3. Ao montar uma **sessão de aula**, o **seletor adaptativo** escolhe os exercícios:
   - conceito **fraco** (baixa acurácia / erros recentes) → mais exercícios, começando fáceis e subindo;
   - conceito **dominado** → poucos e mais difíceis (ou pula);
   - conceito **novo** → começa na dificuldade 1.
4. **Camada de geração (híbrida):**
   - **Offline (padrão):** puxa do **banco embutido** (seed), que cobre cada conceito em dificuldades 1–3 e em tipos variados.
   - **Com `CLAUDE_API_KEY`:** quando faltam exercícios para um conceito fraco, chama a **Claude API** para
     **gerar um exercício novo sob medida** (conceito + dificuldade alvo), **valida o formato** (schema do
     `Exercise`) e **salva no cache** (`source='ai'`) para reuso. → IA generativa real, com cache.
5. **Módulo `ai/` isolado:** `bank.js` (carrega/consulta o banco), `selector.js` (lógica adaptativa pura,
   testável), `claudeClient.js` (geração opcional, atrás da flag). O selector funciona idêntico com ou sem chave.

> **Harness de programação:** os tipos `predict-output` e `order-lines` ancoram exercícios em código real;
> o gerador (quando ligado) recebe um *prompt template* com o conceito, a dificuldade e exemplos do banco
> como few-shot, e devolve JSON validável — o "harness" que mantém a saída da IA no formato certo.

---

## Subsistema 3 — Conteúdo e Roadmap

- Estrutura: **Roadmap (carreira) → Course (matéria) → Lesson (aula) → Exercise**.
- Fatia vertical: roadmap **Desenvolvedor Front-end** com 3 matérias — **HTML**, **CSS**, **JavaScript** —
  cada uma com algumas aulas (teoria curta + sessão de exercícios). Outros roadmaps (DevOps, Back-end, Data)
  aparecem **bloqueados** na tela de roadmap.
- A tela de **Roadmap** é uma trilha visual de nós (estilo mapa), com matérias bloqueadas/liberadas conforme o progresso.

---

## Subsistema 4 — Gamificação

- **XP** por exercício/aula → sobe de **nível** (limiares de XP).
- **NeuroPoints** ao concluir matérias → resgatáveis por **certificado**.
- **Badges** — uma por matéria/setor concluído (`Badge`).
- **Streak** diário (atualiza `streak`/`lastActiveDate`).
- **Ranking** — leaderboard por XP.
- O painel **"Seu progresso"** (meta semanal + pódio) já existe no design atual e será reaproveitado.

---

## Subsistema 5 — Pagamento (simulado)

- Tela de **planos** (Explorar grátis · Pro · Carreira) reaproveitando a seção de pricing atual.
- **Checkout simulado:** formulário realista (cartão fake, confirmação) → grava `Transaction` → ativa o
  `plan` do usuário → libera conteúdo *gated*.
- **Gating:** plano free limita (ex.: 1 matéria); Pro libera todas. Demonstra o valor do pagamento.
- Sem serviço externo, sem cobrança real.

---

## Telas e fluxos (frontend)

1. **Landing** (pública) — design atual recriado em React; CTA → cadastro.
2. **Cadastro / Login** — seguro (ver Subsistema 1).
3. **Onboarding** — quiz de perfil curto (3 perguntas) → semeia a maestria inicial.
4. **Dashboard** — XP/nível, streak, NeuroPoints, meta semanal, "continuar".
5. **Roadmap** — carreira Front-end como trilha de nós; outras bloqueadas.
6. **Matéria** — lista de aulas, progresso, badge + pontos a ganhar.
7. **Aula** — teoria curta + **sessão de exercícios estilo Duolingo** (um por vez, feedback imediato, +XP).
8. **Conclusão** — aula → XP + próxima liberada; matéria → badge + NeuroPoints + certificado elegível.
9. **Perfil** — badges, nível, pontos, **resgatar pontos → certificado**.
10. **Planos → Checkout** — ativa o plano (simulado).

---

## Fases de build (fatia vertical primeiro)

1. **Fundação** — projeto Node+React, Prisma/SQLite, tokens portados, landing.
2. **Auth segura** — cadastro/login/sessão + guarda de rotas.
3. **Conteúdo + Roadmap** — seed do roadmap Front-end + telas roadmap/matéria/aula.
4. **Motor adaptativo + exercícios** — banco embutido + seletor + sessão Duolingo (gancho Claude pronto).
5. **Gamificação** — XP/nível/badges/pontos/streak/ranking.
6. **Pagamento simulado + certificados** — checkout, gating, resgate de pontos.

**Critério de sucesso da fatia:** um aluno consegue cadastrar, entrar, escolher a matéria no roadmap,
fazer uma aula com exercícios que se adaptam ao desempenho, ganhar XP/badge, e (após "pagar") desbloquear
conteúdo e resgatar um certificado.

---

## Pré-requisitos e como rodar

- **Pré-requisito:** Node.js 18+ instalado.
- `cd server && npm install && npm run seed && npm run dev` → API em `http://localhost:4000`.
- `cd web && npm install && npm run dev` → app em `http://localhost:5173`.
- **Ligar a IA real (opcional):** copiar `.env.example` → `.env`, preencher `CLAUDE_API_KEY`, reiniciar a API.
  Sem a chave, o protótipo funciona 100% offline com o banco embutido.

---

## Fora de escopo (pós-protótipo)

- NeuroBot dentro da aula (assistente de chat) — *stretch* opcional.
- Roadmaps além do Front-end (DevOps, Back-end, Data) — só aparecem bloqueados.
- OAuth / login social.
- Pagamento real (Stripe).
- App mobile nativo.
