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

async function registrar(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/v1/auth/register', payload });
}

describe('cadastro', () => {
  it('cria usuário não verificado e guarda o token de verificação no Redis', async () => {
    const resposta = await registrar({
      email: 'Novo@X.com',
      senha: 'senha-bem-forte',
      nome: 'Novo',
    });

    expect(resposta.statusCode).toBe(201);
    const corpo = resposta.json();
    expect(corpo.email).toBe('novo@x.com');
    expect(corpo.emailVerificado).toBe(false);
    expect(corpo.senhaHash).toBeUndefined();

    const chaves = await redis.keys('verificacao-email:*');
    expect(chaves).toHaveLength(1);
  });

  it('recusa e-mail duplicado com 409', async () => {
    const payload = { email: 'dup@x.com', senha: 'senha-bem-forte' };
    await registrar(payload);

    const resposta = await registrar(payload);
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json().erro.codigo).toBe('CONFLITO');
  });

  it('recusa senha curta com 400 apontando o campo', async () => {
    const resposta = await registrar({ email: 'curta@x.com', senha: '123' });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.detalhes.senha).toBeDefined();
  });
});

describe('verificação de e-mail', () => {
  it('verifica o e-mail consumindo o token e não aceita reuso', async () => {
    await registrar({ email: 'verificar@x.com', senha: 'senha-bem-forte' });
    const [chave] = await redis.keys('verificacao-email:*');
    const token = (chave ?? '').replace('verificacao-email:', '');

    const primeira = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { token },
    });
    expect(primeira.statusCode).toBe(200);

    const reuso = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { token },
    });
    expect(reuso.statusCode).toBe(400);
  });

  it('recusa token inexistente com 400', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { token: 'nao-existe' },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.codigo).toBe('VALIDACAO');
  });
});
