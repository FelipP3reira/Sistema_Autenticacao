import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { z } from 'zod';

extendZodWithOpenApi(z);

const registro = new OpenAPIRegistry();

registro.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const erroSchema = registro.register(
  'Erro',
  z.object({
    erro: z.object({
      codigo: z.string(),
      mensagem: z.string(),
      detalhes: z.unknown().optional(),
    }),
  }),
);

const usuarioSchema = registro.register(
  'Usuario',
  z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    nome: z.string().nullable(),
    role: z.enum(['USER', 'ADMIN']),
    emailVerificado: z.boolean(),
    criadoEm: z.string().datetime(),
  }),
);

const sessaoSchema = registro.register(
  'Sessao',
  z.object({ accessToken: z.string(), usuario: usuarioSchema }),
);

const registrarBody = z.object({
  email: z.string().email().openapi({ example: 'pessoa@exemplo.com' }),
  senha: z.string().min(8).openapi({ example: 'uma-senha-bem-forte' }),
  nome: z.string().optional(),
});

const loginBody = z.object({
  email: z.string().email().openapi({ example: 'pessoa@exemplo.com' }),
  senha: z.string().openapi({ example: 'uma-senha-bem-forte' }),
});

const tokenBody = z.object({ token: z.string() });
const emailBody = z.object({ email: z.string().email() });
const resetBody = z.object({ token: z.string(), novaSenha: z.string().min(8) });

function json(description: string, schema: z.ZodTypeAny) {
  return { description, content: { 'application/json': { schema } } };
}

function corpo(schema: z.ZodTypeAny) {
  return { content: { 'application/json': { schema } } };
}

function erro(description: string) {
  return json(description, erroSchema);
}

registro.registerPath({
  method: 'post',
  path: '/v1/auth/register',
  tags: ['Auth'],
  summary: 'Cadastra um usuário e dispara a verificação de e-mail',
  request: { body: corpo(registrarBody) },
  responses: {
    201: json('Usuário criado', usuarioSchema),
    400: erro('Dados inválidos'),
    409: erro('E-mail já cadastrado'),
  },
});

registro.registerPath({
  method: 'post',
  path: '/v1/auth/login',
  tags: ['Auth'],
  summary: 'Autentica e devolve access token (refresh vai no cookie HttpOnly)',
  request: { body: corpo(loginBody) },
  responses: {
    200: json('Sessão aberta', sessaoSchema),
    401: erro('Credenciais inválidas'),
    429: erro('Bloqueado por excesso de tentativas'),
  },
});

registro.registerPath({
  method: 'post',
  path: '/v1/auth/refresh',
  tags: ['Auth'],
  summary: 'Rotaciona o refresh do cookie e devolve novo access token',
  responses: {
    200: json('Sessão renovada', sessaoSchema),
    401: erro('Refresh ausente, inválido ou reutilizado'),
  },
});

registro.registerPath({
  method: 'post',
  path: '/v1/auth/logout',
  tags: ['Auth'],
  summary: 'Revoga o refresh atual e limpa o cookie',
  responses: { 200: json('Sessão encerrada', z.object({ status: z.string() })) },
});

registro.registerPath({
  method: 'post',
  path: '/v1/auth/verify-email',
  tags: ['Auth'],
  summary: 'Confirma o e-mail consumindo o token',
  request: { body: corpo(tokenBody) },
  responses: {
    200: json('E-mail verificado', z.object({ status: z.string() })),
    400: erro('Token inválido'),
  },
});

registro.registerPath({
  method: 'post',
  path: '/v1/auth/forgot-password',
  tags: ['Auth'],
  summary: 'Inicia o reset de senha (resposta sempre neutra)',
  request: { body: corpo(emailBody) },
  responses: {
    200: json('Instruções enviadas se o e-mail existir', z.object({ status: z.string() })),
  },
});

registro.registerPath({
  method: 'post',
  path: '/v1/auth/reset-password',
  tags: ['Auth'],
  summary: 'Redefine a senha e derruba as sessões',
  request: { body: corpo(resetBody) },
  responses: {
    200: json('Senha redefinida', z.object({ status: z.string() })),
    400: erro('Token inválido ou senha fraca'),
  },
});

registro.registerPath({
  method: 'get',
  path: '/v1/me',
  tags: ['Usuário'],
  summary: 'Perfil do dono do access token',
  security: [{ bearerAuth: [] }],
  responses: { 200: json('Perfil', usuarioSchema), 401: erro('Sem token válido') },
});

registro.registerPath({
  method: 'get',
  path: '/v1/admin/users',
  tags: ['Admin'],
  summary: 'Lista os usuários (somente ADMIN)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: json('Lista de usuários', z.object({ dados: z.array(usuarioSchema) })),
    401: erro('Sem token válido'),
    403: erro('Sem permissão de admin'),
  },
});

export function gerarDocumentoOpenApi(): OpenAPIObject {
  const gerador = new OpenApiGeneratorV3(registro.definitions);
  return gerador.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'API de Autenticação',
      version: '1.0.0',
      description: 'Cadastro, login, refresh rotacionado, reset de senha e RBAC.',
    },
    servers: [{ url: '/' }],
  });
}
