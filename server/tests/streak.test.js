import { describe, it, expect } from 'vitest';
import { nextStreak } from '../src/gamification/streak.js';

const d = (iso) => new Date(iso);

describe('nextStreak (data-calendário UTC)', () => {
  it('1ª atividade: streak 1 e marca now', () => {
    const now = d('2026-06-21T10:00:00Z');
    expect(nextStreak(0, null, now)).toEqual({ streak: 1, lastActiveDate: now });
  });

  it('mesmo dia: inalterado, lastActiveDate fica', () => {
    const prev = d('2026-06-21T08:00:00Z');
    const now = d('2026-06-21T23:00:00Z');
    expect(nextStreak(4, prev, now)).toEqual({ streak: 4, lastActiveDate: prev });
  });

  it('dia consecutivo: +1 e marca now', () => {
    const prev = d('2026-06-21T23:00:00Z');
    const now = d('2026-06-22T01:00:00Z');
    expect(nextStreak(4, prev, now)).toEqual({ streak: 5, lastActiveDate: now });
  });

  it('gap > 1 dia: reseta para 1 e marca now', () => {
    const prev = d('2026-06-21T12:00:00Z');
    const now = d('2026-06-24T12:00:00Z');
    expect(nextStreak(9, prev, now)).toEqual({ streak: 1, lastActiveDate: now });
  });
});
