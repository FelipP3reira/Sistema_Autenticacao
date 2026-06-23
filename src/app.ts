import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';

import { authRotas } from './modules/auth/auth.rotas.js';
import { registrarTratamentoDeErro } from './shared/http/erro-handler.js';

export async function criarApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(helmet);
  registrarTratamentoDeErro(app);

  app.get('/health', () => ({ status: 'ok' }));

  await app.register(authRotas, { prefix: '/v1/auth' });

  return app;
}
