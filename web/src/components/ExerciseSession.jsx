import { useEffect, useRef, useState } from 'react';
import ExerciseCard from './ExerciseCard.jsx';
import { apiGet, apiPost } from '../lib/api.js';

const CELEBRATE_MS = 1200; // duração da animação de conclusão antes de revelar o resumo

export default function ExerciseSession({ lessonId, onDone }) {
  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);     // exercícios restantes (re-enfileira erro)
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null); // { correct }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // resultado da conclusão
  const [doneCount, setDoneCount] = useState(0);
  const [round, setRound] = useState(0);      // muda a cada avanço -> remonta o card (reseta seleção)
  const [phase, setPhase] = useState('quiz'); // 'quiz' | 'celebrate' | 'done'
  const celebrateTimer = useRef(null);

  useEffect(() => {
    apiGet(`/lessons/${lessonId}/session`)
      .then((s) => { setSession(s); setQueue(s.exercises); })
      .catch((e) => setError(e.message));
  }, [lessonId]);

  useEffect(() => () => clearTimeout(celebrateTimer.current), []);

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
    setRound((r) => r + 1); // novo round -> nova key -> card remonta limpo (mesmo se repetir o exercício)
    // Erro: re-enfileira ao final para repetir até acertar (Duolingo). Acerto: remove.
    const rest = wasCorrect ? queue.slice(1) : [...queue.slice(1), current];
    if (wasCorrect) setDoneCount((c) => c + 1);
    setQueue(rest);

    if (rest.length === 0) {
      // Zerou a fila (100%): entra na celebração, conclui no servidor e só então revela
      // o resumo — a barra completa e o glyph dá continuidade para a tela de conclusão.
      setPhase('celebrate');
      const started = Date.now();
      try {
        const r = await apiPost(`/lessons/${lessonId}/complete`, { sessionToken: session.sessionToken });
        setResult(r);
        onDone?.(r);
        if (!r.completed) {
          setPhase('done'); // sem celebração quando não atingiu o limiar
        } else {
          const wait = Math.max(0, CELEBRATE_MS - (Date.now() - started));
          celebrateTimer.current = window.setTimeout(() => setPhase('done'), wait);
        }
      } catch (e) {
        setError(e.message);
      }
    }
  }

  if (error) return <p className="rm-error">{error}</p>;
  if (!session) return <p>Carregando exercícios…</p>;

  const total = session.exercises.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const current = queue[0];
  const showResult = phase === 'celebrate' || phase === 'done';
  const failed = result && !result.completed;

  return (
    <div className="ex-session">
      <div className="ex-progress-wrap">
        <div className="ex-progress-meta">
          <span>{doneCount} de {total} concluídos</span>
          <span>{pct}%</span>
        </div>
        <div className="progress ex-progress"><span style={{ width: `${pct}%` }} /></div>
      </div>

      {phase === 'quiz' && (
        <>
          {current && (
            <ExerciseCard key={`${current.id}-${round}`} exercise={current} disabled={!!feedback} onSubmit={answer} />
          )}
          {feedback && (
            <div className={`ex-feedback ${feedback.correct ? 'is-ok' : 'is-bad'}`} role="status">
              <div className="ex-feedback-inner">
                <span className="ex-feedback-icon" aria-hidden="true">{feedback.correct ? '✓' : '↻'}</span>
                <p>{feedback.correct ? 'Correto!' : 'Ainda não. Vamos repetir esse mais tarde.'}</p>
                {feedback.explanation && <p className="ex-explanation">{feedback.explanation}</p>}
                <button className="btn btn-primary" onClick={next} autoFocus>Continuar</button>
              </div>
            </div>
          )}
        </>
      )}

      {showResult && failed && (
        <div className="ex-result ex-result--fail card">
          <span className="ex-result-glyph" aria-hidden="true">↻</span>
          <h2 className="ex-fail">Quase lá!</h2>
          <p className="ex-result-sub">Você fez {result.score}%. São necessários 80% — refaça para concluir.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Refazer</button>
        </div>
      )}

      {showResult && !failed && (
        <div className={`ex-result ex-result--done card ${phase === 'done' ? 'is-done' : 'is-celebrating'}`}>
          <span className="ex-result-glyph ex-result-glyph--win" aria-hidden="true">🎉</span>
          <h2 className="ex-pass">Aula concluída!</h2>

          {result && (
            <div className="ex-done-reveal">
              <p className="ex-result-sub">{result.score}% de acerto</p>

              {result.streak != null && (
                <div className="ex-reward">
                  {result.xpAwarded > 0 && (
                    <div className="reward-tile">
                      <span className="reward-tile-val">+{result.xpAwarded} XP</span>
                      <span className="reward-tile-lbl">experiência</span>
                    </div>
                  )}
                  <div className="reward-tile">
                    <span className="reward-tile-val">🔥 {result.streak}</span>
                    <span className="reward-tile-lbl">dia(s) de ofensiva</span>
                  </div>
                  {result.leveledUp && (
                    <div className="reward-tile reward-tile--up">
                      <span className="reward-tile-val">⬆️ Nível {result.level}</span>
                      <span className="reward-tile-lbl">subiu de nível</span>
                    </div>
                  )}
                  {result.badge && (
                    <div className="reward-tile reward-tile--badge">
                      <span className="reward-tile-val">🏅 {result.badge.badgeName}</span>
                      <span className="reward-tile-lbl">
                        {result.pointsAwarded ? `+${result.pointsAwarded} NeuroPoints` : 'badge desbloqueado'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="ex-result-actions">
                {result.nextLessonId
                  ? <a className="btn btn-primary" href={`/aula/${result.nextLessonId}`}>Próxima aula</a>
                  : <a className="btn btn-primary" href={`/curso/${session.courseSlug}`}>Voltar à matéria</a>}
                <a className="btn btn-ghost" href="/dashboard">🏠 Início</a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
