import { useEffect, useState } from 'react';
import ExerciseCard from './ExerciseCard.jsx';
import { apiGet, apiPost } from '../lib/api.js';

export default function ExerciseSession({ lessonId, onDone }) {
  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);     // exercícios restantes (re-enfileira erro)
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null); // { correct, solution }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // resultado da conclusão
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    apiGet(`/lessons/${lessonId}/session`)
      .then((s) => { setSession(s); setQueue(s.exercises); })
      .catch((e) => setError(e.message));
  }, [lessonId]);

  async function answer(submitted) {
    if (busy || !queue.length) return;
    setBusy(true);
    const current = queue[0];
    try {
      const res = await apiPost(`/exercises/${current.id}/attempt`, { sessionToken: session.sessionToken, answer: submitted });
      setFeedback(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    const current = queue[0];
    const wasCorrect = feedback?.correct;
    setFeedback(null);
    // Erro: re-enfileira ao final para repetir até acertar (Duolingo). Acerto: remove.
    const rest = wasCorrect ? queue.slice(1) : [...queue.slice(1), current];
    if (wasCorrect) setDoneCount((c) => c + 1);
    if (rest.length === 0) {
      try {
        const r = await apiPost(`/lessons/${lessonId}/complete`, { sessionToken: session.sessionToken });
        setResult(r);
        onDone?.(r);
      } catch (e) {
        setError(e.message);
      }
    }
    setQueue(rest);
  }

  if (error) return <p className="rm-error">{error}</p>;
  if (!session) return <p>Carregando exercícios…</p>;

  if (result) {
    return (
      <div className="ex-result">
        {result.completed
          ? <p className="ex-pass">✓ Aula concluída — {result.score}% de acerto!</p>
          : <p className="ex-fail">Você fez {result.score}%. São necessários 80% — refaça para concluir.</p>}
        {result.completed && result.nextLessonId && (
          <a className="btn btn-primary" href={`/aula/${result.nextLessonId}`}>Próxima aula</a>
        )}
        {result.completed && !result.nextLessonId && (
          <a className="btn btn-primary" href={`/curso/${session.courseSlug}`}>Voltar à matéria</a>
        )}
        {!result.completed && (
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Refazer</button>
        )}
      </div>
    );
  }

  const total = session.exercises.length;
  const current = queue[0];
  return (
    <div className="ex-session">
      <div className="progress ex-progress"><span style={{ width: `${(doneCount / total) * 100}%` }} /></div>
      {current && (
        <ExerciseCard exercise={current} disabled={!!feedback} onSubmit={answer} />
      )}
      {feedback && (
        <div className={`ex-feedback ${feedback.correct ? 'is-ok' : 'is-bad'}`}>
          <p>{feedback.correct ? 'Correto!' : 'Ainda não. Vamos repetir esse mais tarde.'}</p>
          <button className="btn btn-primary" onClick={next}>Continuar</button>
        </div>
      )}
    </div>
  );
}
