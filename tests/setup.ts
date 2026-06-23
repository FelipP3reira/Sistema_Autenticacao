import { execSync } from 'node:child_process';

import { afterAll, beforeAll, beforeEach } from 'vitest';

import { prisma } from '../src/shared/prisma/cliente.js';
import { redis } from '../src/shared/redis/cliente.js';

beforeAll(() => {
  execSync('npx prisma migrate deploy', { stdio: 'ignore' });
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE;');
  await redis.flushdb();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});
