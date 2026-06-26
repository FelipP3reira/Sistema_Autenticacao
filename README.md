# Sistema de Autenticação (JWT)

Autenticação completa do jeito que se faz em produção: cadastro, login, refresh
rotacionado e revogável, "esqueci minha senha", verificação de e-mail e RBAC. O
foco aqui não foi a quantidade de endpoints, e sim acertar as partes que costumam
sair erradas: rotação de refresh com detecção de reuso, proteção a brute force e
o transporte do refresh token.

## Stack

- **Node + TypeScript** (ESM, modo estrito)
- **Fastify 5** — erro centralizado, preHandlers para auth/RBAC
- **Prisma 6 + PostgreSQL 16** — só o que é durável (o usuário)
- **Redis 7** — tudo que é efêmero e revogável (refresh, tokens de e-mail/reset, lockout)
- **argon2id** para hash de senha, **jsonwebtoken** para o access token
- **zod** na validação e como fonte do OpenAPI
- **Vitest** com `app.inject` para os testes de integração
- **OpenAPI / Swagger UI** em `/docs`

## Endpoints

| Método | Rota                       | O que faz                                     |
| ------ | -------------------------- | --------------------------------------------- |
| POST   | `/v1/auth/register`        | cadastra e dispara verificação de e-mail      |
| POST   | `/v1/auth/login`           | autentica; access no corpo, refresh no cookie |
| POST   | `/v1/auth/refresh`         | rotaciona o refresh e renova o access         |
| POST   | `/v1/auth/logout`          | revoga o refresh atual                        |
| POST   | `/v1/auth/verify-email`    | confirma o e-mail (token de uso único)        |
| POST   | `/v1/auth/forgot-password` | inicia o reset (resposta neutra)              |
| POST   | `/v1/auth/reset-password`  | troca a senha e derruba as sessões            |
| GET    | `/v1/me`                   | perfil do dono do access token                |
| GET    | `/v1/admin/users`          | lista usuários (somente ADMIN)                |

## Como rodar

Pré-requisitos: Node 20+ e Docker.

```bash
cp .env.example .env
docker compose up -d        # Postgres em 5434, Redis em 6380
npm install
npm run db:migrate          # aplica as migrations
npm run dev
```

A API sobe em `http://localhost:3334`. A documentação interativa fica em
`http://localhost:3334/docs` (e o JSON em `/docs.json`).

Em dev, o "envio" de e-mail é mockado: o token de verificação/reset aparece no
log do servidor, então dá para seguir o fluxo na mão.

### Testes

```bash
npm test
```

Integração de verdade: batem em Postgres (`auth_test`) e Redis reais, subidos
pelo `docker-compose`. **Precisam dos containers de pé** — sem eles o setup
falha logo no começo. Entre cada teste, a tabela de usuários é truncada e o
Redis é limpo.

## A decisão pedida: refresh token em cookie HttpOnly vs header

Escolhi **refresh token em cookie `HttpOnly` + `Secure` + `SameSite=Strict`** (com
escopo de path `/v1/auth`), e **access token no corpo da resposta**, para o cliente
guardar em memória e mandar no header `Authorization: Bearer`.

O raciocínio:

- **A ameaça realista num front web é XSS.** Se o refresh token — a credencial
  longeva e poderosa — ficar em `localStorage`/`sessionStorage`, qualquer script
  injetado consegue lê-lo e exfiltrá-lo. Um cookie `HttpOnly` **não é acessível
  por JavaScript**, então mesmo com um XSS o atacante não lê o refresh.
- **O access token aceita ficar exposto** porque é curto (15min) e fica só em
  memória (não em storage persistente). A janela de dano é pequena e ele não
  renova sozinho — quem renova é o refresh, que está protegido.
- **CSRF é o trade-off de usar cookie**, já que o navegador o envia
  automaticamente. Mitigo com `SameSite=Strict` (o cookie não vai em requisição
  cross-site) e restringindo o path a `/v1/auth` (ele nem viaja nas chamadas
  normais da API). Num cenário que exija CORS cross-site, eu acrescentaria um
  token anti-CSRF de double-submit — fica registrado como próximo passo.

Por que **não** o refresh no corpo/header: é mais simples para clientes não-browser
(mobile, CLI), mas num SPA isso obriga a guardar o refresh em storage acessível por
JS — exatamente o que queremos evitar para a credencial longeva. Para um cliente
puramente não-browser, onde não há DOM nem XSS, o transporte por header seria
aceitável; eu exporia o modo cookie por padrão e o header como opção. Aqui mantive
só o cookie para não duplicar superfície sem necessidade.

## Como os tokens funcionam

- **Access token (JWT, ~15min):** stateless, validado só pela assinatura. Carrega
  `sub` e `role`.
- **Refresh token (opaco, ~7 dias):** é `<jti>.<segredo>`. No Redis guardo apenas o
  **hash** do segredo, então um vazamento do Redis não rende tokens utilizáveis. O
  `jti` é a identidade revogável.
- **Rotação com detecção de reuso:** cada `/refresh` marca o token atual como usado
  e emite um novo. Se um token **já rotacionado** reaparece (sinal clássico de
  vazamento), revogo a **família inteira** do usuário — derruba todas as sessões.
- **Revogação:** logout revoga o refresh atual; reset de senha revoga todas as
  sessões.

## Proteção a brute force

Duas camadas no `/login`:

1. **Lockout progressivo** no Redis, por e-mail: 5 falhas bloqueiam por 1min, e cada
   novo bloqueio **dobra** a janela. Some quando o login dá certo.
2. **Rate limit por rota** (`@fastify/rate-limit`), como teto adicional por IP.

A resposta de credencial inválida é **genérica e igual** para e-mail inexistente e
senha errada, para não revelar quais e-mails existem. O mesmo cuidado vale no
`forgot-password`, que sempre responde de forma neutra.

## Estrutura

```
src/
  modules/
    auth/    register, login, refresh, reset, lockout, tokens (verificação/reset/refresh)
    users/   perfil (/me) e listagem admin
  shared/
    erros/   hierarquia de erro da aplicação
    hash/    argon2id
    jwt/     access token
    http/    erro central, cookie do refresh, preHandlers de auth/RBAC
    redis/   client
    prisma/  client
    openapi/ documento gerado dos schemas zod
  app.ts     monta o Fastify (testável via inject)
  server.ts  sobe a porta
prisma/      schema + migrations
tests/       integração (app.inject)
```

## Segurança — checklist

- **Senhas com argon2id**, nunca texto puro.
- **Validação no servidor** com zod em toda entrada.
- **Brute force**: lockout progressivo + rate limit; respostas sem enumeração.
- **Refresh revogável e rotacionado**, com detecção de reuso.
- **Cookies** com `HttpOnly` + `Secure` (em produção) + `SameSite=Strict`, escopo restrito.
- **Segredos em `.env`** (`JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`), com `.env.example`
  versionado e `.env` no `.gitignore`. O `JWT_SECRET` é validado (>= 32 caracteres) no boot.
- **Cabeçalhos de segurança** com helmet (CSP afrouxada só no `/docs`).
- **Zero SQL concatenado** — Prisma parametriza tudo.

## Backup

O que precisa de backup é o Postgres (os usuários). O Redis guarda só estado
efêmero (tokens, contadores) — perder isso, no pior caso, desloga todo mundo e
invalida tokens de verificação/reset em aberto, sem perda de dado de negócio.

```bash
docker exec auth-postgres pg_dump -U auth -d auth -F c -f /tmp/auth.dump
docker cp auth-postgres:/tmp/auth.dump ./backups/auth-$(date +%F).dump
```

Restaurar:

```bash
docker exec -i auth-postgres pg_restore -U auth -d auth --clean /tmp/auth.dump
```

Em produção eu rodaria isso num cron diário com retenção e cópia para storage
externo. Se o estado do Redis passar a importar (ex.: sessões longas), eu ligaria
persistência AOF nele; hoje trato como cache descartável.
