import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { issueCsrfToken, verifyCsrf } from '../src/middleware/csrf.js';

// App mínimo só para exercitar o CSRF isoladamente (sem depender de auth).
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser('test-secret'));
  app.use(issueCsrfToken);
  app.get('/csrf', (req, res) => res.json({ csrfToken: req.cookies['nc_csrf'] }));
  app.post('/protegido', verifyCsrf, (req, res) => res.json({ ok: true }));
  return app;
}

describe('CSRF double-submit', () => {
  it('emite um cookie nc_csrf e o devolve em GET /csrf', async () => {
    const res = await request(makeApp()).get('/csrf');
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    expect(res.headers['set-cookie'].join(';')).toContain('nc_csrf=');
  });

  it('bloqueia POST sem o header X-CSRF-Token (403)', async () => {
    const agent = request.agent(makeApp());
    await agent.get('/csrf');
    const res = await agent.post('/protegido').send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Falha na validação CSRF.' });
  });

  it('aceita POST quando o header bate com o cookie', async () => {
    const agent = request.agent(makeApp());
    const { body } = await agent.get('/csrf');
    const res = await agent
      .post('/protegido')
      .set('x-csrf-token', body.csrfToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
