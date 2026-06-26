import { Role } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { ErroNaoAutorizado } from '../../shared/erros/erros-aplicacao.js';
import { autenticar, autorizar } from '../../shared/http/autenticacao.js';
import { apresentarUsuario } from '../auth/usuario.mapeador.js';
import * as users from './users.service.js';

export function usersRotas(app: FastifyInstance): void {
  app.get('/me', { preHandler: autenticar }, async (request) => {
    const sessao = request.usuario;
    if (!sessao) {
      throw new ErroNaoAutorizado('Sessão inválida.');
    }
    const usuario = await users.buscarPerfil(sessao.sub);
    return apresentarUsuario(usuario);
  });

  app.get('/admin/users', { preHandler: [autenticar, autorizar(Role.ADMIN)] }, async () => {
    const lista = await users.listarUsuarios();
    return { dados: lista.map(apresentarUsuario) };
  });
}
