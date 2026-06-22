import 'dotenv/config';
import { z } from 'zod';

const esquemaAmbiente = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3334),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'O segredo do JWT precisa ter ao menos 32 caracteres.'),
});

const leitura = esquemaAmbiente.safeParse(process.env);

if (!leitura.success) {
  const camposComProblema = Object.entries(leitura.error.flatten().fieldErrors)
    .map(([campo, erros]) => `  ${campo}: ${erros?.join(', ')}`)
    .join('\n');

  console.error(`Configuração de ambiente inválida:\n${camposComProblema}`);
  process.exit(1);
}

export const config = leitura.data;
