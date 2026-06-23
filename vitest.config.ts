import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // Os testes de integração compartilham Postgres e Redis; rodar arquivos em
    // paralelo geraria corrida na limpeza entre eles.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://auth:auth@localhost:5434/auth_test?schema=public',
      REDIS_URL: 'redis://localhost:6380',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-aqui',
    },
  },
});
