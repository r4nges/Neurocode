import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiGet, apiPost } from '../lib/api.js';

export default function Onboarding() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [choice, setChoice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/onboarding').then((d) => setQuestions(d.questions)).catch((e) => setError(e.message));
  }, []);

  async function advance() {
    const q = questions[idx];
    const next = [...answers, { exerciseId: q.id, answer: choice ?? 0 }];
    setChoice(null);
    if (idx + 1 < questions.length) {
      setAnswers(next);
      setIdx(idx + 1);
    } else {
      try {
        await apiPost('/onboarding', { answers: next });
        await refresh();
        navigate('/dashboard');
      } catch (e) {
        setError(e.message);
      }
    }
  }

  const q = questions.length > 0 ? questions[idx] : null;
  const last = questions.length > 0 && idx + 1 === questions.length;

  return (
    <>
      <Header />
      <main className="container onboarding-page">
        <h1>Vamos calibrar seu aprendizado</h1>
        <p className="onboarding-sub">3 perguntas rápidas para personalizar seus exercícios.</p>
        {error && <p className="rm-error">{error}</p>}
        {q && (
          <div className="ex-card">
            <p className="ex-prompt">{q.prompt}</p>
            <div className="ex-options">
              {q.options.map((opt, i) => (
                <button key={i} type="button"
                  className={`ex-option ${choice === i ? 'is-selected' : ''}`}
                  onClick={() => setChoice(i)}>
                  {opt}
                </button>
              ))}
            </div>
            <button className="btn btn-primary ex-check" disabled={choice === null} onClick={advance}>
              {last ? 'Concluir' : 'Próxima'}
            </button>
          </div>
        )}
      </main>
    </>
  );
}
