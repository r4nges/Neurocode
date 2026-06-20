import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import LessonContent from '../components/LessonContent.jsx';
import { apiGet } from '../lib/api.js';

export default function Lesson() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLesson(null);
    apiGet(`/lessons/${id}`)
      .then((d) => setLesson(d.lesson))
      .catch((e) => setError(e.message));
  }, [id]);

  function concluir() {
    setSaving(true);
    fetch(`/api/lessons/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.nextLessonId) navigate(`/aula/${data.nextLessonId}`);
        else navigate(`/curso/${lesson.courseSlug}`);
      })
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  }

  return (
    <>
      <Header />
      <main className="container lesson-page">
        {error && <p className="rm-error">{error}</p>}
        {lesson && (
          <>
            <p className="lesson-eyebrow">{lesson.courseTitle} · Aula {lesson.order}</p>
            <h1>{lesson.title}</h1>
            <LessonContent blocks={lesson.content} />
            <button className="btn btn-primary lesson-cta" onClick={concluir} disabled={saving}>
              {saving ? 'Salvando…' : 'Concluir aula'}
            </button>
          </>
        )}
      </main>
    </>
  );
}
