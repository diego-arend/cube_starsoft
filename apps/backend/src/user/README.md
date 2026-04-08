## User Module

O módulo `user` expõe os endpoints CRUD para `UserEntity` e é registrado no AppModule via `UserModule.forRoot()`.

Localização dos principais arquivos:

- Controller: [apps/backend/src/user/user.controller.ts](apps/backend/src/user/user.controller.ts#L1)
- Service: [apps/backend/src/user/user.service.ts](apps/backend/src/user/user.service.ts#L1)
- Module: [apps/backend/src/user/user.module.ts](apps/backend/src/user/user.module.ts#L1)
- DTOs e Entity compartilhados: [packages/database](packages/database/src)

Comportamento de autenticação:

- A aplicação aplica autenticação globalmente por padrão (o `JwtAuthGuard` é registrado globalmente em `main.ts`).
- **Todos os endpoints deste módulo são restritos a usuários com a role `ADMIN`**, incluindo a criação de usuários.
- Não há endpoints públicos neste módulo.

Endpoints (principal):

- `POST /users` (criar usuário) — **ADMIN** — aceita `CreateUserSchema`.
- `GET /users` — **ADMIN** — retorna `UserPublicSchema`[] (lista de usuários).
- `GET /users/:id` — **ADMIN** — retorna um `UserPublicSchema` por id.
- `PATCH /users/:id` — **ADMIN** — aceita `UpdateUserSchema`, retorna `UserPublicSchema` atualizado.
- `DELETE /users/:id` — **ADMIN** — remove usuário.

Notas importantes:

- A senha é hasheada no `UserService` antes de persisitir (veja `user.service.ts`).
- A API usa `Zod` para validação (`ZodValidationPipe`) e `ZodSerializerInterceptor` para serialização das respostas.
- A autenticação é baseada em JWT e `JwtAuthGuard` valida/verifica o token e checa o JTI no Redis.
- O controle de acesso RBAC é feito via `RolesGuard` e decorator `@Roles(UserRole.ADMIN)`.
- **Cache**: A listagem de usuários (`GET /users`) é cacheada no Redis por 60 segundos. A chave de cache inclui paginação e filtros (`page`, `limit`, `q`, `sort`, `order`). Operações de escrita (`POST`, `PATCH`, `DELETE`) invalidam automaticamente o cache de listagem (`users:list*`).

Exemplo básico (criar usuário - requer token de admin):

```bash
curl -X POST http://localhost:3001/users \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <ADMIN_ACCESS_TOKEN>' \
  -d '{"email":"user@example.com","password":"senha-segura"}'
```

Exemplo de chamada autenticada (lista usuários):

```bash
curl -X GET http://localhost:3001/users \
  -H 'Authorization: Bearer <ADMIN_ACCESS_TOKEN>'
```

Rodando os testes do módulo:

- Para rodar só o backend:

```bash
pnpm --filter backend test -- --run
```

- Testes e lint do workspace:

```bash
pnpm -w -r test -- --run
pnpm -w -r lint -- --fix
```
