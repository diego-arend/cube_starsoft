# Arquitetura Assíncrona do Assistente — Implementação

> **Status: ✅ Implementado e em produção (dev)**
>
> Documento atualizado em 04/04/2026. Descreve a arquitetura **tal como está implementada** no repositório.

**Contexto:** O `AssistantGateway` no `apps/backend` anteriormente invocava `AssistantService.streamQuery` diretamente via WebSocket, bloqueando o event loop da API durante todo o fluxo LLM. A refatoração desacoplou o processamento LLM da API via RabbitMQ: o gateway apenas publica a query na fila, o worker processa e publica os chunks de resposta, e o backend os encaminha ao frontend via Socket.IO com Redis adapter. A lógica do assistente foi extraída para `packages/assistant`, reutilizável por qualquer app do monorepo.

---

## Arquitetura Implementada

```
Frontend
   │  WebSocket (Socket.IO)
   ▼
AssistantGateway  (apps/backend)
   │  client.join(sessionId)  ← garante room para Redis adapter
   │  publica → Exchange: assistant | RK: assistant.query
   ▼
RabbitMQ ──► Queue: assistant.query.worker
                          │
                          ▼
           backend-worker-notification  (worker existente)
           AssistantQueryConsumer
           maxConcurrency: 10 (semáforo por réplica)
           usa @turborepo/assistant → AssistantService.streamQuery
                          │
           publica chunks → Exchange: assistant | RK: assistant.response.<sessionId>
                          │
                          ▼
           RabbitMQ ──► Queue: assistant.response.backend.<hostname>
                                        │
                                        ▼
                          AssistantResponseConsumer  (apps/backend)
                          emite via gateway.server (Socket.IO + Redis adapter)
                                        │
                                        ▼
                                     Frontend
                          eventos: assistant:chunk | assistant:done | assistant:error
```

---

## Motivação

| Problema Original | Solução Implementada |
|---|---|
| Gateway bloqueava enquanto aguardava a LLM responder | Publicação imediata na fila; processamento delegado ao worker |
| Lógica do assistente acoplada ao `apps/backend` | Migrada para `packages/assistant` (reutilizável) |
| Escalabilidade limitada (LLM em cada réplica da API) | Worker escala independentemente da API |
| Sem separação de responsabilidades no Gateway | Gateway cuida apenas de WebSocket; worker cuida da LLM |
| Processamento de queries sequencial no worker | Semáforo de concorrência (`maxConcurrency: 10`) no `packages/messaging` |

---

## Pacotes e Apps modificados

### `packages/assistant` ← novo pacote

Contém toda a lógica do assistente, extraída do `apps/backend`.

**Exports públicos relevantes:**
- `AssistantModule.forRoot({ extraProviders? })` — DynamicModule NestJS
- `AssistantService` — orquestra LangGraph + ConversationService
- `ConversationService` — gerencia sessões e histórico de mensagens
- `AssistantQueryMessageSchema` / `AssistantQueryMessage` — contrato da fila de entrada
- `AssistantResponseChunkSchema` / `AssistantResponseChunk` — contrato da fila de saída
- `AGENT_SERVICE` / `KNOWLEDGE_BASE_SERVICE` — tokens de injeção para providers externos

**`AssistantModule.forRoot({ extraProviders })`** aceita providers externos para `AGENT_SERVICE` e `KNOWLEDGE_BASE_SERVICE`, permitindo que cada app consumidor forneça suas próprias implementações (padrão: noop se não fornecidos).

---

### `packages/messaging/src/vars.ts` — constantes ASSISTANT_*

```ts
export const ASSISTANT_EXCHANGE = "assistant";
export const ASSISTANT_QUERY_BASE = "assistant.query";
export const ASSISTANT_QUERY_QUEUE = "assistant.query.worker";
export const ASSISTANT_RESPONSE_BASE = "assistant.response";
export const ASSISTANT_RESPONSE_QUEUE_PREFIX = "assistant.response.backend";
```

---

### `packages/messaging/src/subscriber.ts` — semáforo de concorrência

Adicionado campo `maxConcurrency?: number` em `SubscriberOptions`. Quando definido, um semáforo baseado em Promises limita quantas mensagens são processadas em paralelo por instância do subscriber:

```ts
// Dentro de subscribe(), antes de cada mensagem:
await acquireSlot();   // bloqueia se activeSlots >= maxConcurrency
try {
  await context.with(parentContext, async () => { /* span OTel + onMessage */ });
} finally {
  releaseSlot();       // sempre libera o slot, mesmo em erro/retry
}
```

**Capacidade total com replicas:** `maxConcurrency × replica count`
**Deve ser igual ao `RABBITMQ_PREFETCH`** para evitar que o broker entregue mais mensagens do que o processo pode processar.

---

### `packages/database/src/data-source.ts` — fix de migração

Reescrita da lógica de carregamento de `.env` para sempre usar `apps/backend/.env` como fonte única de verdade para as credenciais do banco. Resolve o bug que causava `database "turborepo_saas" does not exist` ao rodar `pnpm run migrate:run` a partir da raiz do workspace.

**Fallback padrão:** `turborepo_crew_agents` (era `turborepo_saas`).

---

### `apps/backend-worker-notification` — AssistantWorkerModule

**Novo diretório:** `src/assistant-worker/`

#### `assistant-query.consumer.ts`

Consome a fila `assistant.query.worker`, processa via `AssistantService.streamQuery` e publica chunks na fila de resposta. Implementa retry/DLQ via `packages/messaging`.

```ts
const sub = createSubscriber(this.rabbitSvc, {
  exchange: ASSISTANT_EXCHANGE,
  queue: ASSISTANT_QUERY_QUEUE,
  routingKey: ASSISTANT_QUERY_BASE,
  maxConcurrency: 10,   // ← deve igualar RABBITMQ_PREFETCH no .env
  retry: { baseName: ASSISTANT_QUERY_BASE, maxRetries: 3, retryDelayMs: 5000 },
});
```

Em caso de erro, publica `{ done: true, error: "Erro ao processar solicitação." }` na fila de resposta **antes** de relançar (acionando retry/DLQ), garantindo que o frontend receba feedback imediato.

#### `assistant-worker.module.ts`

Fornece `AGENT_SERVICE` e `KNOWLEDGE_BASE_SERVICE` para o `AssistantModule` via `extraProviders`:

- **`AGENT_SERVICE`**: adapter inline que mapeia `AgentRepository.findById()` → interface `findOne(id)` esperada pelo `AssistantService`.
- **`KNOWLEDGE_BASE_SERVICE`**: adapter inline que usa `createEmbeddingsAdapter` (OpenAI) + `IDocumentEmbeddingRepository` para busca semântica (RAG). Usa `LLM_EMBEDDINGS_OPENAI_API_KEY` com fallback para `LLM_MULTIMODAL_OPENAI_API_KEY`.

```ts
AssistantModule.forRoot({
  extraProviders: [
    { provide: AGENT_SERVICE,       useFactory: (repo) => ({ findOne: ... }),            inject: [getRepositoryToken(AgentEntity)] },
    { provide: KNOWLEDGE_BASE_SERVICE, useFactory: (embRepo) => ({ findRelevantContext: ... }), inject: [DOCUMENT_EMBEDDING_REPOSITORY] },
  ],
})
```

Entities registradas no `DatabaseModule.forFeature`: `AssistantConversationEntity`, `AssistantMessageEntity`, `AgentEntity`, `DocumentEmbeddingEntity`.

---

### `apps/backend` — AssistantResponseConsumer + refatoração do Gateway

#### `assistant-response.consumer.ts` ← novo arquivo

Consome a fila `assistant.response.backend.<hostname>` (unique per pod, auto-delete implícito via routing key `assistant.response.#`) e emite eventos via Socket.IO.

**Acesso lazy ao `gateway.server`:** o campo `@WebSocketServer() server` é populado pelo NestJS após `onApplicationBootstrap`, **não** durante a injeção de dependências. O consumer lê `this.gateway.server` no momento do emit (não no `onModuleInit`), garantindo que o namespace esteja disponível.

```ts
const server = this.gateway.server;   // lazy — lido no callback, não no construtor
if (!server) { this.logger.warn(...); return; }
server.to(String(sessionId)).emit("assistant:chunk" | "assistant:done" | "assistant:error", {...});
```

#### `assistant.gateway.ts` — refatorado

Removida dependência de `AssistantService`. O handler `assistant:query` agora:
1. Executa `client.join(sessionId)` — garante que o socket esteja na room antes de qualquer chunk chegar
2. Publica na fila via `Publisher` de `@turborepo/messaging`

#### `assistant.module.ts` — simplificado

`AssistantService`, `BucketModule` e `DocumentModule` removidos. Dependências: `MessagingModule`, `DatabaseModule.forFeature([...])`, `AgentModule`.

---

### `apps/frontend/src/stores/assistant.store.ts`

Eventos WebSocket corrigidos de notação ponto (`assistant.partial`) para notação dois-pontos (padrão do backend):

| Antes | Depois |
|---|---|
| `assistant.partial` + payload `{ content, isLast }` | `assistant:chunk` + payload `{ messageId, chunk }` |
| `isLast: true` sinalizava fim do stream | `assistant:done` evento separado `{ messageId }` |
| `assistant.error` | `assistant:error` |

---

## Contrato WebSocket (backend → frontend)

| Evento | Payload | Descrição |
|---|---|---|
| `assistant:chunk` | `{ messageId: string, chunk: string }` | Fragmento de resposta da LLM |
| `assistant:done` | `{ messageId: string }` | Fim do stream — atualiza `isStreaming: false` |
| `assistant:error` | `{ messageId?: string, error: string }` | Erro sanitizado |

---

## Variáveis de Ambiente (worker)

O worker precisa das seguintes variáveis além das já existentes (RabbitMQ, Redis, DB):

| Variável | Obrigatório | Descrição |
|---|---|---|
| `LLM_MULTIMODAL_OPENAI_API_KEY` | ✅ | Chave OpenAI para geração de texto |
| `LLM_MULTIMODAL_MODEL` | ✅ | Modelo LLM (ex: `gpt-4o`) |
| `LLM_MULTIMODAL_BASE_URL` | opcional | Base URL customizada (proxies, Azure) |
| `LLM_EMBEDDINGS_OPENAI_API_KEY` | opcional | Chave para embeddings RAG (fallback: usa `LLM_MULTIMODAL_OPENAI_API_KEY`) |
| `LLM_EMBEDDINGS_MODEL` | opcional | Modelo de embeddings (fallback: `text-embedding-3-small`) |
| `RABBITMQ_PREFETCH` | ✅ | Deve ser igual a `maxConcurrency` no consumer (valor: `10`) |

---

## Bugs corrigidos durante a implementação

| Bug | Causa Raiz | Correção |
|---|---|---|
| `pnpm run migrate:run` → `database "turborepo_saas" does not exist` | `packages/database/.env` com `DATABASE_NAME` desatualizado carregava antes do `.env` do backend | Reescrita do dotenv loading em `data-source.ts`; remoção de `packages/database/.env` |
| Frontend não recebia respostas do assistente | `socket.emit("assistant.query")` ≠ `@SubscribeMessage("assistant:query")` (notação errada) | Todos os eventos corrigidos para notação dois-pontos |
| `gateway.server` undefined no consumer | `useFactory: (gw) => gw.server` executado no tempo de DI, antes de `@WebSocketServer()` ser populado | Injeção direta de `AssistantGateway` + acesso lazy a `.server` no momento do emit |
| `TypeError: agentService.findOne is not a function` | `AgentRepository` expõe `findById()` mas a interface do `AGENT_SERVICE` exige `findOne()` | Adapter inline no `useFactory` do `AssistantWorkerModule` |
| Worker ignorava base de conhecimento (sem RAG) | Token `KNOWLEDGE_BASE_SERVICE` nunca provido no worker | `DocumentEmbeddingEntity` adicionado ao `forFeature` + provider inline com `createEmbeddingsAdapter` |

---

## Concorrência e escalabilidade

```
Por réplica do worker:
  RABBITMQ_PREFETCH = 10   (broker entrega até 10 mensagens não-acked)
  maxConcurrency   = 10    (semáforo processa até 10 em paralelo)

Com N réplicas:
  throughput total = 10 × N queries LLM simultâneas
```

O semáforo garante que se `maxConcurrency` queries já estiverem em andamento, novas mensagens aguardam na fila interna do processo até um slot ser liberado — sem risco de overflow de memória por mensagens acumuladas.

---

## Estado do Checklist

| Item | Status |
|---|---|
| `packages/assistant` — lógica extraída, exports públicos | ✅ |
| Zod schemas em `queue.schema.ts` (contrato das filas) | ✅ |
| `packages/messaging/vars.ts` — constantes `ASSISTANT_*` | ✅ |
| `packages/messaging` — `maxConcurrency` + semáforo | ✅ |
| Worker existente reutilizado (nenhum app novo) | ✅ |
| `AssistantWorkerModule.forRoot()` segue padrão `NotificationModule` | ✅ |
| `AGENT_SERVICE` wired no worker (adapter `findById` → `findOne`) | ✅ |
| `KNOWLEDGE_BASE_SERVICE` wired no worker (RAG via embeddings) | ✅ |
| `AssistantResponseConsumer` com acesso lazy ao `gateway.server` | ✅ |
| Eventos WebSocket com notação dois-pontos (frontend + backend alinhados) | ✅ |
| Redis adapter — rooms por `sessionId` garantem fanout cross-réplica | ✅ |
| `packages/database/data-source.ts` — fix dotenv para migrações | ✅ |
| Branding `ERP-TECH` → `ENGECOMP-IA` (sidebar, hero, footer, header) | ✅ |
| `pnpm -w run format` / `lint` / `build` passando | ✅ |
