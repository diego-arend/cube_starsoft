# backend-worker-notification 🔔🤖

Aplicação worker (NestJS) responsável por dois domínios:

1. **Notificações** — consome mensagens de `notifications.email.*` e envia e-mails via `@turborepo/email`.
2. **Assistente IA** — consome queries de `assistant.query.worker`, processa via LangGraph (`@turborepo/assistant`) e publica chunks de resposta de volta ao RabbitMQ para o backend encaminhar ao frontend via WebSocket.

## Módulos

| Módulo | Fila consumida | Responsabilidade |
|---|---|---|
| `NotificationModule` | `notifications.email.backend-worker-notification` | Envio de e-mails transacionais |
| `AssistantWorkerModule` | `assistant.query.worker` | Processamento LLM + RAG, publicação de chunks |

## Resumo das refatorações relevantes

- **AssistantWorkerModule adicionado** (`src/assistant-worker/`): processa queries do assistente de forma assíncrona com suporte a RAG (embeddings) e retry/DLQ.
- **Concorrência por semáforo** (`maxConcurrency: 10`): até 10 queries LLM processadas em paralelo por réplica — deve igualar `RABBITMQ_PREFETCH`.
- **AGENT_SERVICE / KNOWLEDGE_BASE_SERVICE**: providers inline que adaptam `AgentRepository` e `DocumentEmbeddingRepository` para as interfaces do `packages/assistant`.
- Melhor observabilidade: logs adicionais em pontos chave (conexão, assert exchange/queue, bind, recebimento de payload, publish de retry/DLQ).
- Robustez: a fila é explicitamente _bindada_ ao exchange quando configurada com `routingKey` e o subscriber protege contra _double-ack_ em caminhos de retry/DLQ.
- Templates: templates de e-mail agora são importados como strings e compilados com Handlebars; alterações em `src/templates/*.hbs` requerem rebuild do pacote `@turborepo/email`.

## Observabilidade (Logs e Tracing)

Esta aplicação utiliza uma stack padronizada de observabilidade para garantir rastreabilidade ponta a ponta.

### Logs

- **Formato**: JSON estruturado em produção, Pretty Print em desenvolvimento.
- **Biblioteca**: `nestjs-pino`.
- **Contexto**: Os logs incluem automaticamente o `trace_id` e `span_id` quando executados dentro de um contexto de processamento de mensagem.

### Inicialização do OTel — padrão `instrumentation.ts`

O arquivo `src/instrumentation.ts` é o **primeiro `import`** em `src/main.ts`. Isso garante que o OTel SDK seja inicializado **antes** de qualquer outro módulo (NestJS, amqplib, TypeORM, etc.), o que é obrigatório para que as instrumentações automáticas capturem corretamente as operações de I/O.

Este padrão é equivalente ao uso de `NODE_OPTIONS="--require dist/src/instrumentation"` para aplicações Node.js CJS puras.

```ts
// src/main.ts — PRIMEIRA linha obrigatória
import "./instrumentation"; // inicializa OTel antes de qualquer outro módulo
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
// ...
```

### Variáveis de ambiente OTel

| Variável | Descrição |
|---|---|
| `WORKER_OTEL_ENABLED` | Habilita OTel para este serviço (sobrescreve `OTEL_ENABLED`). |
| `WORKER_OTEL_SERVICE_NAME` | Nome do serviço — padrão `backend-worker-notification`. |
| `WORKER_OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint OTLP específico do worker (sobrescreve `OTEL_EXPORTER_OTLP_ENDPOINT`). |
| `WORKER_OTEL_EXPORTER_OTLP_PROTOCOL` | Protocolo — `grpc` (padrão) ou `http/protobuf`. |
| `OTEL_TRACES_EXPORTER` | Exporter de traces — `otlp` (configurado via env, sem código). |
| `OTEL_METRICS_EXPORTER` | Exporter de métricas — `otlp`. |
| `OTEL_LOGS_EXPORTER` | Exporter de logs — `otlp`. |
| `OTEL_METRIC_EXPORT_INTERVAL` | Intervalo de exportação de métricas em ms (padrão `15000`). |
| `LOG_EXPORTER_ENABLED` | Habilita exportação de logs para o Collector. |

> As variáveis `OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER` e `OTEL_LOGS_EXPORTER` são lidas pelo `NodeSDK` automaticamente — **não requerem código adicional**. Definir `OTEL_METRICS_EXPORTER=otlp` faz o SDK configurar o `PeriodicExportingMetricReader` sem necessidade de alteração no código.

### Tracing Distribuído

O tracing é implementado via OpenTelemetry (OTel) com `AmqplibInstrumentation`.

**Como funciona a herança de contexto (Trace Context):**

1. **Origem (Backend)**: Quando o backend publica uma mensagem no RabbitMQ, a `AmqplibInstrumentation` injeta o cabeçalho `traceparent` (padrão W3C) nas propriedades `headers` da mensagem AMQP automaticamente.
2. **Transporte**: O RabbitMQ transporta a mensagem com os metadados de tracing intactos.
3. **Destino (Worker)**: Ao consumir a mensagem, a `AmqplibInstrumentation` no worker:
   - Detecta o cabeçalho `traceparent`.
   - Extrai o `trace_id` original e o `span_id` do publisher.
   - Cria um novo span de processamento que é **filho** do span do publisher.

Trace resultante no Grafana Tempo:
```
Frontend (HTTP) → Backend (HTTP → AMQP publish) → RabbitMQ → Worker (AMQP consume → send email)
```

## Coleta de Dados das Filas — RabbitMQ

### 1. Traces AMQP (OTel)

A `AmqplibInstrumentation` gera automaticamente spans para cada mensagem publicada e consumida. Esses spans ficam visíveis no **Grafana Tempo** como parte do trace distribuído, mostrando:

- `messaging.rabbitmq.routing_key` — routing key da mensagem.
- `messaging.destination` — nome da exchange.
- `messaging.rabbitmq.queue` — nome da fila.
- Duração do processamento de cada mensagem.

### 2. Métricas de Jobs (OTel Custom Counter)

O `NotificationConsumerService` registra um contador customizado via OTel API:

```ts
const meter = metrics.getMeter("backend-worker-notification");
this.counter = meter.createCounter("worker_jobs_total", {
  description: "Total number of jobs processed",
});

// Ao processar:
this.counter.add(1, { status: "success" }); // ou { status: "error" }
```

**Métrica exportada:** `worker_jobs_total` com labels `status=success|error`.

Essa métrica é enviada ao OTel Collector via `OTEL_METRICS_EXPORTER=otlp` e fica disponível no Prometheus para alertas (ex: taxa de erro > threshold).

### 3. Queue Health — RabbitMQ Management API

O broker é iniciado com a imagem `rabbitmq:3-management`, que expõe uma API REST em `:15672` (e UI em `http://localhost:15672`).

Campos de saúde da fila disponíveis via API:

```bash
# Verificar estado de uma fila específica (usuário padrão: rabbitmq/rabbitmq)
curl -u rabbitmq:rabbitmq http://localhost:15672/api/queues/%2f/notifications.email
```

Campos relevantes:

| Campo | Descrição |
|---|---|
| `consumers` | Número de consumidores registrados (>0 indica worker ativo). |
| `messages_ready` | Mensagens aguardando processamento (backlog). |
| `messages_unacknowledged` | Mensagens em processamento (in-flight). |
| `message_stats.deliver_get` | Total de mensagens consumidas (rate disponível). |
| `message_stats.publish` | Total de mensagens publicadas (rate disponível). |

### 4. Scraping pelo Grafana Alloy / Prometheus

Para coletar métricas de fila no Prometheus, ative o plugin `rabbitmq_prometheus` (expõe métricas em `:15692/metrics`):

```bash
# Habilitar o plugin na imagem rabbitmq:3-management
rabbitmq-plugins enable rabbitmq_prometheus
```

Ou configure um exporter dedicado no Alloy:

```alloy
# alloy-config.alloy — exemplo de scrape da Management API
prometheus.scrape "rabbitmq" {
  targets = [{ __address__ = "rabbitmq:15672" }]
  metrics_path = "/metrics"
  basic_auth {
    username = "rabbitmq"
    password = "rabbitmq"
  }
  forward_to = [prometheus.remote_write.default.receiver]
}
```

> **Dashboard recomendado:** Grafana ID `10991` (RabbitMQ Overview) ou ID `4279` (RabbitMQ Monitoring).

### 5. Variáveis de ambiente de Mensageria

| Variável | Descrição |
|---|---|
| `RABBITMQ_URL` | URL de conexão AMQP (ex: `amqp://user:pass@host:5672`). |
| `RABBITMQ_PREFETCH` | Quantidade de mensagens pré-carregadas por consumidor. **Deve igualar `maxConcurrency` no consumer** (valor padrão e recomendado: `10`). Capacidade total com N réplicas: `10 × N` queries simultâneas. |
| `RABBITMQ_RECONNECT_TIMEOUT_MS` | Intervalo de reconexão em ms ao perder conexão com o broker. |

### 6. Variáveis de ambiente do Assistente (LLM + RAG)

| Variável | Obrigatório | Descrição |
|---|---|---|
| `LLM_MULTIMODAL_OPENAI_API_KEY` | ✅ | Chave OpenAI para geração de texto (LangGraph) |
| `LLM_MULTIMODAL_MODEL` | ✅ | Modelo LLM (ex: `gpt-4o`) |
| `LLM_MULTIMODAL_BASE_URL` | opcional | Base URL customizada (proxies, Azure OpenAI) |
| `LLM_EMBEDDINGS_OPENAI_API_KEY` | opcional | Chave para embeddings RAG; fallback: usa `LLM_MULTIMODAL_OPENAI_API_KEY` |
| `LLM_EMBEDDINGS_MODEL` | opcional | Modelo de embeddings; fallback: `text-embedding-3-small` |

> Consulte `docs/refactoring-assistant-async.md` para a arquitetura completa do fluxo assistente.



1. Levante dependências:

```bash
pnpm -w docker:up  # sobe RabbitMQ + Mailpit e demais infra de dev
```

2. Inicie o backend (para publicar notificações):

```bash
pnpm -C apps/backend dev
```

3. Inicie o worker (em outro terminal):

```bash
pnpm -C apps/backend-worker-notification dev
# ou para executar a versão compilada
pnpm -C apps/backend-worker-notification start
```

4. Dispare um evento de teste (em um terminal separado):

```bash
curl -s -X POST http://127.0.0.1:3001/users -H 'Content-Type: application/json' -d '{"name":"Teste","email":"teste@example.com","password":"senha123"}' -w '\nStatus: %{http_code}\n'
```

## Observando logs importantes

- Conexão / canal:
  - "Attempting to connect to RabbitMQ at amqp://..."
  - "RabbitMQ connected and channel created"
- Setup de topologias:
  - "Ensuring exchange <name> (type=topic)"
  - "Ensuring queue <name>"
  - "Binding queue <q> to exchange <x> with routingKey=<rk>"
- Consumidor / processamento (notificações):
  - "Initializing notification consumer"
  - "Subscribing to exchange=notifications queue=... routingKey=..."
  - "Received notification payload: {...}"
  - "Notification processed successfully" ou "Failed to process notification: <err>"
- Consumidor / processamento (assistente):
  - "Starting streamQuery for session <id> (User: <userId>)"
  - "Calling LLM for session <id> with N total messages. Context present: true|false"
  - "Saving assistant response to DB for session <id>"
  - Em erro: "Error processing assistant query for session <id>: <err>"
- Retry/DLQ:
  - Mensagens que falham serão re-publicadas em `*.retry` e, após o limite, em `*.dlq`. Procure logs "Publishing to exchange=<base>.retry" e confirmações.

## Verificando o estado no RabbitMQ (Management UI)

- Cheque a fila:
  - `http://localhost:15672/api/queues/%2f/<queue_name>` (use `rabbitmq:rabbitmq` como credenciais)
  - Campos úteis: `consumers`, `messages_ready`, `messages_unacknowledged`.
- Problema comum: mensagens aparecem na fila (`messages_ready > 0`) mas `consumers = 0` — normalmente significa que o worker não está registrado ou houve erro ao inicializar o consumidor; verifique os logs do worker para os passos acima.

## Erros comuns & como depurar 🛠️

- Mensagens na fila mas consumidor = 0:
  - Verifique se o worker foi iniciado e se os logs mostram "Subscribing" e "Binding queue".
  - Verifique conexões na API `http://localhost:15672/api/connections`.
- Erro ao processar template (`Handlebars.compile` ou erro de template):
  - Verifique que `@turborepo/email` foi rebuildado após mudanças em `src/templates/`.
  - Execute `pnpm -C packages/email test` para validar `renderTemplate` localmente.
- `PRECONDITION-FAILED` / double-ack:
  - O Subscriber usa uma flag `__acknowledged` nos caminhos de retry para evitar ack duplo; se você estiver implementando o handler manualmente, siga a mesma disciplina (evite ack automático + ack manual simultâneos).

## Testes e CI ✅

- Testes unitários do worker: `pnpm -C apps/backend-worker-notification test`.
- Recomenda-se adicionar um teste de integração que valide `publish -> queue -> consumer` (p.ex., usando uma instância do RabbitMQ em Docker). Se quiser, posso adicionar um _integration test_ para garantir esse caminho.

## Migração / notas para time

- Se você editar um template em `packages/email/src/templates/*.hbs`, execute `pnpm -C packages/email build` e reinicie o worker/backend antes de confiar nos novos HTMLs em produção.
- Use as constantes exportadas por `@turborepo/messaging` (`NOTIFICATIONS_EXCHANGE`, `NOTIFICATIONS_EMAIL_QUEUE`, `NOTIFICATIONS_EMAIL_BASE`) para evitar mismatch de nomes entre produtor e consumidor.

## Contribuindo

- Para atualizar o fluxo de retry/ACK, escreva testes que simulem falhas e confirmem o comportamento de retry/DLQ.
- Para mudanças de templates, inclua um teste unitário que valide `renderTemplate(...)` e, se possível, um teste de integração com artifacts `dist`.

---

Se quiser, eu adiciono agora um teste de integração E2E que publica uma mensagem usando `createPublisher`, espera consumer processar (ou consulta a fila) e verifica que o handler foi executado com sucesso. Deseja que eu inclua esse teste?
