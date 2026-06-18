import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../src/lib/validation.js';

describe('registerSchema', () => {
  it('aceita um cadastro válido e normaliza o e-mail', () => {
    const r = registerSchema.safeParse({
      name: 'Rangel',
      email: 'RANGEL@Neuro.DEV',
      password: 'Sup3rSecret',
    });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('rangel@neuro.dev');
  });

  it('rejeita senha fraca (sem número)', () => {
    const r = registerSchema.safeParse({
      name: 'Rangel',
      email: 'rangel@neuro.dev',
      password: 'semnumeros',
    });
    expect(r.success).toBe(false);
  });

  it('rejeita e-mail inválido', () => {
    const r = registerSchema.safeParse({
      name: 'Rangel',
      email: 'nao-eh-email',
      password: 'Sup3rSecret',
    });
    expect(r.success).toBe(false);
  });

  it('rejeita senha fraca (sem maiúscula)', () => {
    const r = registerSchema.safeParse({ name: 'Rangel', email: 'r@n.dev', password: 'sup3rsecret' });
    expect(r.success).toBe(false);
  });

  it('rejeita senha fraca (sem minúscula)', () => {
    const r = registerSchema.safeParse({ name: 'Rangel', email: 'r@n.dev', password: 'SUP3RSECRET' });
    expect(r.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('aceita credenciais bem formadas', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', password: 'x' });
    expect(r.success).toBe(true);
  });

  it('rejeita e-mail ausente', () => {
    const r = loginSchema.safeParse({ password: 'x' });
    expect(r.success).toBe(false);
  });

  it('normaliza o e-mail para minúsculas', () => {
    const r = loginSchema.safeParse({ email: 'USER@EXAMPLE.COM', password: 'x' });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe('user@example.com');
  });
});
