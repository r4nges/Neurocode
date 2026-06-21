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
