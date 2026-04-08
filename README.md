# Turborepo SaaS Boilerplate

Este monorepo é um template inicial para aplicações SaaS. Contém um backend em NestJS, um frontend em Next.js, pacotes compartilhados e ferramentas de apoio. Os arquivos README em cada pacote e aplicação contêm documentação específica por funcionalidade.

### Apps

- `apps/backend` — Aplicação backend em NestJS (inclui autenticação, rate-limit e rotas de API). Consulte `apps/backend/README.md` e os README dos módulos em `apps/backend/src`.
- `apps/frontend` — Aplicação frontend em Next.js. Consulte `apps/frontend/README.md`.
- `apps/backend-worker-notification` — Aplicação worker em NestJS com dois domínios: (1) consome mensagens de notificação e envia e-mails via `@turborepo/email`; (2) processa queries do assistente IA de forma assíncrona via `@turborepo/assistant` (LangGraph + RAG), com suporte a `maxConcurrency: 10` por réplica. Consulte `apps/backend-worker-notification/README.md` e `docs/refactoring-assistant-async.md`.

### Packages

- `packages/database` — Utilitários de banco de dados, migrations, entidades e repositórios TypeORM. Consulte `packages/database/README.md`.
- `packages/redis` — Wrapper e utilitários Redis para o monorepo. Consulte `packages/redis/README.md`.
- `packages/messaging` — Pacote de mensageria e eventos com RabbitMQ (publicadores/subscritores e fluxo de retry + DLQ). Consulte `packages/messaging/README.md`.
- `packages/ui` — Componentes de UI compartilhados para aplicações frontend. Consulte `packages/ui/README.md`.
- `packages/eslint-config` — Configuração ESLint compartilhada. Consulte `packages/eslint-config/README.md`.
- `packages/prettier-config` — Configuração Prettier compartilhada.
- `packages/typescript-config` — Configurações TypeScript compartilhadas para diferentes alvos (node, react, nest).
- `packages/config` — Acesso centralizado a configurações do workspace.
- `packages/logging` — Utilitários de logging e configuração central do logger.
- `packages/observability` — Utilitários e configuração para instrumentação e integração com OpenTelemetry (traces, métricas, exporters e helpers para instrumentar aplicações). Consulte `packages/observability/README.md`.
- `packages/rate-limit` — Guardas e utilitários para rate limiting de endpoints e proteções com Redis. Consulte `packages/rate-limit/README.md`.
- `packages/email` — Serviço SMTP de envio de emails, templates HTML e uma pequena CLI para envio de emails de teste. Veja `packages/email/README.md`.
- `packages/bucket` — Cliente e abstrações para armazenamento de objetos compatível com S3 (AWS S3 em produção / MinIO em desenvolvimento). Consulte `packages/bucket/README.md`.

Cada pacote/aplicação é 100% [TypeScript](https://www.typescriptlang.org/).

### Comandos do Turborepo

Este repositório usa `pnpm` workspaces e `turbo` para orquestrar tarefas. Execute scripts a partir da raiz com `pnpm run <script>`.

Dicas rápidas:

- Para executar um script dentro de um pacote específico use `pnpm -C <path> <script>`.
- Como alternativa, use filtros: `pnpm --filter <package> run <script>`.

Principais comandos (raiz)

- **Instalar dependências**
  - `pnpm install`

- **build (full workspace)**
  - `pnpm run build` (internamente `turbo run build`) — constrói todo o workspace respeitando dependências e cache.

- **build apenas pacotes**
  - `pnpm run build:packages` — constrói apenas os pacotes em `packages/*` (útil antes de `dev`).

- **predev (build packages only)**
  - `pnpm run predev` — mesmo que `turbo run build --filter './packages/*' --filter '!apps/**'`.

- **dev (modo desenvolvimento)**
  - `pnpm run dev` — inicia os modos dev das aplicações (onde aplicável). Para rodar um app específico: `pnpm -C apps/frontend dev`.

- **lint / lint:fix**
  - `pnpm run lint`
  - `pnpm run lint:fix`

- **format**
  - `pnpm run format` — aplica Prettier em todo o workspace.

- **knip**
  - `pnpm run knip` — analisa o workspace em busca de arquivos, dependências e exports não utilizados.

- **clean**
  - `pnpm run clean` — limpa o cache do Turborepo e remove artefatos de build (`dist`, `.next`, `.turbo`) de forma segura.

- **check-types**
  - `pnpm run check-types` — checa tipos TypeScript via `turbo`.

- **test / test:ci**
  - `pnpm run test` — executa os testes em modo watch por padrão.
  - `pnpm run test:ci` — executa os testes para CI (sem watch, `--run`).
  - `pnpm run test:packages` — executa os testes apenas dentro de `packages/*`.
  - `pnpm run test:backend` — executa os testes apenas dentro de `apps/backend`.

- **Cobertura**
  - `pnpm run test:all:coverage` — gera cobertura para todo o workspace e mescla resultados.

- **check-declarations**
  - `pnpm run check-declarations` — valida a emissão de `*.d.ts` para pacotes que declaram `types`.

- **Migrations / Seed**
  - `pnpm run migrate:generate` — gerar migration (delegates to `@turborepo/database`).
  - `pnpm run migrate:run` — aplicar migrations.
  - `pnpm run seed:users` — popular dados de exemplo.

- **docker (dev infra)**
  - `pnpm run docker:up` — inicia serviços de desenvolvimento (Mailpit, Postgres, Redis, MinIO, RabbitMQ, etc.).
  - `pnpm run docker:down` — para os serviços.

- **Config & env utilities**
  - `pnpm run validate:config` — valida `config.yaml` usando `@turborepo/config`.
  - `pnpm run generate-envs` — (Automático) Gera arquivos `.env` para todas as aplicações (`backend`, `worker`, `frontend`) e para o pacote `database`.
  - `pnpm run env:generate:frontend` — gera `.env` apenas para o frontend.
  - `pnpm run env:generate:backend` — gera `.env` apenas para o backend.
  - `pnpm run env:generate:worker` — gera `.env` apenas para o worker.
  - `pnpm run env:generate:database` — gera `.env` apenas para o pacote @turborepo/database (necessário para migrations em ambientes isolados).

### Gerenciamento de Configuração (config.yaml)

O projeto utiliza o arquivo `config.yaml` na raiz como **única fonte de verdade**.

1.  **Geração Automática**: Os comandos `pnpm dev` e `pnpm build` executam automaticamente a geração dos arquivos `.env` locais para cada aplicação e para o pacote de banco de dados.
2.  **Consumo de Configurações**:
    - **Aplicações**: Carregam seu próprio `.env` no startup e validam contra o schema central em `@turborepo/config`.
    - **Pacotes (Runtime)**: Recebem configurações via Injeção de Dependência (DI) das aplicações, garantindo desacoplamento total.
    - **Pacotes (CLI)**: O pacote `@turborepo/database` possui seu próprio `.env` (gerado automaticamente) para permitir a execução de migrations e seeds de forma independente, sem depender do contexto de uma aplicação iniciada.
3.  **Segurança e contexto**:
    - **Isolamento**: Cada `.env` gerado contém apenas as variáveis necessárias para seu contexto (ex: o backend não recebe variáveis do worker).
    - **Frontend**: Apenas variáveis anotadas como `safeForFrontend: true` no schema são exportadas para o `.env` do frontend.

Exemplos (em pacotes individuais):

```
# Build package 'email' and run the test/send helper
pnpm -C packages/email run build
pnpm -C packages/email run test
pnpm -C packages/email run send:test -- --to=you@example.com --template=welcome
```

Se precisar de comandos mais específicos (por pacote ou para automação/CI), incluo exemplos adicionais nesta seção.

## Ferramentas de desenvolvimento

Para facilitar o desenvolvimento local, o repositório inclui serviços e ferramentas úteis que você pode iniciar via Docker Compose (ex.: `pnpm run docker:up`).

- **Mailpit (servidor SMTP local e interface web)**
  - O Mailpit é útil para testar o envio de emails sem enviar mensagens reais. Ele está configurado no `docker-compose.yml`.
  - **Portas padrão**: SMTP `localhost:1025`, interface web `http://localhost:8025`.
  - **Como usar**:
    - Envie um email de teste usando a CLI do pacote de email (exemplo):
    - Abra a interface do Mailpit em `http://localhost:8025` e confira as mensagens recebidas.
    - A interface mostra lista de emails, visualização em HTML e texto puro, cabeçalhos e anexos — útil para validar templates e payloads.
  - **Observações**:
    - Use Mailpit apenas em ambientes de desenvolvimento.
    - Se precisar alterar a porta SMTP ou as configurações, ajuste as variáveis do `packages/email` e do `docker-compose.yml`.

- **RedisInsight (interface web para Redis)**
  - O RedisInsight é uma interface gráfica para visualizar e gerenciar dados no Redis — útil para depuração e inspeção de chaves, TTLs e valores.
  - **Porta padrão**: UI em `http://localhost:8001`.
  - **Como usar**:
    - Abra `http://localhost:8001` no seu navegador.
    - Adicione uma conexão apontando para `redis:6379` (o nome do serviço `redis` no `docker-compose.yml`).
    - A interface permitirá que você navegue nas chaves, edite valores e visualize métricas.
  - **Observações**:
    - RedisInsight é recomendado somente em ambientes de desenvolvimento; não exponha ao tráfego público sem autenticação.

- **MinIO (S3-compatible object storage + Console UI)**
  - MinIO fornece armazenamento S3 compatível para desenvolvimento local; é útil para testar uploads e integração com `packages/bucket` (uploads são servidor-mediados e validados pelo backend).
  - **Portas padrão**: S3 API em `http://localhost:9000`, Console/UI em `http://localhost:9001`.
  - **Credenciais padrão**: usuário `minio`, senha `minio123`.
  - **Como usar**:
    - Inicie o MinIO via `pnpm run docker:up`.
    - Acesse a Console UI em `http://localhost:9001` e autentique com as credenciais acima; crie um bucket com o nome configurado em `S3_BUCKET` no seu `config.yaml` (ou use o valor padrão).
    - No código, aponte `S3_ENDPOINT` para `http://localhost:9000` (ou `http://minio:9000` quando chamado de dentro dos containers Docker).
  - **Observações**:
    - Use MinIO apenas em desenvolvimento; não exponha as credenciais padrão em ambientes públicos.

- **pgAdmin (interface web para Postgres)**
  - pgAdmin é a interface web para administrar o Postgres local incluído no `docker-compose`.
  - **Porta padrão**: UI em `http://localhost:8080`.
  - **Credenciais padrão**: `admin@example.com` / `admin` (pgAdmin) — o Postgres está configurado com usuário `postgres` / senha `password`.
  - **Como usar**:
    - Inicie os serviços: `pnpm run docker:up`.
    - Abra `http://localhost:8080`, faça login com as credenciais do pgAdmin e adicione uma nova conexão apontando para `Host: postgres`, `Port: 5432`, `Maintenance DB: turborepo_saas`, `Username: postgres` e `Password: password`.
  - **Observações**:
    - Por questões de segurança, troque as credenciais ao expor o serviço ou antes de usar em ambientes que não sejam de desenvolvimento.

- **RabbitMQ (message broker + Management UI)**
  - O RabbitMQ é adicionado ao `docker-compose` com a imagem `rabbitmq:3-management` (inclui UI oficial).
  - **Portas padrão**: AMQP em `localhost:5672`, Management UI em `http://localhost:15672`.
  - **Como usar**:
    - Inicie o broker: `pnpm run docker:up`.
    - Abra `http://localhost:15672` e faça login com `rabbitmq:rabbitmq`.
    - Configure suas exchanges/queues conforme necessário e use `@turborepo/messaging` para publicar/assinar mensagens.
  - **Observações**:
    - A conta padrão `rabbitmq`/`rabbitmq` é apenas para desenvolvimento. Se expor o serviço, troque as credenciais.

### Comandos uteis para manutenção da maquina de desenvolvimento:

- `pnpm prune && pnpm store prune && pnpx depcheck` - Manutenção dos node_modules e depêndencias do projeto. Util em ambiente de desenvolvimento para limpeza profundo do node_modules dos pacotes e aplicações.
  pnpm prune = forçar a remoção de pacotes órfãos (extranhos)
  pnpm store prune = Limpar o Cache Global (Store) do pnpm. O pnpm utiliza um sistema de arquivos compartilhado (hard links). Para limpar arquivos da "loja" global que não estão mais sendo referenciados por nenhum projeto no seu computador
  pnpx depcheck = Identificar dependências não utilizadas no código. Para verificar quais pacotes estão instalados no seu package.json mas não são importados em nenhum arquivo .ts ou .js, o ideal é usar a ferramenta depcheck.

- `docker image prune -f` — de tempos em tempos executar para limpar imagens não utilizadas ou orfans

- `docker volume prune -f` — de tempos em tempos executar para limpar volumes não utilizados ou orfãos.

## Ambiente de Teste de Carga

Além dos testes unitários e de integração, este monorepo inclui um conjunto de recursos para _load testing_ (teste de carga).

- A pasta `load-tests/` contém cenários YAML (`idempotency-scenario.yml`, `login-scenario.yml`, etc.) que podem ser executados usando a ferramenta Artillery. Os exemplos cobrem casos comuns como autenticação e operações idempotentes.
- No `load-tests/package.json` há scripts já configurados, por exemplo:
  - `pnpm --filter load-tests run login` — executa o cenário de login.
  - `pnpm --filter load-tests run idempotency` — executa o cenário de idempotência.
  - `pnpm --filter load-tests run all` — roda todos os cenários sequencialmente.

> **Dica:** rode `pnpm -C load-tests run <script>` ou use filtros para componentes específicos do monorepo.

Esses scripts começam um serviço local (quando necessário) e direcionam o tráfego para o `backend`/`frontend` em desenvolvimento ou para endpoints externos, conforme a configuração em `load-tests/.env`.

## Observabilidade e Monitoramento

O projeto vem configurado com OpenTelemetry para coleta de Logs, Métricas e Traces. A stack de observabilidade (Grafana, Loki, Tempo, Prometheus, OTEL Collector) roda via servidor de monitoramento (projeto separado).

### Integração com Testes e Métricas de Frontend

- **FARO** é utilizado para capturar métricas Web Vitals no frontend. Durante execuções de carga que envolvem o `frontend`, os dados de performance são enviados automaticamente ao servidor FARO configurado via `config.yaml`.

- Para o **backend** e **worker** utilizamos o padrão OpenTelemetry APM. Traces, métricas e logs desses serviços são exportados para a stack OTEL (via OTEL Collector), permitindo análise detalhada de desempenho e gargalos.

- A instrumentação é feita de ponta a ponta, com propagação de contexto de tracing entre frontend, backend e worker, possibilitando rastreamento completo de uma requisição ou fluxo de mensagens através de múltiplos serviços.

### Controle de Habilitação

Você pode controlar a observabilidade via `config.yaml`:

- **Desabilitar tudo**: Defina `otel.enabled: false`. Isso desliga o SDK do OpenTelemetry completamente.
- **Desabilitar apenas logs remotos**: Defina `otel.log_exporter_enabled: false`. Isso mantém métricas e traces ativos, mas para de enviar logs para o Loki (logs locais continuam funcionando).

Para mais detalhes sobre a configuração e funcionamento, consulte a documentação em [`packages/observability/README.md`](packages/observability/README.md).

O pacote `packages/observability` contém utilitários e presets para instrumentação (OTEL), configuração de exporters (Loki/Tempo/Prometheus) e helpers para integrar tracing/metrics/logging nas aplicações do monorepo.

## Documentação do projeto (README das aplicações e pacotes)

Este repositório organiza a documentação por pacote e módulo. Abaixo estão links diretos para READMEs úteis ao trabalhar com módulos e funcionalidades das aplicações.

- `apps/backend/README.md` — Visão geral da aplicação backend e início rápido.
- `apps/frontend/README.md` — Visão geral da aplicação frontend e início rápido.
- `apps/backend/src/auth/README.md` — Documentação do módulo de autenticação (JWT, JTI, RBAC, integração com rate-limit).
- `apps/backend/src/rate-limit/README.md` — Documentação das utilidades de rate limiting e fallback com Redis.
- `packages/database/README.md` — Pacote de banco de dados, TypeORM, migrations e documentação de entidades.
- `packages/redis/README.md` — Uso do pacote Redis e detalhes de armazenamento.
- `packages/ui/README.md` — Componentes UI compartilhados e detalhes do storybook (se aplicável).
- `packages/config/README.md` — Configuração centralizada e gerenciamento de `.env`.
- `packages/logging/README.md` — Utilitários de logging e integração com pino.
- `packages/bucket/README.md` — Documentação do pacote de armazenamento de objetos (S3/MinIO).

### `packages/bucket` — Armazenamento de objetos (S3 / MinIO) 🔧

**O que é**

- `packages/bucket` fornece um cliente e abstrações para trabalhar com armazenamento de objetos compatível com S3. Ele implementa um `BucketService` de alto nível e duas _adapters_: `S3Adapter` (AWS SDK v3) e `InMemoryAdapter` (usado para testes unitários).

**Nota**: O `packages/bucket` foi refatorado recentemente; consulte `packages/bucket/README.md` para alterações na API e instruções de migração.

As variáveis de ambiente necessárias para configurar o `packages/bucket` estão documentadas em `config.yaml.example` e em `packages/bucket/README.md`.

**Testes & Integração**

- Tests unitários podem usar `InMemoryAdapter` (já usado nos testes do pacote).
- Para testes de integração, inicie MinIO local (`pnpm run docker:up`) e rode os testes desejados (consulte `packages/bucket/README.md` para instruções sobre como apontar o cliente para o MinIO local).

> **Dica**: Quando executar dentro de containers Docker, prefira usar o host do serviço `minio` (ex.: `http://minio:9000`) em vez de `localhost`.

Para mais detalhes e exemplos, consulte `packages/bucket/README.md`.
Use estes READMEs como fonte principal para integração e configuração específicas das funcionalidades.

## Ambiente do workspace

Este repositório inclui um template de configuração do workspace em `config.yaml.example`. Para usar os valores de configuração no seu ambiente local, crie um arquivo `config.yaml` na raiz do repositório a partir do exemplo:

# copiar o YAML de exemplo para o arquivo de configuração na raiz

```bash
cp config.yaml.example config.yaml
# Edit `config.yaml` and add any secrets (like POSTGRES_PASSWORD) as necessary.
```

Para utilizar a configuração do workspace, `@turborepo/config` é a fonte canônica para configurações em tempo de execução.

**Gerenciamento de arquivos `.env`**: a geração automática de arquivos `.env.local` a partir do `config.yaml` foi removida. O `config.yaml` é a fonte canônica de configuração e **todas** as variáveis descritas nele devem ser definidas e validadas pelo esquema central (schemats) exposto por `@turborepo/config`. Use `pnpm validate:config` para validar seu `config.yaml` antes de iniciar as aplicações. Se precisar de arquivos `.env.local` para ferramentas específicas, crie-os manualmente a partir dos valores em `config.yaml` e trate os segredos com cuidado.

## Gerar um `config.yaml` do workspace a partir das apps (manual)

Se você quiser criar um `config.yaml` a partir dos arquivos `apps/*/.env.local` existentes, você pode:

1. Coletar manualmente os valores de cada `apps/*/.env.local` e escrevê-los em `config.yaml`.
2. Opcionalmente, criar um script curto usando `yaml` e Node para mesclar e converter os arquivos `.env.local` em YAML.
3. Sempre execute `pnpm validate:config` para validar o `config.yaml` final.

**Observação**: A geração automática de arquivos `.env` (`sync:env`) foi removida e **não** é mais suportada. Use `config.yaml` como fonte de verdade e valide-o com `pnpm validate:config`. Se for necessário criar arquivos `.env.local` para desenvolvimento, gere-os manualmente a partir dos valores em `config.yaml` e proteja os segredos adequadamente.

### Pacote de configuração compartilhada

O monorepo inclui o pacote `@turborepo/config`, que centraliza o carregamento de variáveis de ambiente e a validação com Zod.

Inicialização da configuração:

- Copie `config.yaml.example` para a raiz do repositório e ajuste os valores conforme seu ambiente.
- Use `pnpm validate:config` para validar o `config.yaml` final contra o esquema central (`schemats`) do pacote `@turborepo/config`. O comando deve ser executado na raiz do repositório, lê `config.yaml` e sai com código diferente de zero em caso de erro (imprime erros formatados para ajudar a corrigir o arquivo).
- O pacote expõe funções e acessores tipados usados em todo o monorepo para carregar e validar a configuração em tempo de execução.

## Links úteis

Saiba mais sobre o Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)

## Relatório de Segurança (Frontend <-> Backend)

| Item do Checklist                                | Status         | Detalhes                                                                                                                                                                                                                                    |
| :----------------------------------------------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cookies são HttpOnly e Secure**                | ✅ **OK**      | O Backend retorna tokens no corpo, mas o **NextAuth** (Frontend) gerencia a sessão com cookies **HttpOnly** e **Secure** por padrão.                                                                                                        |
| **Proteção CSRF implementada**                   | ✅ **OK**      | O **NextAuth** possui proteção CSRF nativa habilitada para rotas de autenticação.                                                                                                                                                           |
| **CORS restrito ao domínio específico**          | ⚠️ **Atenção** | O Backend usa `CORS_ORIGIN`. Se não definido, permite qualquer origem. **Recomendação:** Definir `CORS_ORIGIN` em produção.                                                                                                                 |
| **Rate limiting em endpoints críticos**          | ✅ **OK**      | Rota `/auth/login` protegida por `LoginRateLimitGuard` (IP e Email).                                                                                                                                                                        |
| **Refresh tokens têm rotação**                   | ✅ **OK**      | `JwtAuthStrategy` implementa rotação de refresh tokens (invalida anterior ao usar).                                                                                                                                                         |
| **JWT valida algoritmo, issuer, audience**       | ✅ **OK**      | Algoritmo `HS256` é forçado. Validação de `issuer` e `audience` implementada e configurável via `JWT_ISSUER` e `JWT_AUDIENCE`.                                                                                                              |
| **HTTPS obrigatório em produção**                | ✅ **OK**      | Backend usa `helmet` em produção. NextAuth força cookies `Secure` em produção.                                                                                                                                                              |
| **Logs não contêm informações sensíveis**        | ✅ **OK**      | Revisão de código não indicou log de credenciais em texto plano.                                                                                                                                                                            |
| **Tokens têm tempo de vida adequado**            | ✅ **OK**      | Access Token (1h) e Refresh Token (7 dias) configuráveis.                                                                                                                                                                                   |
| **Frontend não armazena tokens em localStorage** | ✅ **OK**      | NextAuth usa cookies. Tokens em memória (`useSession`) não persistem em localStorage.                                                                                                                                                       |
| **Isolamento de Variáveis**                      | ✅ **OK**      | Segredos sensíveis nunca são expostos ao navegador — apenas chaves explicitamente anotadas em `packages/config/src/schema.ts` (`EnvAnnotations`) com `safeForFrontend: true` serão exportadas para o `.env` do frontend (opt-in explícito). |
