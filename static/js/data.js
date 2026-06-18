/* ==========================================================================
   NeuroCode · Dados da aplicação (fallback client-side)
   Expostos em window.NC para os demais módulos. Quando o backend Flask
   está ativo, ui.js tenta /api/cursos e usa estes dados se falhar.
   ========================================================================== */
window.NC = window.NC || {};

/* Ícones SVG simples por linguagem (sem dependências externas) */
NC.langGlyph = {
  python: `<svg viewBox="0 0 48 48" fill="none"><path d="M23.7 4c-9 0-8.4 3.9-8.4 3.9l.01 4h8.5v1.2H11.9S6.2 12.4 6.2 21.5s5 8.8 5 8.8h3V26s-.16-5 4.9-5h8.4s4.76.08 4.76-4.6V8.7S37 4 23.7 4ZM19 6.6a1.53 1.53 0 1 1 0 3.05 1.53 1.53 0 0 1 0-3.05Z" fill="#3776AB"/><path d="M24.3 44c9 0 8.4-3.9 8.4-3.9l-.01-4h-8.5v-1.2h11.9s5.7.7 5.7-8.4-5-8.8-5-8.8h-3V22s.16 5-4.9 5h-8.4s-4.76-.08-4.76 4.6v7.7S11 44 24.3 44ZM29 41.4a1.53 1.53 0 1 1 0-3.05 1.53 1.53 0 0 1 0 3.05Z" fill="#FFD43B"/></svg>`,
  javascript: `<svg viewBox="0 0 48 48"><rect width="48" height="48" rx="6" fill="#F7DF1E"/><path d="M26 38c1 1.7 2.3 3 4.7 3 2 0 3.3-1 3.3-2.4 0-1.6-1.3-2.2-3.5-3.2l-1.2-.5c-3.5-1.5-5.8-3.3-5.8-7.2 0-3.6 2.7-6.3 7-6.3 3 0 5.2 1 6.8 3.8l-3.7 2.4c-.8-1.5-1.7-2-2.9-2-1.2 0-2 .8-2 2 0 1.3.8 1.9 2.8 2.8l1.2.5c4.1 1.8 6.4 3.5 6.4 7.5 0 4.3-3.4 6.7-8 6.7-4.4 0-7.3-2.1-8.7-4.9L26 38Zm-15 .4c.8 1.4 1.5 2.6 3.2 2.6 1.6 0 2.6-.6 2.6-3.1V21h4.6v17c0 5-2.9 7.2-7.2 7.2-3.8 0-6.1-2-7.3-4.4l4.1-2.4Z" fill="#000"/></svg>`,
  web: `<svg viewBox="0 0 48 48"><path d="M9 6h30l-2.7 30L24 40 11.7 36 9 6Z" fill="#E44D26"/><path d="M24 9.5V37l9.9-3.3L36.2 9.5H24Z" fill="#F16529"/><path d="M16 14h8v4h-4.4l.3 4H24v4l-3.7 1-3.5-1-.2-3h3.9v-1.6l-4.1-.1L16 14Zm8 0h8l-.4 4H24v-4Zm0 8h7.6l-.7 8-3 1-.3.1h-.4l-3.2-1V22Z" fill="#fff"/></svg>`,
  php: `<svg viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="22" ry="13" fill="#777BB3"/><path d="M11 18h5.2c2.6 0 4 1.4 3.6 3.7-.4 2.5-2.3 3.8-5 3.8h-2l-.6 3.2H12L13.6 21h-1.8L11 18Zm3 2-.7 3.6h1.4c1.2 0 2-.5 2.2-1.7.2-1.2-.4-1.6-1.5-1.6L14 20Z" fill="#fff"/><path d="M21.5 15h2.3l-.6 3h2c2.6 0 3.4 1.2 3 3.3l-.9 4.4h-2.4l.9-4.1c.2-1-.1-1.3-1-1.3h-1.8l-1 5.4h-2.3L21.5 15Z" fill="#fff"/><path d="M30.5 18h5.2c2.6 0 4 1.4 3.6 3.7-.4 2.5-2.3 3.8-5 3.8h-2l-.6 3.2H31L32.6 21h-1.8L30.5 18Zm3 2-.7 3.6h1.4c1.2 0 2-.5 2.2-1.7.2-1.2-.4-1.6-1.5-1.6L33.5 20Z" fill="#fff"/></svg>`,
  data: `<svg viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="11" rx="14" ry="5" fill="#00C896"/><path d="M10 11v10c0 2.8 6.3 5 14 5s14-2.2 14-5V11" stroke="#00C896" stroke-width="2.4"/><path d="M10 21v10c0 2.8 6.3 5 14 5s14-2.2 14-5V21" stroke="#00C896" stroke-width="2.4"/></svg>`,
  algo: `<svg viewBox="0 0 48 48" fill="none" stroke="#FF6B30" stroke-width="2.4"><circle cx="24" cy="9" r="5"/><circle cx="11" cy="34" r="5"/><circle cx="37" cy="34" r="5"/><path d="M22 13 13 30M26 13l9 17M16 34h16"/></svg>`,
};

/* Trilhas / cursos */
NC.courses = [
  { id: "web", lang: "web", title: "Desenvolvimento Web", desc: "HTML, CSS e JavaScript do zero até publicar seu primeiro site responsivo.", level: "iniciante", badge: ["Recomendado", "is-pink"], hours: 38, lessons: 64, color: "#FF6B30" },
  { id: "python", lang: "python", title: "Python Completo", desc: "Lógica, variáveis, estruturas de dados e automação com a linguagem mais querida.", level: "iniciante", badge: ["Popular", "is-gold"], hours: 52, lessons: 88, color: "#FFD700" },
  { id: "js", lang: "javascript", title: "JavaScript Moderno", desc: "ES6+, DOM, assíncrono e APIs para dar vida e interação às suas páginas.", level: "intermediario", badge: ["Front-end", "is-cyan"], hours: 44, lessons: 72, color: "#00CFFF" },
  { id: "php", lang: "php", title: "PHP & Back-end", desc: "Servidores, formulários e banco de dados para construir sistemas completos.", level: "intermediario", badge: ["Back-end", "is-pink"], hours: 36, lessons: 58, color: "#9B6BFF" },
  { id: "data", lang: "data", title: "Estrutura de Dados", desc: "Pilhas, filas, árvores e grafos — a base que separa quem programa de quem resolve.", level: "avancado", badge: ["Fundamentos", "is-green"], hours: 40, lessons: 60, color: "#00C896" },
  { id: "algo", lang: "algo", title: "Algoritmos Essenciais", desc: "Ordenação, busca e complexidade para escrever código eficiente e elegante.", level: "avancado", badge: ["Lógica", "is-orange"], hours: 34, lessons: 50, color: "#FF6B30" },
];

NC.filters = [
  { key: "todos", label: "Todos" },
  { key: "iniciante", label: "Iniciante" },
  { key: "intermediario", label: "Intermediário" },
  { key: "avancado", label: "Avançado" },
];

/* Depoimentos */
NC.testimonials = [
  { quote: "O quiz de perfil me colocou na trilha certa logo de cara. Em 3 meses saí do zero e fiz meu primeiro site no ar.", name: "Marina Alves", role: "Trilha Web Dev", color: "#FF6B9D" },
  { quote: "A gamificação é viciante no bom sentido. Manter a sequência de dias me fez estudar Python sem perceber o tempo passar.", name: "João Pereira", role: "Trilha Python", color: "#6C5CE7" },
  { quote: "O NeuroBot tirou minhas dúvidas às 2 da manhã. É como ter um monitor disponível 24 horas, sem julgamento.", name: "Camila Rocha", role: "JavaScript Moderno", color: "#00CFFF" },
  { quote: "Os três modos de estudo — visual, teórico e prático — encaixaram com o jeito que meu cérebro aprende. Faz diferença.", name: "Diego Santos", role: "Estrutura de Dados", color: "#00C896" },
  { quote: "Caí de paraquedas na mentoria com o Carlos e saí com um plano de carreira. Recomendo de olhos fechados.", name: "Beatriz Lima", role: "Trilha Back-end", color: "#FF6B30" },
  { quote: "Consegui meu primeiro freela como dev front-end antes de terminar a trilha. O ranking me deu uma competitividade boa.", name: "Rafael Nunes", role: "JavaScript Moderno", color: "#FFD700" },
];

/* FAQ */
NC.faqs = [
  { q: "Preciso saber programar para começar?", a: "Não. As trilhas iniciantes (como Web Dev e Python) partem absolutamente do zero. Você faz um quiz de perfil e a NeuroCode recomenda o ponto de partida ideal para o seu ritmo." },
  { q: "Como funciona o aprendizado adaptativo?", a: "A plataforma ajusta a ordem e a profundidade das aulas conforme o seu perfil e desempenho nos quizzes. Cada aula tem modos Visual, Teórico e Prático — você escolhe como aprende melhor." },
  { q: "O que é a gamificação da NeuroCode?", a: "Você ganha XP por aula concluída, sobe de nível, desbloqueia conquistas, mantém sequências diárias (streaks) e disputa um ranking. É a motivação de um jogo aplicada ao seu aprendizado." },
  { q: "O NeuroBot substitui um professor?", a: "Ele complementa. O NeuroBot é um assistente de IA disponível 24h para tirar dúvidas e explicar conceitos. Para orientação de carreira e revisão de projetos, você conta com a mentoria humana." },
  { q: "Os cursos têm certificado?", a: "Sim. Ao concluir uma trilha você recebe um certificado digital com a carga horária, válido para comprovar suas competências em processos seletivos." },
  { q: "Posso estudar pelo celular?", a: "Sim. A NeuroCode é 100% responsiva e funciona em qualquer tela — celular, tablet ou computador — com a navegação adaptada para cada dispositivo." },
];

/* Base de respostas do NeuroBot (rule-based, usada como fallback) */
NC.botKnowledge = [
  { match: ["ola", "olá", "oi", "bom dia", "boa tarde", "boa noite", "eai", "e ai"], reply: "Olá! 👋 Eu sou o <b>NeuroBot</b>, seu assistente de estudos. Posso explicar conceitos de programação, recomendar uma trilha ou tirar dúvidas. Sobre o que quer falar?" },
  { match: ["python"], reply: "Python é uma ótima primeira linguagem: sintaxe limpa e legível. Por exemplo, declarar uma variável é só <code>nome = \"Ana\"</code>. A trilha <b>Python Completo</b> tem 88 aulas, do zero à automação. Quer que eu descreva o conteúdo?" },
  { match: ["javascript", "js"], reply: "JavaScript é a linguagem do navegador — é ela que torna as páginas interativas. Na trilha <b>JavaScript Moderno</b> você aprende ES6+, manipulação do DOM e consumo de APIs. É o caminho natural depois do HTML/CSS." },
  { match: ["html", "css", "web", "site"], reply: "Para a web começamos com <b>HTML</b> (a estrutura) e <b>CSS</b> (o estilo), depois <b>JavaScript</b> (a interação). A trilha <b>Desenvolvimento Web</b> leva você do zero até publicar um site responsivo. 🚀" },
  { match: ["variavel", "variável", "variaveis"], reply: "Uma variável é um espaço nomeado para guardar um valor. Em Python: <code>idade = 25</code>. Você pode reutilizar e alterar esse valor durante o programa. É um dos primeiros tópicos da trilha de Python!" },
  { match: ["trilha", "curso", "comecar", "começar", "iniciante", "do zero"], reply: "Temos trilhas para todos os níveis: <b>Web Dev</b> e <b>Python</b> (iniciante), <b>JavaScript</b> e <b>PHP</b> (intermediário), <b>Estrutura de Dados</b> e <b>Algoritmos</b> (avançado). Faça o quiz de perfil e eu recomendo a ideal. 🎯" },
  { match: ["xp", "nivel", "nível", "gamific", "ranking", "conquista", "streak", "sequencia", "sequência"], reply: "A gamificação te mantém no ritmo: ganha <b>XP</b> por aula, sobe de <b>nível</b>, desbloqueia <b>conquistas</b>, mantém a <b>sequência</b> de dias 🔥 e disputa o <b>ranking</b>. Aprender vira um jogo!" },
  { match: ["preço", "preco", "plano", "valor", "quanto custa", "gratis", "grátis", "free"], reply: "Temos o plano <b>Explorar</b> (grátis), o <b>Pro</b> (R$39/mês, recomendado, com mentoria e NeuroBot ilimitado) e o <b>Carreira</b> (R$89/mês, com mentoria semanal 1:1). Quer comparar os planos?" },
  { match: ["mentoria", "mentor", "carlos"], reply: "Na mentoria você conversa com profissionais como o <b>Carlos Silva</b>, dev full-stack sênior. Eles ajudam com plano de carreira, revisão de projetos e dúvidas que vão além do conteúdo. 👨‍🏫" },
  { match: ["certificado", "diploma"], reply: "Sim! Ao concluir uma trilha você recebe um <b>certificado digital</b> com carga horária, válido para comprovar suas competências em processos seletivos. 📜" },
  { match: ["obrigado", "obrigada", "valeu", "vlw", "tchau"], reply: "Por nada! 😄 Bons estudos e lembre-se do nosso lema: <i>seu cérebro, seu ritmo, seu código.</i> Estou aqui 24h se precisar." },
];

NC.botFallback = "Boa pergunta! 🤔 Posso te ajudar com <b>trilhas</b>, <b>linguagens</b> (Python, JavaScript, Web), <b>gamificação</b>, <b>planos</b> e <b>mentoria</b>. Tente perguntar, por exemplo: \"como começo do zero?\"";

NC.botSuggestions = ["Como começo do zero?", "O que é gamificação?", "Me fale sobre Python", "Quais são os planos?"];
