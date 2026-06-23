import { Prisma } from '@prisma/client';

import { enviarEmailVerificacao } from '../../shared/email/enviador.js';
import { ErroConflito, ErroValidacao } from '../../shared/erros/erros-aplicacao.js';
import { gerarHashSenha } from '../../shared/hash/senha.js';
import { prisma } from '../../shared/prisma/cliente.js';
import type { Registrar } from './auth.schema.js';
import { apresentarUsuario, type UsuarioPublico } from './usuario.mapeador.js';
import { consumirTokenVerificacao, gerarTokenVerificacao } from './verificacao-email.js';

export async function registrar(dados: Registrar): Promise<UsuarioPublico> {
  const senhaHash = await gerarHashSenha(dados.senha);

  let usuario;
  try {
    usuario = await prisma.user.create({
      data: { email: dados.email, senhaHash, nome: dados.nome },
    });
  } catch (erro) {
    if (violouUnicidade(erro)) {
      throw new ErroConflito('E-mail já cadastrado.');
    }
    throw erro;
  }

  const token = await gerarTokenVerificacao(usuario.id);
  enviarEmailVerificacao(usuario.email, token);

  return apresentarUsuario(usuario);
}

export async function verificarEmail(token: string): Promise<void> {
  const userId = await consumirTokenVerificacao(token);
  if (!userId) {
    throw new ErroValidacao('Token de verificação inválido ou expirado.');
  }

  await prisma.user.update({ where: { id: userId }, data: { emailVerificado: true } });
}

function violouUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}
