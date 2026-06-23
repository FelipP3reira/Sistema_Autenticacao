import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { ErroAplicacao } from '../erros/erros-aplicacao.js';
import { montarCorpoErro } from './resposta-erro.js';

export function registrarTratamentoDeErro(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send(
        montarCorpoErro('NAO_ENCONTRADO', `Não há rota para ${request.method} ${request.url}.`),
      );
  });

  app.setErrorHandler((erro, _request, reply) => {
    if (erro instanceof ZodError) {
      reply
        .status(400)
        .send(
          montarCorpoErro(
            'VALIDACAO',
            'Alguns campos não passaram na validação.',
            erro.flatten().fieldErrors,
          ),
        );
      return;
    }

    if (erro instanceof ErroAplicacao) {
      reply.status(erro.status).send(montarCorpoErro(erro.codigo, erro.message, erro.detalhes));
      return;
    }

    // Erros que o próprio Fastify levanta antes do handler (ex.: JSON malformado)
    // vêm com statusCode; respeitamos quando for erro do cliente.
    const erroHttp = erro as { statusCode?: unknown; message?: unknown };
    if (
      typeof erroHttp.statusCode === 'number' &&
      erroHttp.statusCode >= 400 &&
      erroHttp.statusCode < 500
    ) {
      const mensagem =
        typeof erroHttp.message === 'string' ? erroHttp.message : 'Requisição inválida.';
      reply.status(erroHttp.statusCode).send(montarCorpoErro('REQUISICAO_INVALIDA', mensagem));
      return;
    }

    console.error('Erro não tratado:', erro);
    reply
      .status(500)
      .send(
        montarCorpoErro(
          'ERRO_INTERNO',
          'Algo quebrou aqui do nosso lado. Tenta de novo em instantes.',
        ),
      );
  });
}
