import { Prisma } from '@prisma/client';

import { enviarEmailResetSenha, enviarEmailVerificacao } from '../../shared/email/enviador.js';
import {
  ErroConflito,
  ErroNaoAutorizado,
  ErroValidacao,
} from '../../shared/erros/erros-aplicacao.js';
import { conferirSenha, gerarHashSenha } from '../../shared/hash/senha.js';
import { assinarAccessToken } from '../../shared/jwt/access-token.js';
import { prisma } from '../../shared/prisma/cliente.js';
import type { Login, Registrar } from './auth.schema.js';
import { checarBloqueio, limparFalhas, registrarFalha } from './lockout.js';
import {
  emitirRefreshToken,
  revogarRefreshToken,
  revogarTodosDoUsuario,
  rotacionarRefreshToken,
} from './refresh-token.js';
import { consumirTokenReset, gerarTokenReset } from './reset-senha.js';
import { apresentarUsuario, type UsuarioPublico } from './usuario.mapeador.js';
import { consumirTokenVerificacao, gerarTokenVerificacao } from './verificacao-email.js';

export interface ResultadoLogin {
  usuario: UsuarioPublico;
  accessToken: string;
  refreshToken: string;
}

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

export async function login(dados: Login): Promise<ResultadoLogin> {
  const identificador = dados.email;
  await checarBloqueio(identificador);

  const usuario = await prisma.user.findUnique({ where: { email: dados.email } });

  // Mesma resposta para e-mail inexistente e senha errada — não entrego pista
  // de quais e-mails existem.
  if (!usuario || !(await conferirSenha(usuario.senhaHash, dados.senha))) {
    await registrarFalha(identificador);
    throw new ErroNaoAutorizado('Credenciais inválidas.');
  }

  await limparFalhas(identificador);

  const accessToken = assinarAccessToken({ sub: usuario.id, role: usuario.role });
  const refreshToken = await emitirRefreshToken(usuario.id);

  return { usuario: apresentarUsuario(usuario), accessToken, refreshToken };
}

export async function renovarSessao(refreshTokenApresentado: string): Promise<ResultadoLogin> {
  const { userId, novoRefreshToken } = await rotacionarRefreshToken(refreshTokenApresentado);

  const usuario = await prisma.user.findUnique({ where: { id: userId } });
  if (!usuario) {
    await revogarTodosDoUsuario(userId);
    throw new ErroNaoAutorizado('Sessão inválida.');
  }

  const accessToken = assinarAccessToken({ sub: usuario.id, role: usuario.role });
  return { usuario: apresentarUsuario(usuario), accessToken, refreshToken: novoRefreshToken };
}

export async function encerrarSessao(refreshTokenApresentado: string | undefined): Promise<void> {
  if (refreshTokenApresentado) {
    await revogarRefreshToken(refreshTokenApresentado);
  }
}

export async function verificarEmail(token: string): Promise<void> {
  const userId = await consumirTokenVerificacao(token);
  if (!userId) {
    throw new ErroValidacao('Token de verificação inválido ou expirado.');
  }

  await prisma.user.update({ where: { id: userId }, data: { emailVerificado: true } });
}

// Sempre retorna sem erro, exista o e-mail ou não — não revela quais e-mails
// estão cadastrados.
export async function solicitarResetSenha(email: string): Promise<void> {
  const usuario = await prisma.user.findUnique({ where: { email } });
  if (!usuario) {
    return;
  }
  const token = await gerarTokenReset(usuario.id);
  enviarEmailResetSenha(usuario.email, token);
}

export async function resetarSenha(token: string, novaSenha: string): Promise<void> {
  const userId = await consumirTokenReset(token);
  if (!userId) {
    throw new ErroValidacao('Token de reset inválido ou expirado.');
  }

  const senhaHash = await gerarHashSenha(novaSenha);
  await prisma.user.update({ where: { id: userId }, data: { senhaHash } });

  // Trocou a senha: derruba todas as sessões abertas.
  await revogarTodosDoUsuario(userId);
}

function violouUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}
