import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import LessonContent from '../components/LessonContent.jsx';
import ExerciseSession from '../components/ExerciseSession.jsx';
import { apiGet } from '../lib/api.js';

export default function Lesson() {
  const { id } = useParams();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setLesson(null);
    setStarted(false);
    apiGet(`/lessons/${id}`)
      .then((d) => setLesson(d.lesson))
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <>
      <Header />
      <main className="container lesson-page">
        {error && <p className="rm-error">{error}</p>}
        {lesson && (
          <>
            <p className="lesson-eyebrow">{lesson.courseTitle} · Aula {lesson.order}</p>
            <h1>{lesson.title}</h1>
            {!started ? (
              <>
                <LessonContent blocks={lesson.content} />
                <button className="btn btn-primary lesson-cta" onClick={() => setStarted(true)}>
                  Começar exercícios
                </button>
              </>
            ) : (
              <ExerciseSession lessonId={Number(id)} />
            )}
          </>
        )}
      </main>
    </>
  );
}
