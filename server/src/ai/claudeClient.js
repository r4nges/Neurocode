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
  const diff = obj.difficulty != null ? Number(obj.difficulty) : difficulty;
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
    let created;
    try {
      created = await prisma.exercise.create({ data: { ...rec, lessonId: lessonId ?? null } });
    } catch {
      continue; // falha de cache: degrada para o banco, tenta o próximo conceito
    }
    return [...pool, created];
  }
  return pool;
}
