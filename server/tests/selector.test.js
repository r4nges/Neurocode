import { describe, it, expect, beforeEach } from 'vitest';
import { sessionSize, buildSession } from '../src/ai/selector.js';

// pool helper: id estável, conceito, dificuldade
let id = 1;
const ex = (conceptTag, difficulty) => ({ id: id++, conceptTag, difficulty });

// maestria fake como Map de níveis
const mastery = (entries) => new Map(entries.map(([c, level]) => [c, { level }]));

beforeEach(() => { id = 1; });

describe('sessionSize', () => {
  it('base 3 sem conceito fraco', () => {
    expect(sessionSize(mastery([['flexbox', 'new']]), ['flexbox'])).toBe(3);
  });
  it('+2 por conceito fraco, teto 8', () => {
    const m = mastery([['a', 'weak'], ['b', 'weak'], ['c', 'weak']]);
    expect(sessionSize(m, ['a', 'b', 'c'])).toBe(8); // 3 + 2*3 = 9 -> teto 8
    expect(sessionSize(mastery([['a', 'weak']]), ['a', 'b'])).toBe(5); // só 'a' fraco
  });
});

describe('buildSession', () => {
  it('respeita o tamanho e prioriza conceito fraco, fácil->difícil', () => {
    const concepts = ['flexbox', 'layout'];
    const pool = [
      ex('flexbox', 1), ex('flexbox', 2), ex('flexbox', 3),
      ex('layout', 1), ex('layout', 2), ex('layout', 3),
    ];
    const m = mastery([['flexbox', 'weak'], ['layout', 'new']]);
    const session = buildSession(m, concepts, pool);
    expect(session.length).toBe(5); // 3 + 2 (um fraco)
    // o primeiro item é do conceito fraco (flexbox) e o mais fácil disponível
    expect(session[0].conceptTag).toBe('flexbox');
    expect(session[0].difficulty).toBe(1);
    // não repete o mesmo exercício
    const ids = session.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('proficiente puxa do mais difícil', () => {
    const pool = [ex('css', 1), ex('css', 2), ex('css', 3)];
    const m = mastery([['css', 'proficient']]);
    const session = buildSession(m, ['css'], pool);
    expect(session[0].difficulty).toBe(3);
  });

  it('devolve o que houver quando o pool é menor que o tamanho', () => {
    const pool = [ex('x', 1)];
    const session = buildSession(mastery([['x', 'weak']]), ['x'], pool);
    expect(session.length).toBe(1);
  });
});
