import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'A senha precisa de ao menos 8 caracteres.')
  .regex(/[a-z]/, 'Inclua uma letra minúscula.')
  .regex(/[A-Z]/, 'Inclua uma letra maiúscula.')
  .regex(/[0-9]/, 'Inclua um número.');

const emailSchema = z
  .string()
  .trim()
  .email('E-mail inválido.')
  .transform((v) => v.toLowerCase());

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.'),
});
