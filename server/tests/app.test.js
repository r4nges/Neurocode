import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('App endurecido', () => {
  it('mantém GET /api/health respondendo 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('responde 404 em JSON para rota desconhecida', async () => {
    const res = await request(app).get('/api/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Recurso não encontrado.' });
  });

  it('aplica cabeçalhos de segurança do helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
