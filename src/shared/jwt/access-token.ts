import { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { config } from '../../config/env.js';
import { ErroNaoAutorizado } from '../erros/erros-aplicacao.js';

const TTL_ACCESS_TOKEN = '15m';

export interface ConteudoAccessToken {
  sub: string;
  role: Role;
}

export function assinarAccessToken(conteudo: ConteudoAccessToken): string {
  return jwt.sign(conteudo, config.JWT_SECRET, { expiresIn: TTL_ACCESS_TOKEN });
}

export function verificarAccessToken(token: string): ConteudoAccessToken {
  let decodificado: unknown;
  try {
    decodificado = jwt.verify(token, config.JWT_SECRET);
  } catch {
    throw new ErroNaoAutorizado('Token inválido ou expirado.');
  }

  if (!ehConteudoValido(decodificado)) {
    throw new ErroNaoAutorizado('Token inválido ou expirado.');
  }

  return { sub: decodificado.sub, role: decodificado.role };
}

function ehConteudoValido(valor: unknown): valor is ConteudoAccessToken {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const conteudo = valor as Record<string, unknown>;
  return (
    typeof conteudo.sub === 'string' &&
    (conteudo.role === Role.USER || conteudo.role === Role.ADMIN)
  );
}
