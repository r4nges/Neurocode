import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  validate: { trustProxy: false },
  handler: (req, res) =>
    res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' }),
});
