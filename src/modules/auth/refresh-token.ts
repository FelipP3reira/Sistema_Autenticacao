import { createHash, randomBytes } from 'node:crypto';

import { ErroNaoAutorizado } from '../../shared/erros/erros-aplicacao.js';
import { redis } from '../../shared/redis/cliente.js';

const PREFIXO = 'refresh:';
const PREFIXO_USUARIO = 'refresh-usuario:';
const TTL_SEGUNDOS = 60 * 60 * 24 * 7; // 7 dias

interface RegistroRefresh {
  userId: string;
  segredoHash: string;
  usado: boolean;
}

function hashSegredo(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex');
}

function separar(token: string): { jti: string; segredo: string } | null {
  const partes = token.split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) {
    return null;
  }
  return { jti: partes[0], segredo: partes[1] };
}

async function lerRegistro(jti: string): Promise<RegistroRefresh | null> {
  const cru = await redis.get(`${PREFIXO}${jti}`);
  if (!cru) {
    return null;
  }
  return JSON.parse(cru) as RegistroRefresh;
}

// O token entregue ao cliente é `<jti>.<segredo>`. No Redis guardamos só o hash
// do segredo, então um vazamento do banco não rende tokens utilizáveis. O jti é
// a identidade revogável; o set por usuário permite derrubar todas as sessões.
export async function emitirRefreshToken(userId: string): Promise<string> {
  const jti = randomBytes(16).toString('hex');
  const segredo = randomBytes(32).toString('hex');

  const registro: RegistroRefresh = { userId, segredoHash: hashSegredo(segredo), usado: false };
  await redis.set(`${PREFIXO}${jti}`, JSON.stringify(registro), 'EX', TTL_SEGUNDOS);
  await redis.sadd(`${PREFIXO_USUARIO}${userId}`, jti);
  await redis.expire(`${PREFIXO_USUARIO}${userId}`, TTL_SEGUNDOS);

  return `${jti}.${segredo}`;
}

export async function rotacionarRefreshToken(
  token: string,
): Promise<{ userId: string; novoRefreshToken: string }> {
  const partes = separar(token);
  if (!partes) {
    throw new ErroNaoAutorizado('Refresh token inválido.');
  }

  const registro = await lerRegistro(partes.jti);
  if (!registro || registro.segredoHash !== hashSegredo(partes.segredo)) {
    throw new ErroNaoAutorizado('Refresh token inválido.');
  }

  // Token já rotacionado sendo apresentado de novo: sinal de vazamento. Derruba
  // a família inteira (todas as sessões do usuário).
  if (registro.usado) {
    await revogarTodosDoUsuario(registro.userId);
    throw new ErroNaoAutorizado('Sessão encerrada por segurança: refresh token reutilizado.');
  }

  await redis.set(
    `${PREFIXO}${partes.jti}`,
    JSON.stringify({ ...registro, usado: true }),
    'KEEPTTL',
  );
  await redis.srem(`${PREFIXO_USUARIO}${registro.userId}`, partes.jti);

  const novoRefreshToken = await emitirRefreshToken(registro.userId);
  return { userId: registro.userId, novoRefreshToken };
}

export async function revogarRefreshToken(token: string): Promise<void> {
  const partes = separar(token);
  if (!partes) {
    return;
  }
  const registro = await lerRegistro(partes.jti);
  if (!registro) {
    return;
  }
  await redis.del(`${PREFIXO}${partes.jti}`);
  await redis.srem(`${PREFIXO_USUARIO}${registro.userId}`, partes.jti);
}

export async function revogarTodosDoUsuario(userId: string): Promise<void> {
  const jtis = await redis.smembers(`${PREFIXO_USUARIO}${userId}`);
  const chaves = jtis.map((jti) => `${PREFIXO}${jti}`);
  if (chaves.length > 0) {
    await redis.del(...chaves);
  }
  await redis.del(`${PREFIXO_USUARIO}${userId}`);
}
