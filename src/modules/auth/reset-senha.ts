import { randomBytes } from 'node:crypto';

import { redis } from '../../shared/redis/cliente.js';

const PREFIXO = 'reset-senha:';
const TTL_SEGUNDOS = 60 * 60; // 1h — janela curta de propósito

export async function gerarTokenReset(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await redis.set(`${PREFIXO}${token}`, userId, 'EX', TTL_SEGUNDOS);
  return token;
}

export async function consumirTokenReset(token: string): Promise<string | null> {
  const chave = `${PREFIXO}${token}`;
  const userId = await redis.get(chave);
  if (!userId) {
    return null;
  }
  await redis.del(chave);
  return userId;
}
