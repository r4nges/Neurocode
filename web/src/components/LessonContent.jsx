export default function LessonContent({ blocks }) {
  return (
    <div className="lesson-content">
      {(blocks ?? []).map((b, i) => {
        if (b.type === 'heading') return <h3 key={i}>{b.text}</h3>;
        if (b.type === 'paragraph') return <p key={i}>{b.text}</p>;
        if (b.type === 'code')
          return (
            <pre key={i} className="lesson-code">
              <code>{b.text}</code>
            </pre>
          );
        if (b.type === 'list')
          return (
            <ul key={i} className="lesson-list">
              {(b.items ?? []).map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        return null;
      })}
    </div>
  );
}
