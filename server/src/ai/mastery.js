// Maestria por conceito a partir das tentativas. Puro (sem I/O).
const WINDOW = 5;
const PROFICIENT = 0.8;
const MIN_SAMPLE = 3; // amostra mínima para creditar "proficient" (anti cold-start, DT-02)

// Classifica assimetricamente: difícil virar proficient (exige prova),
// fácil virar weak (um erro já pede mais prática).
function classify(count, accuracy) {
  if (count === 0) return 'new';
  if (accuracy < PROFICIENT) return 'weak';
  return count >= MIN_SAMPLE ? 'proficient' : 'new';
}

// attempts: [{ conceptTag, correct, answeredAt }]
export function computeMastery(attempts) {
  const sorted = [...attempts].sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt));
  const byConcept = new Map();
  for (const at of sorted) {
    const list = byConcept.get(at.conceptTag) ?? [];
    if (list.length < WINDOW) list.push(at);
    byConcept.set(at.conceptTag, list);
  }
  const mastery = new Map();
  for (const [concept, list] of byConcept) {
    const count = list.length;
    const correct = list.filter((x) => x.correct).length;
    const accuracy = count ? correct / count : 0;
    mastery.set(concept, { level: classify(count, accuracy), accuracy, count });
  }
  return mastery;
}

export function levelFor(mastery, concept) {
  return mastery.get(concept)?.level ?? 'new';
}
