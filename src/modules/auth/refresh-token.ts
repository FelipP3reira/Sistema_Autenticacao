import { createHash, randomBytes } from 'node:crypto';

import { redis } from '../../shared/redis/cliente.js';

const PREFIXO = 'refresh:';
const PREFIXO_USUARIO = 'refresh-usuario:';
const TTL_SEGUNDOS = 60 * 60 * 24 * 7; // 7 dias

interface RegistroRefresh {
  userId: string;
  segredoHash: string;
}

function hashSegredo(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex');
}

// O token entregue ao cliente é `<jti>.<segredo>`. No Redis guardamos só o hash
// do segredo, então um vazamento do banco não rende tokens utilizáveis. O jti é
// a identidade revogável; o set por usuário permite derrubar todas as sessões.
export async function emitirRefreshToken(userId: string): Promise<string> {
  const jti = randomBytes(16).toString('hex');
  const segredo = randomBytes(32).toString('hex');

  const registro: RegistroRefresh = { userId, segredoHash: hashSegredo(segredo) };
  await redis.set(`${PREFIXO}${jti}`, JSON.stringify(registro), 'EX', TTL_SEGUNDOS);
  await redis.sadd(`${PREFIXO_USUARIO}${userId}`, jti);
  await redis.expire(`${PREFIXO_USUARIO}${userId}`, TTL_SEGUNDOS);

  return `${jti}.${segredo}`;
}
