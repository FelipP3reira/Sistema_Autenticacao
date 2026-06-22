import { criarApp } from './app.js';
import { config } from './config/env.js';

const app = await criarApp();

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.info(`API de autenticação no ar em http://localhost:${config.PORT}`);
} catch (erro) {
  console.error('Não consegui subir o servidor:', erro);
  process.exit(1);
}
