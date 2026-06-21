export const XP_POR_NIVEL = 250;

// XP concedido = só o delta de melhora (anti-farming). prevBest null/undefined = 0.
export function xpDelta(prevBest, novoScore) {
  return Math.max(0, novoScore - (prevBest ?? 0));
}

// Nível derivado do XP total acumulado. Limiar fixo, começa em 1.
export function levelForXp(xpTotal) {
  return Math.floor(xpTotal / XP_POR_NIVEL) + 1;
}
