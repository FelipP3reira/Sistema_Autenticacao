import type { User } from '@prisma/client';

import { ErroNaoAutorizado } from '../../shared/erros/erros-aplicacao.js';
import { prisma } from '../../shared/prisma/cliente.js';

export async function buscarPerfil(userId: string): Promise<User> {
  const usuario = await prisma.user.findUnique({ where: { id: userId } });
  if (!usuario) {
    // Token válido, mas o usuário não existe mais (ex.: removido).
    throw new ErroNaoAutorizado('Sessão inválida.');
  }
  return usuario;
}

export function listarUsuarios(): Promise<User[]> {
  return prisma.user.findMany({ orderBy: { criadoEm: 'asc' } });
}
