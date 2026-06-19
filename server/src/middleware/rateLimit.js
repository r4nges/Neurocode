import rateLimit from 'express-rate-limit';

// Nota de produção: este protótipo roda SEM proxy reverso, então `req.ip` é o IP
// real do cliente e `validate: { trustProxy: false }` é uma asserção correta (não um
// silenciamento cego do validador). Num deploy atrás de proxy/load-balancer, configure
// `app.set('trust proxy', <nº de hops>)` em app.js e garanta que a chave do limiter
// derive do IP real verificado — caso contrário todos os clientes compartilham um IP
// (DoS global) ou um atacante forja X-Forwarded-For para burlar o limite.
const sharedOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
};

const tooMany = (req, res) =>
  res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });

export const loginLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  handler: tooMany,
});

export const registerLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  handler: tooMany,
});
