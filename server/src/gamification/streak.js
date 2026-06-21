// Meia-noite UTC do dia da data (para diferença em dias-calendário determinística).
function utcMidnight(date) {
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Avança o streak conforme a distância em dias-calendário UTC entre lastActiveDate e now.
// Retorna o novo streak e o lastActiveDate a persistir (no mesmo dia, mantém o anterior).
export function nextStreak(prevStreak, lastActiveDate, now) {
  if (!lastActiveDate) return { streak: 1, lastActiveDate: now };
  const diffDays = Math.round((utcMidnight(now) - utcMidnight(lastActiveDate)) / 86400000);
  if (diffDays <= 0) return { streak: prevStreak, lastActiveDate };       // mesmo dia (ou skew)
  if (diffDays === 1) return { streak: prevStreak + 1, lastActiveDate: now }; // consecutivo
  return { streak: 1, lastActiveDate: now };                              // gap -> reset
}
