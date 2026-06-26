import type { Role } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

import { ErroNaoAutorizado, ErroProibido } from '../erros/erros-aplicacao.js';
import { verificarAccessToken, type ConteudoAccessToken } from '../jwt/access-token.js';

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: ConteudoAccessToken;
  }
}

const PREFIXO_BEARER = 'Bearer ';

// Hooks do Fastify precisam ser async (ou usar o callback done): uma função
// síncrona que retorna void só sinaliza conclusão quando lança, então o caminho
// de sucesso penduraria a requisição.
// eslint-disable-next-line @typescript-eslint/require-await
export async function autenticar(request: FastifyRequest): Promise<void> {
  const cabecalho = request.headers.authorization;
  if (!cabecalho || !cabecalho.startsWith(PREFIXO_BEARER)) {
    throw new ErroNaoAutorizado('Token de acesso ausente.');
  }

  const token = cabecalho.slice(PREFIXO_BEARER.length).trim();
  request.usuario = verificarAccessToken(token);
}

export function autorizar(role: Role) {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async function (request: FastifyRequest): Promise<void> {
    if (!request.usuario) {
      throw new ErroNaoAutorizado('Token de acesso ausente.');
    }
    if (request.usuario.role !== role) {
      throw new ErroProibido('Você não tem permissão para acessar isto.');
    }
  };
}
