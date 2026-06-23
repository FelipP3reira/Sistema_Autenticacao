import { Prisma } from '@prisma/client';

import { enviarEmailVerificacao } from '../../shared/email/enviador.js';
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
import { emitirRefreshToken } from './refresh-token.js';
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
