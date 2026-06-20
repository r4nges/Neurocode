// Correção server-autoritativa por tipo de exercício. Puro (sem I/O).
// Codificação (ver Global Constraints):
//   multiple-choice → answer: índice (number); submitted: índice
//   fill-blank      → answer: string;          submitted: string (normalizada)
//   predict-output  → answer: string (saída);  submitted: string (normalizada)
//   order-lines     → answer: array de índices na ordem correta; submitted: array de índices

export function normalize(s) {
  return String(s).trim().replace(/\s+/g, ' ').toLowerCase();
}

export function grade(exercise, submitted) {
  let answer;
  try {
    answer = JSON.parse(exercise.answer);
  } catch {
    return false;
  }
  switch (exercise.type) {
    case 'multiple-choice':
      return Number(submitted) === Number(answer);
    case 'fill-blank':
    case 'predict-output':
      return normalize(submitted) === normalize(answer);
    case 'order-lines': {
      if (!Array.isArray(submitted) || !Array.isArray(answer)) return false;
      if (submitted.length !== answer.length) return false;
      return submitted.every((v, i) => Number(v) === Number(answer[i]));
    }
    default:
      return false;
  }
}
