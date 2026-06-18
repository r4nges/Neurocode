/* ==========================================================================
   NeuroCode · Formulários — inscrição / newsletter
   Envia para /api/inscricao quando o backend está ativo; caso contrário
   simula o envio localmente. Sempre dá feedback via toast.
   ========================================================================== */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const API = location.protocol === "file:" ? null : "";

  /* ---- Toast ---- */
  let toastEl;
  function toast(msg, ok = true) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML =
      `<i data-lucide="${ok ? "circle-check-big" : "circle-alert"}"></i><span>${msg}</span>`;
    if (window.lucide) lucide.createIcons({ root: toastEl });
    if (!ok) toastEl.querySelector("svg").style.color = "var(--c-red-soft)";
    requestAnimationFrame(() => toastEl.classList.add("is-show"));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("is-show"), 4200);
  }
  window.NC = window.NC || {};
  NC.toast = toast;

  /* ---- Validação simples de e-mail ---- */
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function submitInscricao(payload) {
    if (API !== null) {
      try {
        const r = await fetch("/api/inscricao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) return (await r.json())?.mensagem || "Inscrição confirmada!";
      } catch (_) { /* fallback abaixo */ }
    }
    // fallback offline
    await new Promise((res) => setTimeout(res, 500));
    return null;
  }

  document.querySelectorAll("[data-form='inscricao']").forEach((form) => {
    const btn = form.querySelector("button[type='submit']");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = form.querySelector("input[type='email']").value.trim();
      if (!emailRe.test(email)) {
        toast("Digite um e-mail válido para continuar.", false);
        return;
      }
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = "Enviando…";
      const msg = await submitInscricao({ email, origem: form.dataset.origem || "site" });
      btn.disabled = false;
      btn.innerHTML = original;
      if (window.lucide) lucide.createIcons({ root: btn });
      form.reset();
      toast(msg || `Tudo certo! Enviamos as próximas aulas para ${email} 🎉`);
    });
  });
})();
