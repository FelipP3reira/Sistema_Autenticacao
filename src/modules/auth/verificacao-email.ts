import { randomBytes } from 'node:crypto';

import { redis } from '../../shared/redis/cliente.js';

const PREFIXO = 'verificacao-email:';
const TTL_SEGUNDOS = 60 * 60 * 24; // 24h

export async function gerarTokenVerificacao(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await redis.set(`${PREFIXO}${token}`, userId, 'EX', TTL_SEGUNDOS);
  return token;
}

export async function consumirTokenVerificacao(token: string): Promise<string | null> {
  const chave = `${PREFIXO}${token}`;
  const userId = await redis.get(chave);
  if (!userId) {
    return null;
  }
  await redis.del(chave);
  return userId;
}
