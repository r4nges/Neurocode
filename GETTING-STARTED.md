# NeuroCode — Como rodar (protótipo)

## Pré-requisitos
- Node.js 18+ (recomendado 20 LTS) e npm.

## Setup (uma vez)
Rode os comandos **um por linha** (funciona em bash, CMD e PowerShell — sem depender de `&&`):
```bash
npm run setup
cd server
npx prisma migrate dev --name init
npm run seed
cd ..
```

> O `npm run seed` popula o roadmap **Desenvolvedor Front-end** (HTML → CSS → JavaScript,
> 3 aulas cada) e marca DevOps/Back-end/Data como bloqueados. A partir da **Fase 4**, o
> seed também popula o **banco de exercícios** (exercícios de múltipla escolha, fill-blank
> e outros, etiquetados por conceito e dificuldade) que alimenta o motor adaptativo e o
> quiz de onboarding. O conteúdo só aparece nas telas após executar este passo. Rodar
> novamente é seguro — o seed é idempotente.
>
> Para ligar a **geração ao vivo via Claude**, copie `server/.env.example` → `server/.env`
> e preencha `CLAUDE_API_KEY` (opcional — sem a chave o app roda 100% com o banco embutido).

### Segredo de sessão (auth)
Copie `server/.env.example` para `server/.env` e defina um `SESSION_SECRET` forte
(o login/cadastro usam-no para assinar o cookie de sessão httpOnly). Em desenvolvimento,
sem o valor o app usa um segredo inseguro só para não travar.

## Rodar em desenvolvimento
```bash
npm run dev
```
- API: http://localhost:4000 (teste: http://localhost:4000/api/health)
- App: http://localhost:5173

O Vite faz proxy de `/api` para a API, então o front fala com o back sem CORS.

### Acessar pelo celular (mesma Wi-Fi + QR code)
O Vite está configurado com `host: true` e o plugin `vite-plugin-qrcode`, então ao
rodar `npm run dev` o terminal imprime a URL de rede **e um QR code** logo abaixo.
Aponte a câmera do celular (mesma Wi-Fi) para o QR e o app abre no navegador.

Alternativa manual — digite a URL de `Network` no celular:

```
http://<IP-LOCAL-DO-PC>:5173
```

Descubra o IP do PC com `ipconfig` (Windows) — campo "Endereço IPv4" da Wi-Fi.
O proxy `/api` funciona pelo celular também, então **todas as funcionalidades**
(login, aulas, exercícios, gamificação) rodam normalmente.

> Se o celular não abrir: confirme que ambos estão na mesma rede e libere a porta
> 5173 no firewall do Windows para o Node/Vite.

- Auth: `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` (sessão por cookie httpOnly; CSRF via header `X-CSRF-Token`).
- Gamificação (**Fase 5**): concluir uma aula com **≥80%** de acerto concede **XP** (só o *delta* de melhora — refazer não farma), sobe de **nível** a cada 250 XP, alimenta o **streak** diário e, ao fechar a matéria inteira, libera um **badge** + **NeuroPoints**. Tudo calculado no servidor, numa transação, com o token da sessão invalidado após a conclusão. Leitura: `GET /api/dashboard` (painel "Seu progresso": XP/nível/streak/NeuroPoints + meta semanal + pódio + badges) e `GET /api/ranking` (leaderboard global por XP + sua posição). No app: painel no **Dashboard**, resumo de recompensa ao fim da aula e a página **/ranking**.

## Rodar os testes
```bash
npm test
```

## Ligar a IA real (opcional, fases futuras)
Copie `server/.env.example` para `server/.env` e preencha `CLAUDE_API_KEY`.
Sem a chave, o protótipo roda 100% offline.

> A landing/marketing legada (Flask + HTML estático) continua em `app.py` e `static/`
> apenas como referência de design — não faz parte do app Node/React.
