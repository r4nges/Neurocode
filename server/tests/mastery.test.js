import { describe, it, expect, beforeEach } from 'vitest';
import { computeMastery, levelFor } from '../src/ai/mastery.js';

// helper: tentativa com timestamp incremental
let t = 0;
const a = (conceptTag, correct) => ({ conceptTag, correct, answeredAt: new Date(Date.now() + t++) });

beforeEach(() => { t = 0; });

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
