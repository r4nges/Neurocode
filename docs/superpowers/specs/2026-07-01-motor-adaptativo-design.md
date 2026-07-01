# Motor adaptativo — fix cold-start + explicação de gabarito

- **Data:** 2026-07-01
- **Fase (PDF Requisitos):** A — Fechar a demo completa
- **Escopo deste spec:** Bloco "Motor adaptativo" — corrigir o cold-start da maestria (DT-02) e adicionar explicação de gabarito (RF-17). Os demais blocos da Fase A ficam em specs próprios.

## 1. Contexto

O protótipo já tem motor adaptativo real (maestria por conceito com janela de tentativas,
seletor de sessão e correção server-autoritativa, tudo em funções puras testadas). Dois defeitos
de qualidade pedagógica seguem abertos:

- **DT-02 (Alta):** a classificação de maestria decide com amostra de 1 tentativa. Em
  `server/src/ai/mastery.js`, `count === 1` + 1 acerto ⇒ `proficient`. Um chute de sorte "zera"
  a prática do conceito (proficiente recebe menos exercícios e mais difíceis). O onboarding,
  com 1 questão por matéria, sofre o mesmo ruído.
- **RF-17 (Could, incluído na Fase A):** não há explicação do gabarito após responder um
  exercício. O feedback atual é só "Correto" / "Ainda não".

### Decomposição da Fase A (registro — não é escopo deste spec)

A "linha de base — o que falta" foi agrupada em blocos coesos, priorizados Alta → Média:

| # | Bloco | Prioridade | Spec |
|---|-------|-----------|------|
| 1 | Loop de recompensa: planos + checkout simulado + gating + certificados + resgate de NeuroPoints (RF-22..27) | Alta | futuro |
| 2 | **Motor adaptativo: cold-start (DT-02) + explicação de gabarito (RF-17)** | Alta/Média | **este** |
| 3 | Estados de UI (loading/erro/vazio) + expiração de sessão no cliente | Média | futuro |
| 4 | E2E cadastro → aula → recompensa (→ certificado, quando o bloco 1 existir) | Média | futuro |

Blocos 5 (validar cliente Claude) e 6 (Postgres/Redis) pertencem às Fases B/C e ficam fora
do MVP "demo completa" escolhido.

## 2. Parte A — Fix cold-start da maestria

### Comportamento atual

`computeMastery` agrupa tentativas por conceito, mantém a janela das 5 mais recentes e
classifica (`server/src/ai/mastery.js`):

```js
const level = count === 0 ? 'new' : accuracy >= PROFICIENT ? 'proficient' : 'weak';
```

`PROFICIENT = 0.8`, `WINDOW = 5`.

### Design escolhido — porta de amostra mínima, assimétrica

Introduzir `MIN_SAMPLE = 3`. Nova classificação:

- `new`: `count === 0` **ou** (`count < MIN_SAMPLE` **e** `accuracy >= PROFICIENT`).
  Evidência insuficiente para creditar domínio; tratamento neutro e continua amostrando.
- `proficient`: **só** com `count >= MIN_SAMPLE` **e** `accuracy >= PROFICIENT`.
- `weak`: `accuracy < PROFICIENT` com `count > 0`. Errar é sinal barato; dar prática é seguro,
  então a promoção a `weak` permanece reativa (não exige amostra mínima).

**Assimetria proposital:** difícil virar `proficient` (exige prova), fácil virar `weak`
(1 erro já pede mais prática). Isso remove o dano (pular prática por chute de sorte) e mantém
o benefício (prática rápida onde o aluno tropeça).

### Alternativa rejeitada — intervalo de Wilson

O PDF cita Wilson como opção. Com `WINDOW = 5`, o limite inferior de Wilson (z≈1.96) para 4/5
é ≈0.38 — nunca alcançaria 0.8, quebrando o design de janela e o teste `4/5 → proficient`.
Rejeitado para janela pequena; a porta de amostra mínima entrega o mesmo objetivo com menos
risco e mantém determinismo.

### Invariantes preservados (testes atuais em `mastery.test.js`)

- `[]` ⇒ `new` ✔
- 4/5 (count 5, acc 0.8) ⇒ `proficient` (count 5 ≥ 3) ✔
- 1/3 (acc 0.33) ⇒ `weak` ✔
- janela: 5/5 recentes após 3 erros antigos ⇒ `proficient` (count 5) ✔

### Casos novos a cobrir

- 1 acerto (count 1) ⇒ `new` (era `proficient`) — corrige DT-02.
- 2/2 acertos (count 2 < 3) ⇒ `new`.
- 1 erro (count 1) ⇒ `weak`.
- 3/3 acertos (count 3) ⇒ `proficient` (limiar de amostra).

### Impacto colateral

- **Seletor (`selector.js`):** consome só o `level`; assinatura inalterada. Conceitos que
  antes viravam `proficient` cedo agora ficam `new` — recebem sessão de tamanho base e
  exercícios do mais fácil ao mais difícil (comportamento neutro adequado).
- **Onboarding:** 1 questão certa ⇒ `new` (neutro); 1 errada ⇒ `weak` (mais prática).
  Alinha com a nota do PDF de que o sinal do onboarding é fraco. Ampliar o onboarding é
  item [Baixa] fora deste spec.

## 3. Parte B — Explicação de gabarito (RF-17)

### Modelo de dados

Adicionar campo nullable a `Exercise` (`server/prisma/schema.prisma`):

```prisma
explanation String?
```

Nullable garante degradação graciosa: exercício sem explicação apenas não mostra o bloco.
Requer nova migração Prisma.

### Conteúdo (seed)

Escrever explicação curta (1 linha) para **todos os ~58 exercícios** do banco embutido em
`server/src/content/exercises.js`. `seed.js` mapeia o novo campo ao criar/atualizar exercícios
(seed idempotente — atualiza explicação em execuções repetidas).

### Backend

`gradeAttempt` (`server/src/ai/session.js`) passa a retornar, **após** registrar a tentativa:

```js
return { correct, explanation: exercise.explanation ?? null, correctAnswer };
```

- `explanation`: texto do gabarito (ou `null`).
- `correctAnswer`: resposta correta decodificada (índice para MC, string para fill/predict,
  array para order-lines). Exposta **só depois** da tentativa — a montagem da sessão
  (`buildLessonSession`) continua sem expor `answer`. Integridade preservada.

### Frontend

No bloco `ex-feedback` de `ExerciseSession.jsx`, sob a mensagem "Correto!" / "Ainda não…",
renderizar `feedback.explanation` quando presente. Mostrar em acerto (reforço) e erro
(correção). O re-enfileiramento de erros (RF-15) permanece: o aluno vê a explicação, o
exercício reaparece mais tarde e a conclusão continua exigindo acerto.

## 4. Arquivos e testes

TDD: teste falho primeiro, depois implementação.

| Arquivo | Mudança |
|---|---|
| `server/src/ai/mastery.js` | `MIN_SAMPLE`, classificação assimétrica |
| `server/tests/mastery.test.js` | +casos cold-start (1/1→new, 2/2→new, 1 erro→weak, 3/3→proficient) |
| `server/prisma/schema.prisma` + nova migração | `explanation String?` em `Exercise` |
| `server/src/content/exercises.js` | `explanation` em cada exercício (~58) |
| `server/src/content/seed.js` | mapear `explanation` no upsert do seed (idempotente) |
| `server/src/ai/session.js` | `gradeAttempt` retorna `explanation` + `correctAnswer` |
| `server/tests/session.engine.test.js` | assert `explanation`/`correctAnswer` no retorno; montagem não expõe `answer` |
| `server/tests/exercise.seed.test.js` | assert seed grava `explanation` |
| `web/src/components/ExerciseSession.jsx` | render da explicação no feedback |

## 5. Critérios de aceite deste spec

- Um único acerto num conceito **não** o classifica como `proficient`; precisa de ≥3 tentativas
  com acurácia ≥0.8. Um erro classifica `weak` imediatamente.
- Todos os testes de `mastery` existentes continuam verdes; novos casos cold-start passam.
- Após responder um exercício, a UI mostra a explicação do gabarito (quando houver) tanto em
  acerto quanto em erro; a montagem da sessão nunca expõe a resposta.
- Seed idempotente popula explicação em todos os exercícios do banco.
- Suíte de testes server + web verde.

## 6. Fora de escopo

- Loop de recompensa (planos/checkout/gating/certificados) — spec próprio.
- Estados globais de UI e expiração de sessão no cliente — spec próprio.
- E2E do fluxo completo — spec próprio.
- Ampliar onboarding, spaced repetition, validar cliente Claude, Postgres/Redis — Fases B/C/D.
