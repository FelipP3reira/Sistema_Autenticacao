import type { User } from '@prisma/client';

export interface UsuarioPublico {
  id: string;
  email: string;
  nome: string | null;
  role: User['role'];
  emailVerificado: boolean;
  criadoEm: Date;
}

export function apresentarUsuario(usuario: User): UsuarioPublico {
  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    role: usuario.role,
    emailVerificado: usuario.emailVerificado,
    criadoEm: usuario.criadoEm,
  };
}
