# NeuroCode · Site EAD de Educação em Programação

> 🚧 **Protótipo da plataforma (Node + React):** veja [GETTING-STARTED.md](GETTING-STARTED.md).
> O conteúdo abaixo descreve a landing legada (Flask), mantida como referência de design.

Landing page **high-fidelity, moderna e responsiva** para a NeuroCode — plataforma EAD
gamificada de ensino de programação. Construída a partir da documentação do protótipo
(`conversa-neurocode.md`), reusando a identidade visual (logo recriada em SVG, paleta
roxo/ciano e os design tokens originais).

> **Lema:** *Seu cérebro, seu ritmo, seu código.*

---

## ✨ O que tem

- **HTML semântico** + **CSS** modular (5 arquivos) + **JavaScript** (4 módulos) + **Python/Flask** (backend opcional).
- **Totalmente responsivo** (mobile-first → desktop), com tema **claro/escuro** persistido.
- **Logo recriada em SVG** (cérebro + `</>` em gradiente roxo→ciano) — escalável e nítida.
- Seções: Hero com editor de código animado, números, **trilhas filtráveis por nível**,
  metodologia (aprendizado adaptativo + 3 modos de estudo), **gamificação** (XP, níveis,
  streaks, pódio), **NeuroBot** (chat de IA funcional), mentoria, **planos**, depoimentos,
  FAQ em acordeão e CTA com formulário.
- **Animações**: reveal on scroll, contadores, marquee, cartões flutuantes, "digitando…".

## 🎨 Identidade (vinda do `.md`)

| Token | Valor |
|---|---|
| Fundo | `linear-gradient(180deg,#080818,#0F0A2E,#1A0F45,#1E1060)` |
| Botão primário | `linear-gradient(135deg,#6C5CE7,#9B6BFF)` · pílula |
| Cards | `#1C1840` / `#1E1B3A` · borda `#2D2860` |
| Acentos | verde `#00C896`, dourado `#FFD700`, ciano `#00CFFF`, rosa `#FF6B9D`… |
| Fontes | **Caveat** (destaques), **Inter** (corpo), **JetBrains Mono** (código) |
| Ícones | **Lucide** |

## 📁 Estrutura

```
.
├── index.html               # página principal
├── app.py                   # backend Flask (opcional)
├── requirements.txt
├── data/
│   ├── cursos.json          # fonte das trilhas (servida pela API)
│   └── inscricoes.json      # criado ao receber inscrições
└── static/
    ├── css/  variables · base · animations · components · sections
    ├── js/   data · ui · neurobot · forms
    └── img/  logo.svg
```

## ▶️ Como rodar

> **Protótipo Node/React (atual):** veja [GETTING-STARTED.md](GETTING-STARTED.md) para o
> guia completo. O trecho abaixo resume apenas o setup do servidor.

### Servidor (API :4000)

```bash
cd server
npm install
npx prisma migrate dev      # cria/atualiza o banco
npm run seed                # semeia o roadmap Front-end (HTML/CSS/JS)
npm run dev
```

O seed popula 1 roadmap **Desenvolvedor Front-end** (matérias HTML → CSS → JavaScript,
3 aulas cada) e 3 carreiras bloqueadas (DevOps, Back-end, Data). A partir da **Fase 4**,
o seed também popula o **banco de exercícios** (exercícios adaptativos etiquetados por
conceito e dificuldade). Para ligar a geração ao vivo via Claude, copie
`server/.env.example` → `server/.env` e preencha `CLAUDE_API_KEY` (opcional — sem a
chave o app roda 100% com o banco embutido). As telas de roadmap/matéria/aula exigem login.

### Opção legada — só abrir (estático, Flask)
Abra `index.html` no navegador. **Tudo funciona** (cursos, NeuroBot e formulário usam
dados locais como *fallback*).

### Opção legada — com o backend Python
Liga a API "conectiva" (cursos via JSON, NeuroBot e inscrições no servidor):

```bash
pip install -r requirements.txt
python app.py
# abra http://127.0.0.1:5000
```

> Dica: para o tema/JS carregarem sem CORS, prefira a Opção legada 2 ou um servidor simples
> (`python -m http.server`).

## 🔌 API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/cursos?nivel=iniciante` | Lista de trilhas (filtro opcional) |
| POST | `/api/neurobot` | `{ "mensagem": "..." }` → resposta do NeuroBot |
| POST | `/api/inscricao` | `{ "email": "..." }` → registra e confirma |

Quando o backend está fora do ar, o front detecta (`location.protocol === 'file:'` ou erro
de fetch) e usa os dados locais — o site nunca "quebra".

## 🧩 Personalizar

- **Trilhas:** edite `data/cursos.json` (ou `static/js/data.js` no modo estático).
- **Respostas do NeuroBot:** `BOT_KNOWLEDGE` em `app.py` e `NC.botKnowledge` em `data.js`.
- **Cores/tema:** `static/css/variables.css`.

---

Feito com 💜 a partir do protótipo NeuroCode.
