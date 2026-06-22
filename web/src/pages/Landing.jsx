import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGet } from '../lib/api.js';

const TRAILS = [
  { icon: '🎨', cls: 'ic-purple', title: 'Desenvolvedor Front-end', desc: 'HTML, CSS e JavaScript — do primeiro elemento à primeira página no ar.', meta: '3 matérias · iniciante', open: true },
  { icon: '🛠️', cls: 'ic-cyan', title: 'Back-end & APIs', desc: 'Servidores, bancos de dados e rotas. Em breve na plataforma.', meta: 'em breve', open: false },
  { icon: '📱', cls: 'ic-green', title: 'Mobile', desc: 'Apps para Android e iOS com uma base só. Em breve na plataforma.', meta: 'em breve', open: false },
];

// Reveal-on-scroll comedido: adiciona .is-visible aos [data-reveal] visíveis.
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = root.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.16 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

export default function Landing() {
  const [apiOk, setApiOk] = useState(null);
  const pageRef = useReveal();

  useEffect(() => {
    apiGet('/health')
      .then((d) => setApiOk(d.status === 'ok'))
      .catch(() => setApiOk(false));
  }, []);

  return (
    <>
      <Header />
      <div ref={pageRef}>
        <main>
          {/* ===== HERO ===== */}
          <section className="landing-hero">
            <div className="hero-decor" aria-hidden="true">
              <span style={{ top: '14%', left: '5%', fontSize: '2.2rem' }}>&lt;/&gt;</span>
              <span style={{ top: '64%', left: '3%', fontSize: '1.6rem' }}>{'{ }'}</span>
              <span style={{ top: '26%', right: '4%', fontSize: '1.8rem' }}>( )</span>
              <span style={{ top: '78%', right: '9%', fontSize: '2rem' }}>=&gt;</span>
              <span style={{ top: '10%', right: '32%', fontSize: '1.3rem' }}>[ ]</span>
            </div>

            <div className="container hero-grid">
              <div className="hero-copy">
                <span className="hero-pill" data-reveal>
                  <span className="tag">EAD</span> Aprendizado adaptativo por perfil
                </span>

                <h1 data-reveal data-reveal-delay="1">
                  Seu cérebro,<br />seu ritmo,<br />
                  <span className="h-hand">seu código.</span>
                </h1>

                <p className="hero-lead" data-reveal data-reveal-delay="2">
                  A plataforma de programação que se adapta a <b>como você aprende</b>.
                  Trilhas guiadas, exercícios que se ajustam ao seu ritmo e progresso com
                  XP, streaks e badges — do zero ao primeiro projeto no ar.
                </p>

                <div className="hero-cta" data-reveal data-reveal-delay="3">
                  <Link to="/register" className="btn btn-primary">🚀 Começar agora</Link>
                  <a href="#trilhas" className="btn btn-ghost">🧭 Ver trilhas</a>
                </div>

                <div className="hero-meta" data-reveal data-reveal-delay="4">
                  <div className="hero-avatars">
                    <div className="stack">
                      <span style={{ background: '#FF6B9D' }}>M</span>
                      <span style={{ background: '#6C5CE7' }}>J</span>
                      <span style={{ background: '#00CFFF' }}>C</span>
                      <span style={{ background: '#00C896' }}>D</span>
                    </div>
                    <div>
                      <div className="stars">★★★★★</div>
                      <small>aprendizado no seu ritmo</small>
                    </div>
                  </div>
                  <div className="divider" />
                  <div className="meta-item">
                    <span className="meta-num gradient-text">3</span>
                    <span className="meta-lbl">modos de estudo</span>
                  </div>
                </div>

                {apiOk === true && <p className="api-status">● API online</p>}
                {apiOk === false && <p className="api-status off">● API offline</p>}
              </div>

              {/* editor de código */}
              <div className="hero-visual" data-reveal data-reveal-delay="2">
                <div className="code-card float-soft">
                  <div className="code-top">
                    <span className="dot r" /><span className="dot y" /><span className="dot g" />
                    <span className="file">primeiro_passo.py — <span className="run">▶ run</span></span>
                  </div>
                  <pre className="code-body">
                    <span className="ln">1</span><span className="tok-com"># NeuroCode · sua jornada começa aqui</span>{'\n'}
                    <span className="ln">2</span><span className="tok-kw">def</span>{' '}<span className="tok-fn">aprender</span>(<span className="tok-var">aluno</span>):{'\n'}
                    <span className="ln">3</span>{'    '}trilha = <span className="tok-fn">recomendar</span>(<span className="tok-var">aluno</span>.perfil){'\n'}
                    <span className="ln">4</span>{'    '}<span className="tok-kw">while</span>{' '}<span className="tok-var">aluno</span>.curioso:{'\n'}
                    <span className="ln">5</span>{'        '}<span className="tok-var">aluno</span>.xp += <span className="tok-num">10</span>{'\n'}
                    <span className="ln">6</span>{'        '}<span className="tok-fn">desbloquear</span>(<span className="tok-str">"conquista"</span>){'\n'}
                    <span className="ln">7</span>{'    '}<span className="tok-kw">return</span>{' '}<span className="tok-str">"dev 🚀"</span><span className="caret">{' '}</span>
                  </pre>
                  <div className="code-out">→ saída: aluno virou dev 🚀 · nível 3 · 4 dias de sequência 🔥</div>
                </div>

                <div className="floaty xp float">
                  <span className="ic ic-purple">⚡</span>
                  <div><strong>+10 XP</strong><span>aula concluída</span></div>
                </div>
                <div className="floaty streak float" style={{ animationDelay: '1.2s' }}>
                  <span className="ic ic-orange">🔥</span>
                  <div><strong>4 dias</strong><span>sequência ativa</span></div>
                </div>
                <div className="floaty badge-f float" style={{ animationDelay: '0.6s' }}>
                  <span className="ic ic-gold">🏆</span>
                  <div><strong>Nível 3</strong><span>subiu de nível!</span></div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== TRILHAS ===== */}
          <section className="section landing-trails" id="trilhas">
            <div className="container">
              <div className="section-head">
                <span className="eyebrow" data-reveal>Trilhas de aprendizado</span>
                <h2 className="section-title" data-reveal data-reveal-delay="1">
                  Escolha por onde <span className="gradient-text">começar a programar</span>
                </h2>
                <p className="section-sub" data-reveal data-reveal-delay="2">
                  Comece pela trilha Front-end e avance no seu ritmo. Cada matéria libera a próxima.
                </p>
              </div>

              <div className="trail-grid">
                {TRAILS.map((t, i) => {
                  const card = (
                    <article
                      className={`trail-card ${t.open ? 'trail-card--open' : 'trail-card--locked'}`}
                      data-reveal
                      data-reveal-delay={String(i + 1)}
                    >
                      <span className={`trail-ic ${t.cls}`}>{t.icon}</span>
                      <h3>{t.title}</h3>
                      <p>{t.desc}</p>
                      <div className="trail-foot">
                        <span>{t.meta}</span>
                        <span className="trail-go">{t.open ? 'Começar →' : '🔒 Em breve'}</span>
                      </div>
                    </article>
                  );
                  return t.open ? (
                    <Link key={t.title} to="/register">{card}</Link>
                  ) : (
                    <div key={t.title}>{card}</div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>

        {/* ===== FOOTER ===== */}
        <footer className="site-footer">
          <div className="container">
            <div className="footer-inner">
              <div>
                <span className="brand">
                  <span className="brand-mark"><img src="/logo.svg" alt="" /></span>
                  <span><b>Neuro</b><span className="accent">Code</span></span>
                </span>
                <p className="footer-tag">Programação adaptativa e gamificada. Seu cérebro, seu ritmo, seu código.</p>
              </div>
              <div className="hero-cta">
                <Link to="/register" className="btn btn-primary btn-sm">Criar conta grátis</Link>
                <Link to="/login" className="btn btn-ghost btn-sm">Entrar</Link>
              </div>
            </div>
            <div className="footer-bottom">
              <span>© 2026 NeuroCode · projeto acadêmico.</span>
              <span>Feito para quem aprende a programar.</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
