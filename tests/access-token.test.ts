import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { assinarAccessToken, verificarAccessToken } from '../src/shared/jwt/access-token.js';

describe('access token (JWT)', () => {
  it('assina e verifica, devolvendo sub e role', () => {
    const token = assinarAccessToken({ sub: 'usuario-1', role: 'ADMIN' });

    const conteudo = verificarAccessToken(token);
    expect(conteudo.sub).toBe('usuario-1');
    expect(conteudo.role).toBe('ADMIN');
  });

  it('recusa token adulterado', () => {
    const token = assinarAccessToken({ sub: 'usuario-1', role: 'USER' });

    expect(() => verificarAccessToken(`${token}x`)).toThrowError(/inválido ou expirado/);
  });

  it('recusa token expirado', () => {
    const expirado = jwt.sign(
      { sub: 'usuario-1', role: 'USER' },
      process.env.JWT_SECRET as string,
      {
        expiresIn: -10,
      },
    );

    expect(() => verificarAccessToken(expirado)).toThrowError(/inválido ou expirado/);
  });
});
