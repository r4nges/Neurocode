import { describe, it, expect } from 'vitest';

describe('Isolamento do banco de teste', () => {
  it('os testes apontam para test.db, nunca para dev.db', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.DATABASE_URL).toContain('test.db');
    expect(process.env.DATABASE_URL).not.toContain('dev.db');
  });

  it('um SESSION_SECRET de teste está disponível', () => {
    expect(process.env.SESSION_SECRET).toBeTruthy();
  });
});
