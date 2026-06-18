import { Routes, Route } from 'react-router-dom';

function Landing() {
  return <h1>Seu cérebro, seu ritmo, seu código.</h1>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
    </Routes>
  );
}
