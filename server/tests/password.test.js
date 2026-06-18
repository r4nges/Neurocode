import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

describe('password (argon2id)', () => {
  it('gera um hash argon2id diferente do texto puro', async () => {
    const hash = await hashPassword('Sup3rSecret');
    expect(hash).not.toBe('Sup3rSecret');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifica a senha correta', async () => {
    const hash = await hashPassword('Sup3rSecret');
    expect(await verifyPassword(hash, 'Sup3rSecret')).toBe(true);
  });

  it('rejeita a senha errada', async () => {
    const hash = await hashPassword('Sup3rSecret');
    expect(await verifyPassword(hash, 'errada')).toBe(false);
  });
});
