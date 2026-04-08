# Módulo Auth — Backend

Breve visão do módulo de autenticação do backend.

Principais tecnologias

- NestJS (Fastify) • TypeScript
- JWT (access + refresh, rotação) • Redis para rastreamento JTI
- TypeORM (Postgres) • Zod (validação/serialização) • Vitest (testes)

Organização mínima

- `auth.guard.ts` — `JwtAuthGuard` (checagem do token e anexa `req.user`).
- `auth.controller.ts` — endpoints de login/refresh/logout.
- `auth.service.ts` — lógica de autenticação (login, refresh, logout).
- `strategies/jwt.strategy.ts` — criação/rotação de tokens e controle JTI.
- `decorators/` e `guards/` — `@Roles`, `RolesGuard`, etc.
- `decorators/public.decorator.ts` — `@Public()` para marcar rotas públicas (veja caminho mais abaixo).

Autenticação global

- A aplicação aplica o `JwtAuthGuard` globalmente em `main.ts`. Ou seja:
  - Todas as rotas exigem autenticação por padrão.
  - Para tornar uma rota pública, marque-a explicitamente com `@Public()`.
  - O decorator `@Public()` está definido em `apps/backend/src/auth/decorators/public.decorator.ts`.

Observações rápidas 🔐

- Validação e serialização: use `Zod` (pipes/interceptors) para validar e serializar requests/responses.

- Armazenamento de tokens & chaveamento Redis:
  - `auth:access:<jti>` (STRING) — presença do `jti` do access token (valor = `userId`). Usado para validação rápida e revogação individual. **TTL = `JWT_EXPIRES_IN`**.
  - `auth:access:user:<userId>` (SET) — conjunto de `jti`s de access do usuário. Permite rastrear e revogar todas as sessões ativas de um usuário. **TTL alinhado ao access**.
  - `auth:refresh:<jti>` (STRING) — presença do `jti` do refresh token (valor = `userId`). Usado para validar a rotação de tokens. **TTL = `JWT_REFRESH_EXPIRES_IN`**.
  - `auth:refresh:user:<userId>` (SET) — conjunto de `jti`s de refresh do usuário. **TTL alinhado ao refresh**.
  - `auth:session:<accessJti>` (STRING) — _mapping_ `accessJti -> refreshJti`. Conteúdo: o `jti` do Refresh Token. Essencial para que o logout via Access Token também invalide o Refresh Token correspondente.

- Fluxo de Geração de Cache (Login de Sucesso):
  Ao realizar um login bem-sucedido, a seguinte sequência de operações ocorre no Redis via `JwtAuthStrategy`:
  1. **Access Token:**
     - `SET auth:access:<jti>` com o ID do usuário e TTL curto.
     - `SADD auth:access:user:<userId>` incluindo o novo `jti`.
     - `EXPIRE auth:access:user:<userId>` para garantir a limpeza do set.
  2. **Refresh Token** (se configurado):
     - `SET auth:refresh:<refreshJti>` com o ID do usuário e TTL longo.
     - `SADD auth:refresh:user:<userId>` incluindo o `refreshJti`.
     - `EXPIRE auth:refresh:user:<userId>` para limpeza do set.
     - `SET auth:session:<accessJti>` apontando para o `<refreshJti>`.

- Fluxo de logout:
  - `logout(userId, jti)` — revoga o access token (`auth:access:<jti>` e o membro do set `auth:access:user:<userId>`) e, se existir o mapeamento `auth:session:<jti>`, também revoga o `auth:refresh:<refreshJti>` e remove o membro do set `auth:refresh:user:<userId>` (ou seja, logout finaliza a sessão completa).
  - Use `logout` para encerrar a sessão atual do cliente; ele revoga o access JTI e o refresh JTI associado à mesma sessão (quando presente).
  - Observação: o cliente **não precisa** enviar o refresh token ao chamar `logout`; o mapeamento `auth:session` permite revogar o refresh a partir do access token.

- Validação de TTLs:
  - `JWT_EXPIRES_IN` e `JWT_REFRESH_EXPIRES_IN` são validados no momento do login — devem ser **números positivos**. Se inválidos, o login falhará com erro de configuração.

- Fallback/Resiliência:
  - `RedisService` tem fallback in-memory (para cenários onde Redis está indisponível). Operações de cache são **não-críticas**: falhas de cache são ignoradas e logadas para não quebrar o fluxo de autenticação.

- Debug / inspeção (RedisInsight / redis-cli):
  - Checar chaves geradas após login: `auth:access:<jti>`, `auth:access:user:<userId>`, `auth:refresh:<jti>`, `auth:refresh:user:<userId>`, `auth:session:<accessJti>`.
  - Verificar TTL: `TTL auth:access:<jti>` ou `PTTL` para ms.

  ## Exemplo (visualização no RedisInsight)

  Uma sessão típica cria as seguintes chaves (exemplo):
  - `auth:access:d5c60c44-604f-4e11-bf7f-0ed0b94d0bd3` (STRING) — TTL ≈ 59 min
  - `auth:refresh:1c3407c7-b93f-46ce-8553-1d37862139bf` (STRING) — TTL ≈ 6 d
  - `auth:refresh:user:019b14eb-69ff-712b-a144-dcfe6c696241` (SET) — TTL ≈ 6 d
  - `auth:access:user:019b14eb-69ff-712b-a144-dcfe6c696241` (SET) — TTL ≈ 59 min

  Diagrama (simplificado):

  ```text
  auth:access:<accessJti> (string, TTL=access)
        |
        +--> auth:session:<accessJti> -> <refreshJti> (string, TTL=refresh)

  auth:refresh:<refreshJti> (string, TTL=refresh)
  auth:access:user:<userId> (set, contains accessJti, TTL≈access)
  auth:refresh:user:<userId> (set, contains refreshJti, TTL≈refresh)
  ```

  Comandos úteis (redis-cli):
  - `TTL auth:access:<jti>` — verifica TTL do access token
  - `SMEMBERS auth:access:user:<userId>` — lista JTIs ativos do usuário
  - `TTL auth:refresh:<jti>` — verifica TTL do refresh token
  - `GET auth:session:<accessJti>` — recupera `refreshJti` associado (se existir)

  Observação: os TTLs do sets são alinhados aos tokens correspondentes para evitar acúmulo de entradas órfãs.

- Testes e observabilidade:
  - Existem testes unitários cobrindo login, refresh, logout e comportamento de JTI em `apps/backend/src/auth`.
  - Logs de aviso são emitidos em falhas de cache para ajudar a diagnosticar problemas em produção.

Comandos úteis

- Instalar: `pnpm install`
- Desenvolvimento backend: `pnpm --filter backend dev` ou `pnpm run start:dev` na raiz
- Testes backend: `pnpm --filter backend test -- --run`
- Lint: `pnpm --filter backend lint -- --fix`

Onde olhar por padrão

- `apps/backend/src/auth` — implementação e endpoints
- `apps/backend/src/main.ts` — registro do guard global e plugins
- `apps/backend/src/auth/decorators/public.decorator.ts` — decorator para rotas públicas
