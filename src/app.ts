import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';

export async function criarApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(helmet);

  app.get('/health', () => ({ status: 'ok' }));

  return app;
}
