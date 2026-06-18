import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import { issueCsrfToken } from './middleware/csrf.js';
import { notFound, errorHandler } from './middleware/error.js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret';
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET é obrigatório em produção.');
}

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));
app.use(issueCsrfToken);

app.get('/api/csrf', (req, res) => {
  res.json({ csrfToken: req.cookies['nc_csrf'] });
});

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
