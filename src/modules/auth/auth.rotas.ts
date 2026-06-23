import type { FastifyInstance } from 'fastify';

import { registrarSchema, verificarEmailSchema } from './auth.schema.js';
import * as auth from './auth.service.js';

export function authRotas(app: FastifyInstance): void {
  app.post('/register', async (request, reply) => {
    const dados = registrarSchema.parse(request.body);
    const usuario = await auth.registrar(dados);
    return reply.status(201).send(usuario);
  });

  app.post('/verify-email', async (request, reply) => {
    const { token } = verificarEmailSchema.parse(request.body);
    await auth.verificarEmail(token);
    return reply.send({ status: 'verificado' });
  });
}
