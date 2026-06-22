import { describe, expect, it } from 'vitest';

import { conferirSenha, gerarHashSenha } from '../src/shared/hash/senha.js';

describe('hash de senha (argon2id)', () => {
  it('gera um hash diferente da senha e confere a correta', async () => {
    const hash = await gerarHashSenha('senha-bem-secreta');

    expect(hash).not.toBe('senha-bem-secreta');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await conferirSenha(hash, 'senha-bem-secreta')).toBe(true);
  });

  it('rejeita senha errada', async () => {
    const hash = await gerarHashSenha('senha-bem-secreta');

    expect(await conferirSenha(hash, 'outra-senha')).toBe(false);
  });
});
