/* ==========================================================================
   NeuroCode · UI — navegação, tema, reveal, contadores, render dinâmico
   ========================================================================== */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const API = location.protocol === "file:" ? null : ""; // backend opcional

  /* ----------------------------------------------------- Ícones (Lucide) */
  function icons() {
    if (window.lucide && typeof lucide.createIcons === "function") lucide.createIcons();
  }

  /* -------------------------------------------------------- Header scroll */
  const header = $(".site-header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ----------------------------------------------------------- Menu mobile */
  const navToggle = $(".nav-toggle");
  const mobileMenu = $(".mobile-menu");
  navToggle?.addEventListener("click", () => {
    const open = mobileMenu.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  $$(".mobile-menu a").forEach((a) =>
    a.addEventListener("click", () => mobileMenu.classList.remove("is-open"))
  );

  /* -------------------------------------------------------- Tema claro/escuro */
  const THEME_KEY = "nc-theme";
  const root = document.documentElement;
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) root.setAttribute("data-theme", saved);
  $$(".theme-toggle").forEach((btn) =>
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
    })
  );

  /* ------------------------------------------------ Reveal on scroll */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
          // dispara barras de progresso e contadores ao surgir
          $$("[data-progress]", e.target).forEach(fillBar);
          if (e.target.matches("[data-progress]")) fillBar(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  const observeReveals = () => $$("[data-reveal]").forEach((el) => io.observe(el));

  function fillBar(el) {
    const v = el.getAttribute("data-progress");
    const span = el.querySelector("span");
    if (span) requestAnimationFrame(() => (span.style.width = v + "%"));
  }

  /* ------------------------------------------------ Contadores animados */
  const counterIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        animateCount(e.target);
        counterIO.unobserve(e.target);
      });
    },
    { threshold: 0.5 }
  );
  function animateCount(el) {
    const target = parseFloat(el.getAttribute("data-count"));
    const dec = (el.getAttribute("data-count").split(".")[1] || "").length;
    const dur = 1600;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      el.firstChild.textContent = val.toLocaleString("pt-BR", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const observeCounters = () => $$("[data-count]").forEach((el) => counterIO.observe(el));

  /* ------------------------------------------------ Scrollspy (nav ativo) */
  const navItems = $$(".nav-links a[data-spy]");
  const spyIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = e.target.id;
        navItems.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + id));
      });
    },
    { threshold: 0.4, rootMargin: "-20% 0px -55% 0px" }
  );

  /* ===================================================================
     Render dinâmico
     =================================================================== */

  /* ---- Cursos ---- */
  function courseCard(c) {
    const glyph = NC.langGlyph[c.lang] || "";
    return `
      <article class="course-card" data-level="${c.level}" data-reveal>
        <div class="course-top" style="background:linear-gradient(135deg, ${hex(c.color, .14)}, transparent);">
          <div class="course-lang-ic">${glyph}</div>
          <span class="badge ${c.badge[1]}">${c.badge[0]}</span>
          <div class="glyph" aria-hidden="true">${glyph}</div>
        </div>
        <div class="course-body">
          <h3>${c.title}</h3>
          <p>${c.desc}</p>
          <div class="course-foot">
            <div class="meta">
              <span><i data-lucide="book-open"></i>${c.lessons} aulas</span>
              <span><i data-lucide="clock"></i>${c.hours}h</span>
            </div>
            <span class="course-arrow" aria-hidden="true"><i data-lucide="arrow-right"></i></span>
          </div>
        </div>
      </article>`;
  }

  function renderCourses(list) {
    const grid = $("#courses-grid");
    if (!grid) return;
    grid.innerHTML = list.map(courseCard).join("");
    icons();
    $$("[data-reveal]", grid).forEach((el) => io.observe(el));
  }

  function setupFilters() {
    const row = $("#course-filters");
    if (!row) return;
    row.innerHTML = NC.filters
      .map((f, i) => `<button class="chip ${i === 0 ? "is-active" : ""}" data-filter="${f.key}">${f.label}</button>`)
      .join("");
    row.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      $$(".chip", row).forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      const key = btn.dataset.filter;
      const list = key === "todos" ? NC.courses : NC.courses.filter((c) => c.level === key);
      renderCourses(list);
    });
  }

  async function loadCourses() {
    let list = NC.courses;
    if (API !== null) {
      try {
        const r = await fetch("/api/cursos", { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data?.cursos) && data.cursos.length) list = data.cursos;
        }
      } catch (_) { /* usa fallback local */ }
    }
    NC.courses = list;
    renderCourses(list);
  }

  /* ---- Depoimentos ---- */
  function renderTestimonials() {
    const grid = $("#testi-grid");
    if (!grid) return;
    const star = `<svg viewBox="0 0 24 24"><path d="M12 2l3 6.3 6.9 1-5 4.8 1.2 6.9L12 17.8 5.9 21l1.2-6.9-5-4.8 6.9-1z"/></svg>`;
    grid.innerHTML = NC.testimonials
      .map(
        (t, i) => `
      <figure class="testi" data-reveal data-reveal-delay="${(i % 3) + 1}">
        <div class="stars">${star.repeat(5)}</div>
        <blockquote><p>“${t.quote}”</p></blockquote>
        <figcaption class="who">
          <span class="avatar" style="background:${t.color}">${initials(t.name)}</span>
          <span><b>${t.name}</b><span>${t.role}</span></span>
        </figcaption>
      </figure>`
      )
      .join("");
    $$("[data-reveal]", grid).forEach((el) => io.observe(el));
  }

  /* ---- FAQ ---- */
  function renderFaq() {
    const wrap = $("#faq");
    if (!wrap) return;
    wrap.innerHTML = NC.faqs
      .map(
        (f, i) => `
      <div class="faq-item ${i === 0 ? "is-open" : ""}" data-reveal>
        <button class="faq-q" aria-expanded="${i === 0}">
          <span>${f.q}</span>
          <i data-lucide="chevron-down" class="chev"></i>
        </button>
        <div class="faq-a"><p>${f.a}</p></div>
      </div>`
      )
      .join("");
    icons();
    wrap.addEventListener("click", (e) => {
      const q = e.target.closest(".faq-q");
      if (!q) return;
      const item = q.parentElement;
      const open = item.classList.toggle("is-open");
      q.setAttribute("aria-expanded", String(open));
      syncFaqHeights();
    });
    $$("[data-reveal]", wrap).forEach((el) => io.observe(el));
    requestAnimationFrame(syncFaqHeights);
  }
  function syncFaqHeights() {
    $$(".faq-item").forEach((item) => {
      const a = item.querySelector(".faq-a");
      a.style.maxHeight = item.classList.contains("is-open") ? a.scrollHeight + "px" : "0px";
    });
  }
  window.addEventListener("resize", syncFaqHeights);

  /* ---- Utils ---- */
  function initials(name) {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  }
  function hex(h, a) {
    const n = h.replace("#", "");
    const r = parseInt(n.substring(0, 2), 16),
      g = parseInt(n.substring(2, 4), 16),
      b = parseInt(n.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  NC.hex = hex;
  NC.initials = initials;

  /* ------------------------------------------------ Init */
  function init() {
    icons();
    setupFilters();
    loadCourses();
    renderTestimonials();
    renderFaq();
    observeReveals();
    observeCounters();
    $$("section[id]").forEach((s) => spyIO.observe(s));
    document.body.classList.add("ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
