# NeuroCode — Como rodar (protótipo)

## Pré-requisitos
- Node.js 18+ (recomendado 20 LTS) e npm.

## Setup (uma vez)
Rode os comandos **um por linha** (funciona em bash, CMD e PowerShell — sem depender de `&&`):
```bash
npm run setup
cd server
npx prisma migrate dev --name init
cd ..
```

## Rodar em desenvolvimento
```bash
npm run dev
```
- API: http://localhost:4000 (teste: http://localhost:4000/api/health)
- App: http://localhost:5173

O Vite faz proxy de `/api` para a API, então o front fala com o back sem CORS.

## Rodar os testes
```bash
npm test
```

## Ligar a IA real (opcional, fases futuras)
Copie `server/.env.example` para `server/.env` e preencha `CLAUDE_API_KEY`.
Sem a chave, o protótipo roda 100% offline.

> A landing/marketing legada (Flask + HTML estático) continua em `app.py` e `static/`
> apenas como referência de design — não faz parte do app Node/React.
