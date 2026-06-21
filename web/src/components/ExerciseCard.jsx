import { useState } from 'react';

export default function ExerciseCard({ exercise, disabled, onSubmit }) {
  const { type, prompt, options } = exercise;
  const [choice, setChoice] = useState(null);
  const [text, setText] = useState('');
  const [order, setOrder] = useState(options ? options.map((_, i) => i) : []);

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }

  function submit() {
    if (type === 'multiple-choice') onSubmit(choice);
    else if (type === 'order-lines') onSubmit(order);
    else onSubmit(text);
  }

  const canSubmit =
    type === 'multiple-choice' ? choice !== null :
    type === 'order-lines' ? true :
    text.trim().length > 0;

  return (
    <div className="ex-card">
      <p className="ex-prompt">{prompt}</p>

      {type === 'multiple-choice' && (
        <div className="ex-options">
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`ex-option ${choice === i ? 'is-selected' : ''}`}
              disabled={disabled}
              onClick={() => setChoice(i)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {(type === 'fill-blank' || type === 'predict-output') && (
        <input
          className="ex-input"
          type="text"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          placeholder={type === 'predict-output' ? 'Digite a saída esperada' : 'Sua resposta'}
        />
      )}

      {type === 'order-lines' && (
        <ul className="ex-order">
          {order.map((optIdx, i) => (
            <li key={optIdx} className="ex-order-line">
              <code>{options[optIdx]}</code>
              <span className="ex-order-ctrls">
                <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label="Subir">↑</button>
                <button type="button" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} aria-label="Descer">↓</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button className="btn btn-primary ex-check" disabled={disabled || !canSubmit} onClick={submit}>
        Verificar
      </button>
    </div>
  );
}
