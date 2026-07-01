# Motor Adaptativo — fix cold-start + explicação de gabarito · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o ruído de cold-start da maestria (um acerto não pode virar "proficient") e mostrar a explicação do gabarito após cada exercício respondido.

**Architecture:** Duas mudanças independentes no motor já existente. (1) A classificação de maestria em `mastery.js` ganha uma porta de amostra mínima assimétrica (função pura, sem I/O). (2) Um campo `explanation` opcional em `Exercise` é semeado e devolvido por `gradeAttempt` após a tentativa, e renderizado no feedback da sessão. Nenhuma rota nova; nenhuma quebra de contrato.

**Tech Stack:** Node/Express, Prisma 5.22 + SQLite, Vitest 2.1 (server e web), React 18 + Vite, Testing Library.

## Global Constraints

- **Maestria (verbatim do spec):** `PROFICIENT = 0.8`, `WINDOW = 5`, `MIN_SAMPLE = 3`.
  - `new`: `count === 0` **ou** (`count < MIN_SAMPLE` **e** `accuracy >= PROFICIENT`).
  - `proficient`: **só** com `count >= MIN_SAMPLE` **e** `accuracy >= PROFICIENT`.
  - `weak`: `accuracy < PROFICIENT` com `count > 0` (reativo, sem amostra mínima).
- **Codificação de exercícios (não alterar):** `multiple-choice` → `answer` índice (number); `fill-blank`/`predict-output` → `answer` string; `order-lines` → `answer` array de índices. Tudo persistido como String JSON.
- **Integridade:** a montagem da sessão (`buildLessonSession`) **nunca** expõe `answer`/`explanation`. Gabarito só sai **depois** da tentativa, em `gradeAttempt`.
- **`explanation` é nullable** (`String?`): a UI degrada quando ausente.
- **Idempotência do seed:** re-semear não pode duplicar nem multiplicar exercícios do banco.
- **Comandos de teste:** raiz `npm test`; server `cd server && npx vitest run <arquivo>`; web `cd web && npx vitest run <arquivo>`.
- **Todos os testes atuais (server + web) devem continuar verdes.**

---

### Task 1: Cold-start da maestria (função pura)

**Files:**
- Modify: `server/src/ai/mastery.js`
- Test: `server/tests/mastery.test.js`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `computeMastery(attempts) -> Map<concept, { level, accuracy, count }>` e `levelFor(mastery, concept) -> 'new'|'weak'|'proficient'` — assinaturas inalteradas; só muda a regra de `level`.

- [ ] **Step 1: Escrever os testes falhos (casos cold-start)**

Adicionar dentro do `describe('computeMastery', ...)` em `server/tests/mastery.test.js`:

```js
  it('cold-start: um único acerto NÃO vira proficient (fica new)', () => {
    const m = computeMastery([a('flexbox', true)]);
    expect(m.get('flexbox').level).toBe('new'); // count 1 < MIN_SAMPLE
    expect(m.get('flexbox').count).toBe(1);
  });

  it('cold-start: 2 acertos (count < 3) ainda é new', () => {
    const m = computeMastery([a('flexbox', true), a('flexbox', true)]);
    expect(m.get('flexbox').level).toBe('new');
  });

  it('cold-start: 3 acertos (count = 3) já é proficient', () => {
    const m = computeMastery([a('flexbox', true), a('flexbox', true), a('flexbox', true)]);
    expect(m.get('flexbox').level).toBe('proficient');
  });

  it('weak é reativo: um único erro vira weak de imediato', () => {
    const m = computeMastery([a('tags', false)]);
    expect(m.get('tags').level).toBe('weak'); // accuracy 0 < 0.8, count 1
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && npx vitest run tests/mastery.test.js`
Expected: FAIL — os novos casos falham (hoje 1 acerto → `proficient`; 1 erro já é `weak` e passa, mas o de 1 acerto quebra).

- [ ] **Step 3: Implementar a classificação assimétrica**

Substituir o corpo de `computeMastery` em `server/src/ai/mastery.js` (a partir da linha `const WINDOW = 5;`) por:

```js
// Maestria por conceito a partir das tentativas. Puro (sem I/O).
const WINDOW = 5;
const PROFICIENT = 0.8;
const MIN_SAMPLE = 3; // amostra mínima para creditar "proficient" (anti cold-start, DT-02)

// Classifica assimetricamente: difícil virar proficient (exige prova),
// fácil virar weak (um erro já pede mais prática).
function classify(count, accuracy) {
  if (count === 0) return 'new';
  if (accuracy < PROFICIENT) return 'weak';
  return count >= MIN_SAMPLE ? 'proficient' : 'new';
}

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
    mastery.set(concept, { level: classify(count, accuracy), accuracy, count });
  }
  return mastery;
}

export function levelFor(mastery, concept) {
  return mastery.get(concept)?.level ?? 'new';
}
```

- [ ] **Step 4: Rodar e ver passar (novos + antigos)**

Run: `cd server && npx vitest run tests/mastery.test.js`
Expected: PASS — todos, incluindo os 4 originais (`[] → new`, `4/5 → proficient`, `1/3 → weak`, janela 5/5 → proficient).

- [ ] **Step 5: Rodar a suíte do seletor (garantir que não regrediu)**

Run: `cd server && npx vitest run tests/selector.test.js`
Expected: PASS — o seletor só lê `level`; comportamento neutro para `new`.

- [ ] **Step 6: Commit**

```bash
git add server/src/ai/mastery.js server/tests/mastery.test.js
git commit -m "fix(mastery): exige amostra minima para proficient (anti cold-start, DT-02)"
```

---

### Task 2: Campo `explanation` no schema + migração

**Files:**
- Modify: `server/prisma/schema.prisma:91-104` (model `Exercise`)
- Create: `server/prisma/migrations/<timestamp>_add_exercise_explanation/` (gerado pelo Prisma)

**Interfaces:**
- Produces: coluna `Exercise.explanation String?` disponível ao Prisma Client para as Tasks 3 e 4.

- [ ] **Step 1: Adicionar o campo ao model `Exercise`**

Em `server/prisma/schema.prisma`, dentro de `model Exercise`, após a linha `conceptTag String` adicionar:

```prisma
  explanation String?
```

- [ ] **Step 2: Gerar a migração e o client**

Run: `cd server && npx prisma migrate dev --name add_exercise_explanation`
Expected: cria a pasta de migração, aplica no `dev.db` e regenera o Prisma Client sem erro. (Coluna nullable → sem prompt de dado obrigatório.)

- [ ] **Step 3: Verificar que o client aceita o campo (smoke test)**

Run: `cd server && node -e "import('@prisma/client').then(({PrismaClient})=>{const p=new PrismaClient();console.log('explanation' in p.exercise.fields ? 'ok' : 'faltou');process.exit(0)})"`
Expected: imprime `ok`.

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(schema): adiciona Exercise.explanation (nullable) para gabarito"
```

---

### Task 3: Semear explicações em todos os exercícios do banco

**Files:**
- Modify: `server/src/content/exercises.js` (todas as entradas de `EXERCISES` + `seedExercises`)
- Test: `server/tests/exercise.seed.test.js`

**Interfaces:**
- Consumes: `Exercise.explanation` (Task 2).
- Produces: cada linha `source: 'bank'` no banco tem `explanation` não-vazia; cada objeto de `EXERCISES` tem `explanation: string`.

- [ ] **Step 1: Escrever os testes falhos de completude**

Adicionar em `server/tests/exercise.seed.test.js`, dentro do `describe('banco de exercícios — cobertura', ...)`:

```js
  it('toda entrada de EXERCISES tem explanation não-vazia', () => {
    for (const e of EXERCISES) {
      expect(typeof e.explanation, `explanation de "${e.prompt}"`).toBe('string');
      expect(e.explanation.trim().length, `explanation de "${e.prompt}"`).toBeGreaterThan(0);
    }
  });

  it('todo exercício do banco no DB tem explanation persistida', async () => {
    const rows = await prisma.exercise.findMany({ where: { source: 'bank' }, take: 200 });
    for (const r of rows) {
      expect(typeof r.explanation, `explanation do id ${r.id}`).toBe('string');
      expect(r.explanation.trim().length).toBeGreaterThan(0);
    }
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && npx vitest run tests/exercise.seed.test.js`
Expected: FAIL — `explanation` ainda é `undefined`/`null`.

- [ ] **Step 3: Mapear `explanation` no seed**

Em `server/src/content/exercises.js`, no `prisma.exercise.create` dentro de `seedExercises`, adicionar o campo ao `data` (após `conceptTag: e.conceptTag,`):

```js
          explanation: e.explanation ?? null,
```

- [ ] **Step 4: Autorar uma `explanation` em CADA objeto de `EXERCISES`**

Regra: uma frase curta (≤140 chars) dizendo **por que** a resposta certa está certa — não repita o enunciado. Adicionar a chave `explanation` a **todos** os objetos do array `EXERCISES`. Exemplos concretos (um por tipo/área), seguir o mesmo padrão nos demais:

```js
  // html-basico / multiple-choice
  { conceptTag: 'html-basico', type: 'multiple-choice', difficulty: 1,
    prompt: 'O que significa a sigla HTML?',
    options: ['HyperText Markup Language', 'High Tech Modern Language', 'Hyperlink Text Mode'],
    answer: 0,
    explanation: 'HTML = HyperText Markup Language: a linguagem de marcação que estrutura páginas web.' },

  // html-basico / fill-blank
  { conceptTag: 'html-basico', type: 'fill-blank', difficulty: 2,
    prompt: 'Complete: a tag que envolve todo o conteúdo visível da página é <____>.',
    options: [], answer: 'body',
    explanation: 'O <body> contém tudo o que aparece na tela; o <head> guarda só metadados.' },

  // tags / order-lines
  { conceptTag: 'tags', type: 'order-lines', difficulty: 3,
    prompt: 'Ordene para formar uma lista não-ordenada com um item.',
    options: ['</ul>', '<ul>', '<li>Item</li>'], answer: [1, 2, 0],
    explanation: 'Abre <ul>, coloca o <li> dentro e fecha </ul>: o item fica aninhado na lista.' },

  // ancoras / multiple-choice
  { conceptTag: 'ancoras', type: 'multiple-choice', difficulty: 2,
    prompt: 'Como abrir um link em nova aba?',
    options: ['target="_blank"', 'newtab="true"', 'open="new"'], answer: 0,
    explanation: 'target="_blank" instrui o navegador a abrir o destino do link numa nova aba.' },

  // predict-output (padrão ilustrativo — casar com o enunciado real da entrada JS)
  { conceptTag: 'variaveis', type: 'predict-output', difficulty: 2,
    prompt: 'Qual a saída? let x = 2; x = x + 3; console.log(x);',
    options: [], answer: '5',
    explanation: 'x recebe 2, depois é reatribuído para 2 + 3 = 5, que é o valor impresso.' },

  // ...seguir o mesmo padrão em TODAS as demais entradas (CSS: seletores, box-model,
  // flexbox…; JS: funcoes, dom, eventos…) até o teste de completude ficar verde.
```

O teste do Step 1 falha até que **nenhuma** entrada fique sem `explanation` — use-o como checklist.

- [ ] **Step 5: Rodar e ver passar (completude + idempotência)**

Run: `cd server && npx vitest run tests/exercise.seed.test.js`
Expected: PASS — todas as entradas e todas as linhas do banco têm `explanation`; o teste de idempotência existente segue verde.

- [ ] **Step 6: Commit**

```bash
git add server/src/content/exercises.js server/tests/exercise.seed.test.js
git commit -m "feat(content): explicacao de gabarito em todos os exercicios do banco"
```

---

### Task 4: `gradeAttempt` devolve `explanation` + `correctAnswer`

**Files:**
- Modify: `server/src/ai/session.js:48-65` (função `gradeAttempt`)
- Test: `server/tests/session.engine.test.js`

**Interfaces:**
- Consumes: `Exercise.explanation` (Task 2/3).
- Produces: no caminho de sucesso, `gradeAttempt(...)` retorna `{ correct: boolean, explanation: string|null, correctAnswer: number|string|number[] }`. Os caminhos de erro (`invalid-session`/`locked`/`not-found`) permanecem `{ error }` inalterados.

- [ ] **Step 1: Escrever o teste falho**

Adicionar em `server/tests/session.engine.test.js`, dentro do `describe('gradeAttempt — 1ª tentativa por token', ...)`:

```js
  it('devolve explanation e correctAnswer após responder', async () => {
    const s = await buildLessonSession(userId, lesson1Id);
    const exId = s.exercises[0].id;
    const real = await prisma.exercise.findUnique({ where: { id: exId } });
    const res = await gradeAttempt(userId, exId, s.sessionToken, JSON.parse(real.answer));
    expect(res.correct).toBe(true);
    expect(res).toHaveProperty('explanation');       // string ou null
    expect(res.correctAnswer).toEqual(JSON.parse(real.answer));
    // a montagem da sessão continua SEM expor o gabarito
    for (const ex of s.exercises) {
      expect(ex).not.toHaveProperty('explanation');
      expect(ex).not.toHaveProperty('answer');
    }
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd server && npx vitest run tests/session.engine.test.js`
Expected: FAIL — `res.correctAnswer` é `undefined` e não há `explanation`.

- [ ] **Step 3: Implementar o retorno enriquecido**

Em `server/src/ai/session.js`, na função `gradeAttempt`, substituir a última linha `return { correct };` por:

```js
  return { correct, explanation: exercise.explanation ?? null, correctAnswer: JSON.parse(exercise.answer) };
```

(`exercise` já foi carregado com `findUnique` acima; `answer` já está no objeto. Os `return { error: ... }` anteriores ficam intactos.)

- [ ] **Step 4: Rodar e ver passar (arquivo inteiro)**

Run: `cd server && npx vitest run tests/session.engine.test.js`
Expected: PASS — inclusive o teste existente `expect(first).not.toHaveProperty('solution')` (não adicionamos `solution`) e o `not.toHaveProperty('answer')` da montagem.

- [ ] **Step 5: Commit**

```bash
git add server/src/ai/session.js server/tests/session.engine.test.js
git commit -m "feat(session): gradeAttempt devolve explanation e correctAnswer pos-tentativa"
```

---

### Task 5: Renderizar a explicação no feedback da sessão (web)

**Files:**
- Modify: `web/src/components/ExerciseSession.jsx:96-104` (bloco `ex-feedback`)
- Test: `web/tests/Content.test.jsx`

**Interfaces:**
- Consumes: resposta de `POST /api/exercises/:id/attempt` com `{ correct, explanation, correctAnswer }` (Task 4).
- Produces: quando `feedback.explanation` existe, o texto aparece no bloco de feedback (acerto e erro).

- [ ] **Step 1: Escrever o teste falho (web)**

Em `web/tests/Content.test.jsx`, alterar o mock do attempt da aula 1 (linha `if (url.endsWith('/api/exercises/10/attempt')) return ok({ correct: true, solution: 1 });`) para incluir explicação:

```js
    if (url.endsWith('/api/exercises/10/attempt')) return ok({ correct: true, explanation: 'A tag <a> cria links (âncoras).', correctAnswer: 1 });
```

E dentro do teste `it('mostra a teoria, inicia a sessão e conclui com aprovação', ...)`, após a linha que clica em "verificar" e antes de clicar em "continuar", adicionar:

```js
    // a explicação do gabarito aparece no feedback
    expect(await screen.findByText(/a tag <a> cria links/i)).toBeInTheDocument();
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/Content.test.jsx`
Expected: FAIL — o texto da explicação não é renderizado.

- [ ] **Step 3: Renderizar a explicação**

Em `web/src/components/ExerciseSession.jsx`, dentro do bloco `feedback && (...)`, adicionar o parágrafo da explicação após o `<p>` da mensagem e antes do botão "Continuar":

```jsx
          {feedback && (
            <div className={`ex-feedback ${feedback.correct ? 'is-ok' : 'is-bad'}`} role="status">
              <div className="ex-feedback-inner">
                <span className="ex-feedback-icon" aria-hidden="true">{feedback.correct ? '✓' : '↻'}</span>
                <p>{feedback.correct ? 'Correto!' : 'Ainda não. Vamos repetir esse mais tarde.'}</p>
                {feedback.explanation && <p className="ex-explanation">{feedback.explanation}</p>}
                <button className="btn btn-primary" onClick={next} autoFocus>Continuar</button>
              </div>
            </div>
          )}
```

- [ ] **Step 4: Rodar e ver passar (arquivo inteiro)**

Run: `cd web && npx vitest run tests/Content.test.jsx`
Expected: PASS — inclusive os testes de regressão (order-lines após fill-blank, reset do card ao errar).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ExerciseSession.jsx web/tests/Content.test.jsx
git commit -m "feat(web): mostra explicacao do gabarito no feedback do exercicio"
```

---

### Task 6: Verificação de suíte completa

**Files:** nenhum (gate de integração).

- [ ] **Step 1: Rodar toda a suíte (server + web)**

Run: `npm test`
Expected: PASS em ambos os pacotes; contagem de testes ≥ a de antes + os novos casos.

- [ ] **Step 2: Re-seed idempotente de sanidade**

Run: `cd server && npm run seed`
Expected: sem erro; exercícios do banco populados com `explanation`.

- [ ] **Step 3: Commit final (se houver ajuste pendente)**

```bash
git add -A
git commit -m "chore: fecha bloco motor adaptativo (cold-start + gabarito)" --allow-empty
```

---

## Notas de execução

- **Ordem obrigatória:** Task 2 (schema) antes de 3 e 4. Task 4 antes de 5. Task 1 é independente e pode ir a qualquer momento.
- **Fora de escopo (specs próprios da Fase A):** loop de recompensa (planos/checkout/gating/certificados), estados globais de UI + expiração de sessão no cliente, E2E cadastro→certificado.
- **Rastreabilidade:** implementa DT-02 (Alta) e RF-17. Ver `docs/superpowers/specs/2026-07-01-motor-adaptativo-design.md`.
