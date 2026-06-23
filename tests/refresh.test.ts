import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../src/app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});

afterAll(async () => {
  await app.close();
});

function lerRefreshCookie(resposta: { cookies: { name: string; value: string }[] }): string {
  const cookie = resposta.cookies.find((c) => c.name === 'refresh_token');
  return cookie?.value ?? '';
}

function refresh(refreshToken: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    cookies: { refresh_token: refreshToken },
  });
}

async function logar(): Promise<string> {
  const payload = { email: 'rot@x.com', senha: 'senha-bem-forte' };
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload });
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload });
  return lerRefreshCookie(login);
}

describe('refresh com rotação', () => {
  it('troca o refresh por um novo e devolve novo access token', async () => {
    const refreshInicial = await logar();

    const resposta = await refresh(refreshInicial);

    expect(resposta.statusCode).toBe(200);
    expect(typeof resposta.json().accessToken).toBe('string');
    const novoRefresh = lerRefreshCookie(resposta);
    expect(novoRefresh).not.toBe('');
    expect(novoRefresh).not.toBe(refreshInicial);
  });

  it('recusa refresh sem cookie com 401', async () => {
    const resposta = await app.inject({ method: 'POST', url: '/v1/auth/refresh' });

    expect(resposta.statusCode).toBe(401);
  });
});

describe('detecção de reuso', () => {
  it('ao reusar um refresh já rotacionado, derruba a família inteira', async () => {
    const refreshInicial = await logar();

    const primeira = await refresh(refreshInicial);
    expect(primeira.statusCode).toBe(200);
    const refreshNovo = lerRefreshCookie(primeira);

    // Reuso do token antigo: deve falhar e revogar tudo.
    const reuso = await refresh(refreshInicial);
    expect(reuso.statusCode).toBe(401);
    expect(reuso.json().erro.mensagem).toMatch(/reutilizado/);

    // E o token novo (legítimo) também perde a validade.
    const aposReuso = await refresh(refreshNovo);
    expect(aposReuso.statusCode).toBe(401);
  });
});

describe('logout', () => {
  it('revoga o refresh atual e limpa o cookie', async () => {
    const refreshInicial = await logar();

    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      cookies: { refresh_token: refreshInicial },
    });
    expect(logout.statusCode).toBe(200);

    const depois = await refresh(refreshInicial);
    expect(depois.statusCode).toBe(401);
  });
});
