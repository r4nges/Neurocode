// Montagem adaptativa da sessão. Puro (sem I/O).
const BASE = 3;
const PER_WEAK = 2;
const CAP = 8;
const LEVEL_RANK = { weak: 0, new: 1, proficient: 2 };

function levelOf(mastery, concept) {
  return mastery.get(concept)?.level ?? 'new';
}

export function sessionSize(mastery, concepts) {
  const weak = concepts.filter((c) => levelOf(mastery, c) === 'weak').length;
  return Math.min(CAP, BASE + PER_WEAK * weak);
}

// pool: exercícios candidatos (dos conceitos da aula). Retorna a sessão ordenada.
export function buildSession(mastery, concepts, pool) {
  const size = sessionSize(mastery, concepts);

  // Agrupa o pool por conceito, ordenado por dificuldade asc (id como desempate determinístico).
  const byConcept = new Map();
  for (const c of concepts) byConcept.set(c, []);
  for (const ex of pool) {
    if (!byConcept.has(ex.conceptTag)) byConcept.set(ex.conceptTag, []);
    byConcept.get(ex.conceptTag).push(ex);
  }
  for (const list of byConcept.values()) {
    list.sort((a, b) => a.difficulty - b.difficulty || a.id - b.id);
  }

  // Conceitos ordenados por prioridade (fraco→novo→proficiente), desempate alfabético.
  const ordered = [...byConcept.keys()].sort((a, b) => {
    const r = LEVEL_RANK[levelOf(mastery, a)] - LEVEL_RANK[levelOf(mastery, b)];
    return r !== 0 ? r : a.localeCompare(b);
  });

  // Cursor por conceito: proficiente começa do mais difícil; demais do mais fácil.
  const cursor = new Map();
  for (const c of ordered) {
    const list = byConcept.get(c);
    cursor.set(c, levelOf(mastery, c) === 'proficient' ? list.length - 1 : 0);
  }

  const session = [];
  let progressed = true;
  while (session.length < size && progressed) {
    progressed = false;
    for (const c of ordered) {
      if (session.length >= size) break;
      const list = byConcept.get(c);
      const i = cursor.get(c);
      if (i >= 0 && i < list.length) {
        session.push(list[i]);
        cursor.set(c, levelOf(mastery, c) === 'proficient' ? i - 1 : i + 1);
        progressed = true;
      }
    }
  }
  return session;
}
