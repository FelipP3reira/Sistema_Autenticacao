import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../src/app.js';
import { redis } from '../src/shared/redis/cliente.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});

afterAll(async () => {
  await app.close();
});

function registrar(email: string, senha: string) {
  return app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email, senha } });
}

function logar(email: string, senha: string) {
  return app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, senha } });
}

async function tokenDeReset(): Promise<string> {
  const [chave] = await redis.keys('reset-senha:*');
  return (chave ?? '').replace('reset-senha:', '');
}

describe('esqueci a senha', () => {
  it('gera token para e-mail existente', async () => {
    await registrar('reset@x.com', 'senha-antiga-123');

    const resposta = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'reset@x.com' },
    });

    expect(resposta.statusCode).toBe(200);
    expect(await redis.keys('reset-senha:*')).toHaveLength(1);
  });

  it('responde igual para e-mail inexistente, sem gerar token', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'fantasma@x.com' },
    });

    expect(resposta.statusCode).toBe(200);
    expect(await redis.keys('reset-senha:*')).toHaveLength(0);
  });
});

describe('reset de senha', () => {
  it('troca a senha, invalida a antiga e derruba as sessões', async () => {
    await registrar('troca@x.com', 'senha-antiga-123');
    const login = await logar('troca@x.com', 'senha-antiga-123');
    const refreshAntigo = login.cookies.find((c) => c.name === 'refresh_token')?.value ?? '';

    await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'troca@x.com' },
    });
    const token = await tokenDeReset();

    const reset = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token, novaSenha: 'senha-nova-456' },
    });
    expect(reset.statusCode).toBe(200);

    expect((await logar('troca@x.com', 'senha-antiga-123')).statusCode).toBe(401);
    expect((await logar('troca@x.com', 'senha-nova-456')).statusCode).toBe(200);

    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      cookies: { refresh_token: refreshAntigo },
    });
    expect(refresh.statusCode).toBe(401);
  });

  it('recusa token de reset inválido com 400', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token: 'nao-existe', novaSenha: 'senha-nova-456' },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.codigo).toBe('VALIDACAO');
  });
});
