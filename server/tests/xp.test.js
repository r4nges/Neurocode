import { describe, it, expect } from 'vitest';
import { xpDelta, levelForXp, XP_POR_NIVEL } from '../src/gamification/xp.js';

describe('xpDelta', () => {
  it('só recompensa melhora: max(0, novo - prevBest)', () => {
    expect(xpDelta(0, 100)).toBe(100);
    expect(xpDelta(80, 100)).toBe(20);
    expect(xpDelta(100, 100)).toBe(0);   // refazer igual = 0 (anti-farming)
    expect(xpDelta(100, 80)).toBe(0);    // refazer pior = 0
  });
  it('trata prevBest null/undefined como 0', () => {
    expect(xpDelta(null, 90)).toBe(90);
    expect(xpDelta(undefined, 90)).toBe(90);
  });
});

describe('levelForXp', () => {
  it('limiar fixo de 250 XP por nível, começa em 1', () => {
    expect(XP_POR_NIVEL).toBe(250);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(249)).toBe(1);
    expect(levelForXp(250)).toBe(2);
    expect(levelForXp(500)).toBe(3);
  });
});
