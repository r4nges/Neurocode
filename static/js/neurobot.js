/* ==========================================================================
   NeuroCode · NeuroBot — chat interativo
   Usa /api/neurobot quando o backend Flask está disponível; caso contrário
   responde com a base de conhecimento local (NC.botKnowledge).
   ========================================================================== */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const API = location.protocol === "file:" ? null : "";

  const log = $("#bot-log");
  const form = $("#bot-form");
  const input = $("#bot-input");
  const suggestWrap = $("#bot-suggest");
  if (!log || !form) return;

  const BOT_AVATAR = `<span class="m-ava"><i data-lucide="bot"></i></span>`;

  /* ---- helpers de render ---- */
  function scrollDown() { log.scrollTop = log.scrollHeight; }

  function addMessage(text, who = "bot") {
    const el = document.createElement("div");
    el.className = `msg ${who}`;
    el.innerHTML = (who === "bot" ? BOT_AVATAR : "") + `<div class="bubble">${text}</div>`;
    log.appendChild(el);
    if (window.lucide) lucide.createIcons({ nameAttr: "data-lucide", root: el });
    scrollDown();
    return el;
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "msg bot";
    el.innerHTML = BOT_AVATAR + `<div class="bubble"><span class="typing"><span></span><span></span><span></span></span></div>`;
    log.appendChild(el);
    if (window.lucide) lucide.createIcons({ nameAttr: "data-lucide", root: el });
    scrollDown();
    return el;
  }

  /* ---- motor de resposta local (fallback) ---- */
  function normalize(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function localReply(text) {
    const t = normalize(text);
    for (const k of NC.botKnowledge) {
      if (k.match.some((m) => t.includes(normalize(m)))) return k.reply;
    }
    return NC.botFallback;
  }

  async function getReply(text) {
    if (API !== null) {
      try {
        const r = await fetch("/api/neurobot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensagem: text }),
        });
        if (r.ok) {
          const data = await r.json();
          if (data?.resposta) return data.resposta;
        }
      } catch (_) { /* cai no local */ }
    }
    return localReply(text);
  }

  let busy = false;
  async function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true;
    addMessage(escapeHtml(text), "user");
    input.value = "";
    const typing = showTyping();
    const [reply] = await Promise.all([
      getReply(text),
      new Promise((res) => setTimeout(res, 550 + Math.random() * 450)),
    ]);
    typing.remove();
    addMessage(reply, "bot");
    busy = false;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* ---- sugestões ---- */
  if (suggestWrap) {
    suggestWrap.innerHTML = NC.botSuggestions.map((s) => `<button type="button">${s}</button>`).join("");
    suggestWrap.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) send(b.textContent);
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    send(input.value);
  });

  /* ---- mensagem de abertura ---- */
  setTimeout(() => addMessage("Olá! 👋 Eu sou o <b>NeuroBot</b>. Posso explicar conceitos, recomendar uma trilha ou tirar dúvidas. Como posso ajudar?"), 350);
})();
