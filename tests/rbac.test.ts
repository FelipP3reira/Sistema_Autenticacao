import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma/cliente.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});

afterAll(async () => {
  await app.close();
});

async function criarSessao(email: string, admin = false): Promise<string> {
  const senha = 'senha-bem-forte';
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email, senha } });
  if (admin) {
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  }
  const login = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, senha },
  });
  return login.json().accessToken as string;
}

function autenticado(url: string, token: string) {
  return app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });
}

describe('rota protegida /v1/me', () => {
  it('devolve o perfil com um access token válido', async () => {
    const token = await criarSessao('eu@x.com');

    const resposta = await autenticado('/v1/me', token);

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().email).toBe('eu@x.com');
    expect(resposta.json().senhaHash).toBeUndefined();
  });

  it('recusa sem token com 401', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(resposta.statusCode).toBe(401);
  });

  it('recusa token inválido com 401', async () => {
    const resposta = await autenticado('/v1/me', 'token-furado');
    expect(resposta.statusCode).toBe(401);
  });
});

describe('autorização por role em /v1/admin/users', () => {
  it('nega acesso a um usuário comum com 403', async () => {
    const token = await criarSessao('comum@x.com');

    const resposta = await autenticado('/v1/admin/users', token);

    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().erro.codigo).toBe('PROIBIDO');
  });

  it('libera para admin e lista os usuários', async () => {
    const tokenAdmin = await criarSessao('chefe@x.com', true);
    await criarSessao('outro@x.com');

    const resposta = await autenticado('/v1/admin/users', tokenAdmin);

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().dados.length).toBeGreaterThanOrEqual(2);
  });
});
