import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGet } from '../lib/api.js';

const FE_SLUG = 'desenvolvedor-front-end';

function CourseNode({ course }) {
  const glyph = course.completed ? '✓' : course.locked ? '🔒' : course.order;
  const body = (
    <div className={`rm-node rm-node--${course.completed ? 'done' : course.locked ? 'locked' : 'open'}`}>
      <span className="rm-node-glyph">{glyph}</span>
      <div className="rm-node-info">
        <strong>{course.title}</strong>
        <span className="rm-node-sub">
          {course.lessonsCompleted}/{course.lessonsTotal} aulas · +{course.pointsReward} pts
        </span>
      </div>
    </div>
  );
  return course.locked ? body : <Link to={`/curso/${course.slug}`}>{body}</Link>;
}

export default function Roadmap() {
  const [roadmap, setRoadmap] = useState(null);
  const [careers, setCareers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([apiGet(`/roadmaps/${FE_SLUG}`), apiGet('/roadmaps')])
      .then(([a, b]) => {
        setRoadmap(a.roadmap);
        setCareers(b.roadmaps.filter((r) => r.slug !== FE_SLUG));
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Header />
      <main className="container rm-page">
        {error && <p className="rm-error">{error}</p>}
        {roadmap && (
          <>
            <h1>{roadmap.title}</h1>
            <p className="rm-lead">{roadmap.description}</p>
            <div className="rm-trail">
              {roadmap.courses.map((c) => (
                <CourseNode key={c.slug} course={c} />
              ))}
            </div>
            <h2 className="rm-careers-title">Outras carreiras</h2>
            <div className="rm-careers">
              {careers.map((c) => (
                <div key={c.slug} className="rm-career card">
                  <strong>{c.title}</strong>
                  <p>{c.description}</p>
                  <span className="badge">🔒 Bloqueado</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
