import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGet } from '../lib/api.js';

function LessonRow({ lesson }) {
  const glyph = lesson.status === 'completed' ? '✓' : lesson.status === 'locked' ? '🔒' : '▶';
  const row = (
    <div className={`course-lesson course-lesson--${lesson.status}`}>
      <span className="course-lesson-glyph">{glyph}</span>
      <span>{lesson.title}</span>
    </div>
  );
  return lesson.status === 'locked' ? row : <Link to={`/aula/${lesson.id}`}>{row}</Link>;
}

export default function Course() {
  const { slug } = useParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet(`/courses/${slug}`)
      .then((d) => setCourse(d.course))
      .catch((e) => setError(e.message));
  }, [slug]);

  return (
    <>
      <Header />
      <main className="container course-page">
        {error && <p className="rm-error">{error}</p>}
        {course && (
          <>
            <Link to="/roadmap" className="course-back">← Roadmap</Link>
            <h1>{course.title}</h1>
            <p className="rm-lead">{course.description}</p>
            <p className="badge is-gold">
              Badge: {course.badgeName} · +{course.pointsReward} NeuroPoints
            </p>
            <div className="course-lessons">
              {course.lessons.map((l) => (
                <LessonRow key={l.id} lesson={l} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
