import { ErroLimiteExcedido } from '../../shared/erros/erros-aplicacao.js';
import { redis } from '../../shared/redis/cliente.js';

const PREFIXO_FALHAS = 'login-falhas:';
const PREFIXO_BLOQUEIO = 'login-bloqueio:';
const PREFIXO_NIVEL = 'login-nivel:';

const MAX_TENTATIVAS = 5;
const BASE_BLOQUEIO_SEGUNDOS = 60;
const TTL_FALHAS_SEGUNDOS = 60 * 15;
const TTL_NIVEL_SEGUNDOS = 60 * 60 * 24;

export async function checarBloqueio(identificador: string): Promise<void> {
  const segundosRestantes = await redis.ttl(`${PREFIXO_BLOQUEIO}${identificador}`);
  if (segundosRestantes > 0) {
    throw new ErroLimiteExcedido(
      `Muitas tentativas de login. Tente de novo em ${segundosRestantes}s.`,
      { retryAfterSegundos: segundosRestantes },
    );
  }
}

// Cada bloqueio dobra a espera (lockout progressivo): o nível persiste por um
// tempo, então quem insiste é punido com janelas cada vez maiores.
export async function registrarFalha(identificador: string): Promise<void> {
  const chaveFalhas = `${PREFIXO_FALHAS}${identificador}`;
  const falhas = await redis.incr(chaveFalhas);
  if (falhas === 1) {
    await redis.expire(chaveFalhas, TTL_FALHAS_SEGUNDOS);
  }

  if (falhas < MAX_TENTATIVAS) {
    return;
  }

  const nivel = await redis.incr(`${PREFIXO_NIVEL}${identificador}`);
  if (nivel === 1) {
    await redis.expire(`${PREFIXO_NIVEL}${identificador}`, TTL_NIVEL_SEGUNDOS);
  }
  const duracao = BASE_BLOQUEIO_SEGUNDOS * 2 ** (nivel - 1);
  await redis.set(`${PREFIXO_BLOQUEIO}${identificador}`, '1', 'EX', duracao);
  await redis.del(chaveFalhas);
}

export async function limparFalhas(identificador: string): Promise<void> {
  await redis.del(
    `${PREFIXO_FALHAS}${identificador}`,
    `${PREFIXO_BLOQUEIO}${identificador}`,
    `${PREFIXO_NIVEL}${identificador}`,
  );
}
