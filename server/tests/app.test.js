import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('App endurecido', () => {
  it('mantém GET /api/health respondendo 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('responde 401 sem sessão em rota de conteúdo desconhecida', async () => {
    // O content router aplica requireAuth antes do notFound; sem sessão → 401.
    const res = await request(app).get('/api/nao-existe');
    expect(res.status).toBe(401);
  });

  it('aplica cabeçalhos de segurança do helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
