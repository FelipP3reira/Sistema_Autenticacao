import type { FastifyInstance } from 'fastify';

import { ErroNaoAutorizado } from '../../shared/erros/erros-aplicacao.js';
import { opcoesCookieRefresh, NOME_COOKIE_REFRESH } from '../../shared/http/cookie-refresh.js';
import {
  loginSchema,
  registrarSchema,
  resetarSenhaSchema,
  solicitarResetSchema,
  verificarEmailSchema,
} from './auth.schema.js';
import * as auth from './auth.service.js';

export function authRotas(app: FastifyInstance): void {
  app.post('/register', async (request, reply) => {
    const dados = registrarSchema.parse(request.body);
    const usuario = await auth.registrar(dados);
    return reply.status(201).send(usuario);
  });

  app.post(
    '/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const dados = loginSchema.parse(request.body);
      const { usuario, accessToken, refreshToken } = await auth.login(dados);
      reply.setCookie(NOME_COOKIE_REFRESH, refreshToken, opcoesCookieRefresh());
      return reply.send({ accessToken, usuario });
    },
  );

  app.post('/refresh', async (request, reply) => {
    const apresentado = request.cookies[NOME_COOKIE_REFRESH];
    if (!apresentado) {
      throw new ErroNaoAutorizado('Refresh token ausente.');
    }
    const { accessToken, refreshToken, usuario } = await auth.renovarSessao(apresentado);
    reply.setCookie(NOME_COOKIE_REFRESH, refreshToken, opcoesCookieRefresh());
    return reply.send({ accessToken, usuario });
  });

  app.post('/logout', async (request, reply) => {
    await auth.encerrarSessao(request.cookies[NOME_COOKIE_REFRESH]);
    reply.clearCookie(NOME_COOKIE_REFRESH, { path: '/v1/auth' });
    return reply.send({ status: 'sessao-encerrada' });
  });

  app.post('/verify-email', async (request, reply) => {
    const { token } = verificarEmailSchema.parse(request.body);
    await auth.verificarEmail(token);
    return reply.send({ status: 'verificado' });
  });

  app.post(
    '/forgot-password',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { email } = solicitarResetSchema.parse(request.body);
      await auth.solicitarResetSenha(email);
      // Resposta neutra: não conta se o e-mail existe.
      return reply.send({ status: 'se-o-email-existir-enviaremos-instrucoes' });
    },
  );

  app.post('/reset-password', async (request, reply) => {
    const { token, novaSenha } = resetarSenhaSchema.parse(request.body);
    await auth.resetarSenha(token, novaSenha);
    return reply.send({ status: 'senha-redefinida' });
  });
}
