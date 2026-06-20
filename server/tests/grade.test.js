import { describe, it, expect } from 'vitest';
import { grade, normalize } from '../src/ai/grade.js';

const ex = (type, answer) => ({ type, answer: JSON.stringify(answer) });

describe('grade', () => {
  it('multiple-choice compara índice', () => {
    expect(grade(ex('multiple-choice', 1), 1)).toBe(true);
    expect(grade(ex('multiple-choice', 1), '1')).toBe(true); // tolera string numérica
    expect(grade(ex('multiple-choice', 1), 0)).toBe(false);
  });

  it('fill-blank compara string normalizada', () => {
    expect(grade(ex('fill-blank', 'const'), '  Const ')).toBe(true);
    expect(grade(ex('fill-blank', 'color: red'), 'color:   red')).toBe(true);
    expect(grade(ex('fill-blank', 'const'), 'let')).toBe(false);
  });

  it('predict-output compara saída normalizada', () => {
    expect(grade(ex('predict-output', 'Rangel 10'), 'rangel 10')).toBe(true);
    expect(grade(ex('predict-output', '42'), '43')).toBe(false);
  });

  it('order-lines compara a ordem exata de índices', () => {
    expect(grade(ex('order-lines', [2, 0, 1]), [2, 0, 1])).toBe(true);
    expect(grade(ex('order-lines', [2, 0, 1]), ['2', '0', '1'])).toBe(true);
    expect(grade(ex('order-lines', [2, 0, 1]), [0, 1, 2])).toBe(false);
    expect(grade(ex('order-lines', [2, 0, 1]), [2, 0])).toBe(false);
    expect(grade(ex('order-lines', [0, 1]), 'nao-array')).toBe(false);
  });

  it('tipo desconhecido nunca passa', () => {
    expect(grade(ex('mistério', 'x'), 'x')).toBe(false);
  });

  it('normalize colapsa espaços e baixa caixa', () => {
    expect(normalize('  Olá   Mundo ')).toBe('olá mundo');
  });
});
