import { z } from 'zod';

export const registrarSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  senha: z.string().min(8, 'A senha precisa de ao menos 8 caracteres.').max(200),
  nome: z.string().trim().min(1).max(120).optional(),
});

export const verificarEmailSchema = z.object({
  token: z.string().min(1, 'Informe o token.'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
});

export type Registrar = z.infer<typeof registrarSchema>;
export type Login = z.infer<typeof loginSchema>;
