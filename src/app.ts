import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import { config } from './config/env.js';
import { authRotas } from './modules/auth/auth.rotas.js';
import { usersRotas } from './modules/users/users.rotas.js';
import { registrarTratamentoDeErro } from './shared/http/erro-handler.js';
import { montarCorpoErro } from './shared/http/resposta-erro.js';

export async function criarApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(helmet);
  await app.register(cookie);

  // Rate limit por rota (global: false): aplico só onde marco config.rateLimit,
  // como no /login. Em teste fica de fora para não atrapalhar o cenário de
  // lockout, que dispara várias tentativas de propósito.
  if (config.NODE_ENV !== 'test') {
    await app.register(rateLimit, {
      global: false,
      errorResponseBuilder: (_request, contexto) =>
        montarCorpoErro(
          'LIMITE_EXCEDIDO',
          `Muitas requisições. Tente de novo em ${Math.ceil(contexto.ttl / 1000)}s.`,
        ),
    });
  }

  registrarTratamentoDeErro(app);

  app.get('/health', () => ({ status: 'ok' }));

  await app.register(authRotas, { prefix: '/v1/auth' });
  await app.register(usersRotas, { prefix: '/v1' });

  return app;
}
