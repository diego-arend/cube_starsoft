# @turborepo/observability

Este pacote fornece utilitários para configurar e inicializar a observabilidade (Logs, Métricas e Traces) usando **OpenTelemetry (OTel)** em aplicações **Node.js** (NestJS, Next.js server-side).

> O browser (client-side) utiliza o **Grafana Faro SDK**, que opera de forma independente e envia dados diretamente ao Grafana Alloy. Ver README do `apps/frontend` para detalhes.

## Funcionalidades

- **Logs**: Integração com `pino` para enviar logs estruturados para o OpenTelemetry Collector (e posteriormente para o Loki).
- **Métricas**: Coleta métricas de runtime (CPU, memória) e métricas personalizadas via OTLP.
- **Traces**: Rastreamento distribuído para requisições HTTP e operações internas.
- **Headers de Rastreamento**: Injeção automática de `trace_id` e `span_id` nas respostas HTTP para facilitar o suporte.
- **Correlação Fim-a-Fim**: Suporte para propagação de contexto W3C entre Browser e Servidor.
- **Configuração Centralizada**: Utiliza variáveis de ambiente e o pacote `@turborepo/config` para gerenciar a configuração.

## Arquitetura de Observabilidade

```mermaid
graph TD
    subgraph Browser
        F[Grafana Faro SDK]
    end

    subgraph Servidor Node.js
        N[Next.js — instrumentation.ts]
        A[NestJS — AppModule]
        W[Worker — bootstrap]
    end

    subgraph Infraestrutura
        AL[Grafana Alloy :12347]
        OC[OTel Collector :4318]
        LK[Loki]
        TP[Grafana Tempo]
        PR[Prometheus]
        GF[Grafana]
    end

    F -- HTTP POST /collect --> AL
    N -- OTLP/HTTP --> OC
    A -- OTLP/HTTP --> OC
    W -- OTLP/HTTP --> OC
    AL --> LK
    AL --> TP
    OC --> LK
    OC --> TP
    OC --> PR
    LK --> GF
    TP --> GF
    PR --> GF
```

### Camada Browser (Grafana Faro SDK)

O **Grafana Faro SDK** captura automaticamente no browser:

- Erros JS não tratados com stack trace.
- `console.error` / `console.warn`.
- Web Vitals: LCP, INP, CLS, FCP, TTFB.
- Navegações SPA.
- Traces distribuídos via header W3C `traceparent` (integrado com OTel browser instruments).

O SDK envia dados ao **Grafana Alloy**, que age como receptor nativo Faro e os encaminha para Loki (logs) e Tempo (traces).

**Variável obrigatória:** `NEXT_PUBLIC_FARO_URL` (ex: `http://localhost:12347/collect`). Se ausente, o SDK não é inicializado.

### Camada Servidor (OpenTelemetry Node.js SDK)

O pacote `@turborepo/observability` é usado via `initObservability()` nos servidores Node.js:

- **Next.js**: via hook `src/instrumentation.ts` (ativado com `NEXT_PUBLIC_OTEL_ENABLED=true`).
- **NestJS** e **Worker**: via chamada direta no bootstrap.

### Padrão de inicialização — `instrumentation.ts` como primeiro import

O OTel SDK **deve ser inicializado antes de qualquer outro módulo** para que as instrumentações automáticas (HTTP, DB, AMQP, pino, etc.) consigam fazer o monkey-patch das bibliotecas no momento do `require/import`.

Em cada aplicação Node.js, o arquivo `src/instrumentation.ts` é o **primeiro** import de `src/main.ts`:

```ts
// src/main.ts de backend ou worker — PRIMEIRA linha
import "./instrumentation";   // ← inicializa OTel SDK via initObservability()
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
// ...
```

Este padrão é o equivalente Node.js ao uso de:

```bash
NODE_OPTIONS="--require dist/src/instrumentation" node dist/src/main
```

Ambas as abordagens garantem que o código de tracing seja executado antes da importação de qualquer outro módulo. A abordagem via `import` no topo de `main.ts` é preferida em projetos TypeScript/ESM por ser explícita e auditável no código.

### Exporters via variáveis de ambiente (sem código)

O `NodeSDK` do OpenTelemetry suporta configuração completa via variáveis de ambiente, **sem necessidade de código adicional**:

| Variável | Valor | Efeito |
|---|---|---|
| `OTEL_TRACES_EXPORTER` | `otlp` | Configura o `OTLPTraceExporter` automaticamente. |
| `OTEL_METRICS_EXPORTER` | `otlp` | Configura o `PeriodicExportingMetricReader` com OTLP. |
| `OTEL_LOGS_EXPORTER` | `otlp` | Configura o `OTLPLogExporter` automaticamente. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://collector:4317` | Endpoint base para todos os exporters. |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` ou `http/protobuf` | Protocolo de transporte. |
| `OTEL_METRIC_EXPORT_INTERVAL` | `15000` | Intervalo de exportação em ms. |

Basta definir essas variáveis no `.env` — o `NodeSDK` as detecta e configura os exporters automaticamente.

## Instrumentação GenAI / LLM (OpenAI)

O pacote exporta um conjunto de utilitários que instrumentam chamadas a provedores de IA seguindo a **OTel GenAI Semantic Conventions v1.40** ([referência](https://opentelemetry.io/docs/specs/semconv/gen-ai/)). Eles são consumidos pelo pacote `@turborepo/llm` e podem ser usados em qualquer serviço que realize chamadas diretas à API.

### API pública

#### `withGenAISpan(operation, model, provider, attributes, fn)`

Abre um span com nome canônico `{operation} {model}` (ex: `embeddings text-embedding-3-small`) e atributos `gen_ai.*` obrigatórios, executa `fn` e registra a duração em `gen_ai.client.operation.duration` no `finally`.

```ts
import { withGenAISpan, resolveServerAddress } from "@turborepo/observability";

const resultado = await withGenAISpan(
  "embeddings",              // operation: GenAIOperation
  "text-embedding-3-small", // model
  "openai",                  // provider
  { "server.address": resolveServerAddress(baseUrl) },
  async (span) => {
    const res = await fetch(/* ... */);
    span.setAttribute("gen_ai.usage.input_tokens", res.usage.prompt_tokens);
    span.setAttribute("gen_ai.response.model", res.model);
    return res;
  }
);
```

Em caso de erro, o span recebe `recordException`, `setStatus(ERROR)` e o atributo `error.type` com o nome da classe de exceção.

#### `recordGenAITokenUsage(params)`

Registra o histograma `gen_ai.client.token.usage` para tokens de entrada e/ou saída.

```ts
import { recordGenAITokenUsage } from "@turborepo/observability";

recordGenAITokenUsage({
  operation: "chat",
  provider: "openai",
  requestModel: "gpt-4o",
  responseModel: "gpt-4o-2024-08-06",
  inputTokens: 512,
  outputTokens: 180,
});
```

Tokens `undefined` ou `0` são silenciosamente ignorados — o histograma só é gravado quando há valor positivo.

#### `resolveServerAddress(baseUrl?)`

Extrai o hostname de uma URL para popular o atributo `server.address`. Retorna `"api.openai.com"` quando `baseUrl` é `undefined` ou inválida.

```ts
resolveServerAddress("https://api.openai.com/v1/embeddings");
// → "api.openai.com"

resolveServerAddress("http://localhost:11434");
// → "localhost"
```

### Spans gerados

Nome canônico: `{gen_ai.operation.name} {gen_ai.request.model}`

| Operação | Nome do span (exemplo) | Atributos adicionais gravados pelo `@turborepo/llm` |
|---|---|---|
| `embeddings` | `embeddings text-embedding-3-small` | `gen_ai.usage.input_tokens`, `gen_ai.response.model`, `gen_ai.embeddings.dimension.count` |
| `chat` | `chat gpt-4o` | `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.request.temperature` |
| `stt` | `stt whisper-1` | `server.address` |
| `tts` | `tts tts-1-hd` | `server.address` |

### Métricas emitidas

| Métrica | Tipo | Unidade | Descrição |
|---|---|---|---|
| `gen_ai.client.operation.duration` | Histogram | `s` | Duração de cada operação GenAI. Gravado automaticamente pelo `withGenAISpan`. |
| `gen_ai.client.token.usage` | Histogram | `{token}` | Tokens consumidos por tipo (`input`/`output`). Gravado via `recordGenAITokenUsage`. |

Buckets das métricas seguem a especificação OTel GenAI v1.40:
- **Duração**: `[0.01, 0.02, 0.04, 0.08, 0.16, 0.32, 0.64, 1.28, 2.56, 5.12, 10.24, 20.48, 40.96, 81.92]` s
- **Tokens**: `[1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216, 67108864]` tokens

### Configuração do spanmetrics (OTel Collector)

Para que o conector `spanmetrics` exporte as dimensões GenAI ao Prometheus (necessário para o **Grafana Dashboard ID 22028 — LLM Observability**):

```yaml
# otel-config.yaml
connectors:
  spanmetrics:
    namespace: traces_spanmetrics
    dimensions:
      # dimensões existentes...
      - name: gen_ai.operation.name
        default: ""
      - name: gen_ai.provider.name
        default: ""
      - name: gen_ai.request.model
        default: ""
      - name: gen_ai.response.model
        default: ""
```

### Ruído suprimido

A inicialização desativa `instrumentation-dns` e `instrumentation-net` para eliminar dezenas de spans de baixo valor (`dns.lookup`, `tcp.connect`, `tls.connect`) gerados por cada chamada à API externa.

---

## Coleta de Dados de Filas — RabbitMQ

### 1. Traces AMQP distribuídos

O pacote inclui `AmqplibInstrumentation` que instrumenta automaticamente o `amqplib`:

- **Publish**: cria span com `messaging.operation=publish`, injeta `traceparent` nos headers AMQP.
- **Consume**: extrai `traceparent` da mensagem, cria span filho com `messaging.operation=receive`.

O resultado é uma cadeia de traces contínua no Grafana Tempo:

```
Frontend (HTTP) → Backend (AMQP publish) → RabbitMQ → Worker (AMQP consume)
```

Atributos OTel gerados automaticamente:

| Atributo | Exemplo |
|---|---|
| `messaging.system` | `rabbitmq` |
| `messaging.destination` | `notifications` (exchange) |
| `messaging.rabbitmq.routing_key` | `notifications.email.send` |
| `messaging.rabbitmq.queue` | `notifications.email` |

### 2. Métricas customizadas de worker

O worker registra um contador via OTel API (`metrics.getMeter()`):

```ts
const counter = meter.createCounter("worker_jobs_total", {
  description: "Total number of jobs processed",
});
counter.add(1, { status: "success" }); // ou "error"
```

Com `OTEL_METRICS_EXPORTER=otlp`, esse contador é enviado automaticamente ao Collector e fica disponível no Prometheus para criação de alertas.

### 3. Queue Health — RabbitMQ Management API

A imagem `rabbitmq:3-management` expõe uma API REST em `:15672` para monitoramento de filas:

```bash
# Estado da fila (consumers, messages_ready, messages_unacknowledged)
curl -u rabbitmq:rabbitmq http://localhost:15672/api/queues/%2f/<queue_name>
```

Para scraping via Prometheus, ative o plugin nativo:

```bash
rabbitmq-plugins enable rabbitmq_prometheus
# Expõe métricas em http://localhost:15692/metrics
```

Dashboard recomendado: Grafana ID **`10991`** (RabbitMQ Overview).

## Configuração

A configuração é feita principalmente através do arquivo `config.yaml` na raiz do monorepo ou via variáveis de ambiente.

### Variáveis Críticas

| Variável | Descrição |
|---|---|
| `OTEL_ENABLED` | Habilita/Desabilita o OTel SDK globalmente. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | URL do OTel Collector (porta `4318` para OTLP/HTTP). |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | Protocolo — `http/protobuf` (padrão para HTTP) ou `grpc`. |
| `OTEL_SERVICE_NAME` | Nome base do serviço. |
| `OTEL_SERVICE_NAMESPACE` | Namespace do serviço (ex: `cube-starsoft`). |
| `LOG_EXPORTER_ENABLED` | Habilitada envio de logs para o Collector (Loki). |
| `NEXT_PUBLIC_FARO_URL` | Endpoint do Grafana Alloy para o Faro SDK (browser). |

### Habilitar/Desabilitar Observabilidade

Existem dois níveis de controle para a observabilidade server-side:

1. **Desabilitar Completamente (`OTEL_ENABLED`)**
   - **Configuração**: `otel.enabled: false` (no `config.yaml`) ou `OTEL_ENABLED=false` (env).
   - **Efeito**: O SDK do OpenTelemetry **não é inicializado**. Nenhuma métrica, trace ou log é coletado.
   - **Uso**: Ideal para ambientes de desenvolvimento sem a stack de observabilidade.

2. **Desabilitar Apenas Exportação de Logs (`LOG_EXPORTER_ENABLED`)**
   - **Configuração**: `otel.log_exporter_enabled: false` (no `config.yaml`) ou `LOG_EXPORTER_ENABLED=false` (env).
   - **Efeito**: Métricas e Traces **continuam** sendo enviados; logs **não são enviados** para o Collector, mas continuam no console/stdout.
   - **Uso**: Reduz custo de armazenamento no Loki mantendo visibilidade de métricas e traces.

### Exemplo de Configuração (`config.yaml`)

```yaml
otel:
  enabled: true
  log_exporter_enabled: true
  service_name: "turborepo-saas"
  exporter:
    otlp:
      endpoint: "http://localhost:4318"
      protocol: "http/protobuf"
      headers: "Authorization=Bearer dev-secure-bearer-token"

frontend:
  next_public_faro_url: "http://localhost:12347/collect"
  next_public_app_version: "1.0.0"
  next_public_env: "development"
```

## Stack de Observabilidade (Docker)

A stack completa (rodando em um projeto de monitoramento separado) é composta por:

- **OpenTelemetry Collector**: Recebe dados server-side (OTLP/HTTP porta `4318`).
- **Grafana Alloy**: Recebe dados do Faro SDK browser (porta `12347`).
- **Prometheus**: Armazena métricas.
- **Loki**: Armazena logs.
- **Tempo**: Armazena traces.
- **Grafana**: Visualização. Dashboard recomendado: **ID `17882`** (Grafana Faro — Frontend Observability).

A config do Alloy está em `docker/alloy-config.alloy` e deve ser provisionada externamente (não está incluída no `docker-compose-dev.yml`).

## Propagação de Contexto (Trace-ID)

O sistema utiliza o padrão **W3C Trace Context** (`traceparent`) para correlacionar operações entre diferentes serviços.

### Como funciona a propagação:

#### 1. Frontend (Next.js)
- **Client-side (Browser)**: O Faro SDK com `TracingInstrumentation` injeta automaticamente o header `traceparent` em chamadas `fetch` e XHR para o backend.
- **Server-side (SSR/RSC)**: A instrumentação `Undici` (Node.js 18+) captura chamadas `fetch` de saída. O utilitário `apiFetch` atua como rede de segurança, extraindo o `traceparent` dos headers da requisição original (via `next/headers`) e injetando-o na chamada de saída caso o contexto automático falhe.

#### 2. Backend (NestJS)
- A `NestInstrumentation` extrai o contexto dos headers de entrada.
- O `PinoInstrumentation` associa automaticamente `traceId` e `spanId` a todos os logs daquela requisição.

#### 3. Workers e Mensageria
- Ao publicar mensagens (ex: RabbitMQ), o contexto é injetado nos metadados da mensagem.
- O Worker extrai esse contexto ao consumir o job, iniciando um span filho que mantém a conexão com o trace original.

```mermaid
sequenceDiagram
    participant B as Browser (Faro)
    participant F as Frontend SSR (OTel)
    participant A as API NestJS (OTel)
    participant W as Worker (OTel)

    B->>F: Request (inicia trace via Faro)
    F->>A: fetch /api (propaga traceparent)
    A->>W: RabbitMQ Message (injeta contexto)
    W->>W: Processa Job (span filho)
    Note over B,W: Todos compartilham o mesmo Trace ID
```

