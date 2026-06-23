import type { CookieSerializeOptions } from '@fastify/cookie';

import { config } from '../../config/env.js';

export const NOME_COOKIE_REFRESH = 'refresh_token';

// Escopo do cookie limitado a /v1/auth: ele só viaja para as rotas que precisam
// dele (refresh e logout), reduzindo a superfície de exposição.
export function opcoesCookieRefresh(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/v1/auth',
    maxAge: 60 * 60 * 24 * 7,
  };
}
