# Backend — Turborepo SaaS

Resumo sucinto do backend desta monorepo.

Principais tecnologias

- Node 18+ • TypeScript
- NestJS (Fastify) • TypeORM (Postgres) • Redis
- Zod (validação), JWT (autenticação), Vitest (testes)
- pnpm + Turborepo monorepo

Organização de código (essencial)

- `src/main.ts` — bootstrap: plugins, rate-limit, global guards e docs
- `src/app.module.ts` — módulos registrados (Auth, User, Database, etc.)
- `src/auth` — autenticação, guards e decorators (`Public` em `auth/decorators/public.decorator.ts`)
- `src/user` — controller, service e módulo do recurso `User`
- `src/shared` — pipes, interceptors e utilitários compartilhados

Comandos úteis

- Instalar dependências: `pnpm install`
- Desenvolvimento: `pnpm --filter backend dev` ou `pnpm run start:dev` (na raiz works too)
- Testes (backend): `pnpm --filter backend test -- --run`
- Lint: `pnpm --filter backend lint -- --fix`

Autenticação

- A aplicação exige autenticação para todas as rotas por padrão (guard global `JwtAuthGuard`).
- Para permitir um endpoint público, adicione explicitamente o decorator `@Public()` na rota, que está definido em `apps/backend/src/auth/decorators/public.decorator.ts`.

Observações rápidas

- Use `Zod` para validação de entrada (pipes) e serialização das respostas (interceptors).
- Para alterar a forma de autenticação (ex.: roles), estenda `JwtAuthGuard`/`RolesGuard` conforme necessário.

Documentação (Swagger)

- A API expõe documentação OpenAPI gerada automaticamente quando `SWAGGER_ENABLED` está habilitado (normalmente apenas em ambientes não-produtivos).
- A inicialização do Swagger é feita por `src/swagger.ts`, que registra os modelos gerados a partir dos Zod schemas, exemplos e esquemas de erro em `components.schemas`.
- A UI inclui autenticação Bearer e `persistAuthorization` está ativado para que o token seja enviado ao usar o recurso "Try it out".
  - Contribuindo com schemas: cada módulo pode exportar seus `components` (ex.: `user/openapi.ts` exporta `userComponents`) — o inicializador de Swagger mescla esses componentes no documento. Componentes compartilhados (como esquemas de erro padrão) ficam em `src/shared/openapi.ts`.

Observabilidade (Logs e Tracing)

- **Logging Centralizado**: A aplicação utiliza o pacote `@turborepo/logging` (baseado em `pino`) para estruturar logs.
  - Em **desenvolvimento**, os logs são formatados para leitura humana (`pretty`).
  - Em **produção**, os logs são estruturados em JSON, compatíveis com **Loki** e seguindo padrões OpenTelemetry (incluindo `service.name` e timestamps ISO).
  - Logs de inicialização do NestJS são suprimidos em produção para reduzir ruído.

- **Inicialização do OTel — padrão `instrumentation.ts`**:
  O arquivo `src/instrumentation.ts` é o **primeiro `import`** em `src/main.ts`. Isso garante que o SDK do OpenTelemetry seja inicializado **antes** de qualquer outro módulo (NestJS, TypeORM, Fastify, amqplib, etc.), o que é obrigatório para que as instrumentações automáticas funcionem corretamente.

  Este padrão é equivalente ao uso de `NODE_OPTIONS="--require dist/instrumentation"` para aplicações Node.js CJS puras.

  ```ts
  // src/main.ts — PRIMEIRA linha obrigatória
  import "./instrumentation"; // inicializa OTel antes de qualquer outro módulo
  import "reflect-metadata";
  import { NestFactory } from "@nestjs/core";
  // ...
  ```

- **Variáveis de ambiente OTel**:

  | Variável | Descrição |
  |---|---|
  | `BACKEND_OTEL_ENABLED` | Habilita OTel para este serviço (sobrescreve `OTEL_ENABLED`). |
  | `BACKEND_OTEL_SERVICE_NAME` | Nome do serviço no OTel — padrão `backend-api`. |
  | `BACKEND_OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint OTLP específico do backend (sobrescreve `OTEL_EXPORTER_OTLP_ENDPOINT`). |
  | `BACKEND_OTEL_EXPORTER_OTLP_PROTOCOL` | Protocolo — `grpc` (padrão para performance) ou `http/protobuf`. |
  | `OTEL_TRACES_EXPORTER` | Exporter de traces — `otlp` (padrão via env). |
  | `OTEL_METRICS_EXPORTER` | Exporter de métricas — `otlp`. |
  | `OTEL_LOGS_EXPORTER` | Exporter de logs — `otlp`. |
  | `OTEL_METRIC_EXPORT_INTERVAL` | Intervalo de exportação de métricas em ms (padrão `15000`). |
  | `OTEL_EXPORTER_OTLP_HEADERS` | Headers adicionais para o Collector (ex: `x-api-key=secret`). |
  | `LOG_EXPORTER_ENABLED` | Habilita exportação de logs para o Collector. |

  As variáveis `OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER` e `OTEL_LOGS_EXPORTER` são lidas diretamente pelo `NodeSDK` do OpenTelemetry — **não requerem código adicional**. Basta definir `OTEL_METRICS_EXPORTER=otlp` e o SDK configura o `PeriodicExportingMetricReader` automaticamente.

- **Tracing Distribuído**:
  - A aplicação é instrumentada com OpenTelemetry via `@turborepo/observability`.
  - Quando um trace está ativo, os logs incluem automaticamente `trace_id`, `span_id` e `trace_flags` para correlação entre logs e traces no Grafana/Tempo.
  - **Headers de Resposta**: Um `TracingInterceptor` global injeta os headers `trace_id` e `span_id` em todas as respostas HTTP (sucesso ou erro), facilitando o rastreamento de requisições em rotinas de suporte.
  - Certifique-se de configurar as variáveis de ambiente `OTEL_EXPORTER_OTLP_ENDPOINT` e `OTEL_SERVICE_NAME`.

- **Monitoramento de Requisições**:
  - Um `LoggingInterceptor` foi configurado globalmente.
  - Ele registra automaticamente detalhes de cada requisição finalizada: método, URL, status code, duração e payload de resposta.
