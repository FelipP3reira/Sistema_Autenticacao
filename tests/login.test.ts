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

function registrar(email: string, senha: string) {
  return app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email, senha } });
}

function logar(email: string, senha: string) {
  return app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, senha } });
}

describe('login', () => {
  it('devolve access token e põe o refresh num cookie HttpOnly de escopo restrito', async () => {
    await registrar('user@x.com', 'senha-bem-forte');

    const resposta = await logar('user@x.com', 'senha-bem-forte');

    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(typeof corpo.accessToken).toBe('string');
    expect(corpo.usuario.email).toBe('user@x.com');

    const cookie = resposta.cookies.find((c) => c.name === 'refresh_token');
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe('/v1/auth');
  });

  it('recusa senha errada com 401 genérico', async () => {
    await registrar('senha@x.com', 'senha-bem-forte');

    const resposta = await logar('senha@x.com', 'senha-errada');

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().erro.codigo).toBe('NAO_AUTORIZADO');
  });

  it('recusa e-mail inexistente com o mesmo 401 (sem revelar que não existe)', async () => {
    const resposta = await logar('fantasma@x.com', 'qualquer-coisa');

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().erro.mensagem).toBe('Credenciais inválidas.');
  });
});

describe('lockout progressivo', () => {
  it('bloqueia com 429 depois da 5ª tentativa falha', async () => {
    await registrar('alvo@x.com', 'senha-bem-forte');

    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const falha = await logar('alvo@x.com', 'errada');
      expect(falha.statusCode).toBe(401);
    }

    const bloqueado = await logar('alvo@x.com', 'errada');
    expect(bloqueado.statusCode).toBe(429);
    expect(bloqueado.json().erro.codigo).toBe('LIMITE_EXCEDIDO');
  });

  it('estando bloqueado, nem a senha certa passa enquanto a janela dura', async () => {
    await registrar('alvo2@x.com', 'senha-bem-forte');

    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      await logar('alvo2@x.com', 'errada');
    }

    const comSenhaCerta = await logar('alvo2@x.com', 'senha-bem-forte');
    expect(comSenhaCerta.statusCode).toBe(429);
  });
});
