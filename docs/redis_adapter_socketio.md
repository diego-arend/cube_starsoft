# Socket.IO multi-réplica: Redis Adapter, estado em memória e race condition

**Contexto:** O backend NestJS (`apps/backend`) usa Socket.IO (`@nestjs/platform-socket.io ^11.1.12`) com um `WebSocketGateway` no namespace `assistant`. Em ambientes com múltiplas réplicas (Docker Swarm, Kubernetes) e Traefik como load balancer em modo round-robin, três problemas foram identificados e corrigidos.

---

## Problema 1 — Socket.IO com adapter em memória (🔴 CRÍTICO) — *Corrigido*

### Causa raiz

Por padrão, o Socket.IO usa um **adapter em memória por processo**. Com `polling` habilitado, o cliente faz múltiplas requisições HTTP de curta duração. O Traefik distribui essas requisições em round-robin — a réplica B recebe um polling request com `socket.id` gerado na réplica A, não encontra a sessão localmente e derruba a conexão com `Session ID unknown`.

Mesmo com WebSocket puro, o handshake inicial (Engine.IO handshake é HTTP) pode cair em réplica diferente do upgrade TCP, causando o mesmo problema.

### Correção aplicada — Redis Adapter + websocket-only

Ambas as medidas foram aplicadas simultaneamente:

**1. `@socket.io/redis-adapter` registrado no `main.ts`** — todo pub/sub de sessão, salas e eventos cross-socket passa pelo Redis, eliminando qualquer dependência de memória local:

```typescript
// apps/backend/src/main.ts
import { RedisIoAdapter } from "./shared/adapters/redis-io.adapter";

// logo após NestFactory.create():
const redisIoAdapter = new RedisIoAdapter(app);
await redisIoAdapter.connectToRedis(app);
app.useWebSocketAdapter(redisIoAdapter);
```

O adapter (`apps/backend/src/shared/adapters/redis-io.adapter.ts`) reutiliza a instância `ioredis` já gerenciada pelo `RedisService` via `getInternalClient()`, criando um segundo cliente dedicado ao SUBSCRIBE (ioredis não permite pub+sub no mesmo client):

```typescript
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connectToRedis(app: INestApplication): Promise<void> {
    const redisService = app.get(RedisService);
    const pubClient = redisService.getInternalClient();

    if (!pubClient) {
      // Redis indisponível ou REDIS_ENABLED=false — graceful degradation
      // para adapter em memória (funciona apenas com réplica única).
      return;
    }

    const subClient = pubClient.duplicate();
    await subClient.connect();

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
```

**2. `transports: ["websocket"]` no servidor e no cliente** — elimina a fase HTTP polling do handshake Engine.IO. Com o Redis Adapter ativo o polling funcionaria corretamente, mas websocket-only é mais eficiente (sem requests HTTP redundantes por sessão) e suficiente para produção e test-load:

```typescript
// apps/backend/src/assistant/assistant.gateway.ts
@WebSocketGateway({
  cors: { origin: "*", credentials: true },
  namespace: "assistant",
  transports: ["websocket"],
})
```

```typescript
// apps/frontend/src/stores/assistant.store.ts
const socket = io(`${finalSocketUrl}/assistant`, {
  auth: { token },
  transports: ["websocket"],
  reconnectionAttempts: 5,
  timeout: 10000,
});
```

> **Sticky session no Traefik:** não necessário. A conexão WebSocket TCP é persistente e fica na mesma réplica durante toda a sessão. O Redis Adapter garante a entrega de eventos emitidos por qualquer outra réplica.

> **Graceful degradation:** se o Redis estiver indisponível no startup, `getInternalClient()` retorna `undefined` e o adapter cai silenciosamente para in-memory. Neste caso o backend funciona com réplica única; escalonamento horizontal requer Redis saudável.

---

## Problema 2 — `graphMap` em memória no `AssistantService` (🔴 CRÍTICO) — *Corrigido*

### Causa raiz

```typescript
// apps/backend/src/assistant/assistant.service.ts  — ANTES
@Injectable()
export class AssistantService {
  private graphMap = new Map<string, AssistantCompiledGraph>(); // ← estado em container
```

Cache ilimitado por `agentId` sem TTL ou invalidação. Cada réplica construía o `AssistantGraph` compilado com o `systemMessage` (specialty + guardRails) do agente na **primeira requisição** e mantinha para sempre. Se o agente fosse atualizado no banco, réplicas diferentes passavam a servir system prompts divergentes indefinidamente — comportamento não-determinístico em produção escalada.

### Correção aplicada

`graphMap` removido. O graph é construído por chamada com dados frescos do banco:

```typescript
// apps/backend/src/assistant/assistant.service.ts  — DEPOIS
private async getGraphForAgent(agentId?: string): Promise<AssistantCompiledGraph> {
  // Build a fresh graph on every call — no in-memory cache.
  // compile() é puro (sem I/O, microsegundos) e o agente deve sempre
  // refletir o estado atual do banco para que todas as réplicas
  // sirvam o mesmo system prompt.
  const assistantGraph = new AssistantGraph(
    this.multimodalModel,
    this.conversationService,
    this.knowledgeBaseService,
    this.logger
  );

  if (agentId) {
    const agent = await this.agentService.findOne(agentId);
    assistantGraph.setSystemMessage(agent.specialty, agent.guardRails);
  } else {
    assistantGraph.setSystemMessage(
      "Você é um agente de suporte explicativo especializado.",
      ""
    );
  }

  return assistantGraph.createGraph();
}
```

> **Performance:** `workflow.compile()` é uma operação de construção de grafo puro (sem I/O), executada em microsegundos. O custo real por chamada é o `agentService.findOne()` (1 query ao Postgres, cacheável via Redis se necessário). O tradeoff é correto para um ambiente escalável.

---

## Problema 3 — Race condition em `ConversationService.saveMessage` (🟠 IMPORTANTE) — *Corrigido*

### Causa raiz

```typescript
// padrão check-then-act — inseguro em concorrência entre réplicas
let conversation = await this.conversationRepo.findBySessionId(sessionId);
if (!conversation) {
  conversation = await this.conversationRepo.save({ id: uuidv7(), sessionId, ... });
  // ← UniqueConstraintViolation se outra réplica inseriu entre o find e o save
}
```

Com duas réplicas processando `saveMessage` com o mesmo `sessionId` novo em paralelo, ambas fazem `findBySessionId` → retornam `null` → ambas tentam `INSERT`. Uma recebe `UniqueConstraintViolation` (PostgreSQL `23505`). O `catch` externo capturava o erro, logava e descartava — **a mensagem era silenciosamente perdida**.

### Correção aplicada

Catch interno específico para `23505` com re-fetch:

```typescript
// apps/backend/src/assistant/conversation.service.ts
try {
  conversation = await this.conversationRepo.save({
    id: uuidv7(),
    sessionId,
    userId: dbUserId,
    agentId: agentId ?? null,
    title,
  });
} catch (err: unknown) {
  const isUniqueViolation =
    err instanceof Error &&
    ((err as { code?: string }).code === "23505" ||
      err.message.includes("23505") ||
      err.message.toLowerCase().includes("unique constraint") ||
      err.message.toLowerCase().includes("unique violation"));

  if (isUniqueViolation) {
    this.logger.warn(
      `Race condition detectada na criação de conversa para session ${sessionId} — buscando registro existente`,
      ConversationService.name
    );
    conversation = await this.conversationRepo.findBySessionId(sessionId);
  } else {
    throw err;
  }
}

if (!conversation) {
  throw new Error("Could not create/find conversation");
}
```

---

## Arquitetura final do fluxo WebSocket

```
Cliente (browser)
  └─ WebSocket ws://host:8081/socket.io/assistant
       │
       ▼
  Traefik (:8081)  ──  PathPrefix("/socket.io")  ──  round-robin
       │
       ├─▶ backend réplica A (:3001)
       │        └─ RedisIoAdapter (pubClient)
       │                  │ PUBLISH socket.io#/assistant#...
       │                  ▼
       │             Redis (pub/sub)
       │                  ▲
       └─▶ backend réplica B (:3001)
                └─ RedisIoAdapter (subClient)
                          │ SUBSCRIBE → despacha evento local
```

Não há sticky session. A conexão TCP WebSocket persiste em uma única réplica. O Redis propaga todos os eventos emitidos por qualquer réplica para as demais via pub/sub.

---

## Validação

```bash
# Build e lint
pnpm --filter backend run build
pnpm --filter backend run lint

# Testes unitários
pnpm --filter backend run test

# Test-load com múltiplas réplicas
docker compose -f docker/test-load/docker-compose-test-load.yml up --scale backend=3 -d
```

Verificar nos logs que:
- Não há erros `Session ID unknown` nos logs do Socket.IO
- Não há erros `23505 unique_violation` no Postgres sob carga simultânea
- Todos os logs de `assistant.query` aparecem independente de qual réplica atende

---

## Resumo dos arquivos alterados

| Arquivo | Alteração | Problema |
|---|---|---|
| `apps/backend/src/shared/adapters/redis-io.adapter.ts` | Criado — Redis pub/sub adapter para Socket.IO | 1 |
| `apps/backend/src/main.ts` | Registrar `RedisIoAdapter` após `NestFactory.create` | 1 |
| `apps/backend/package.json` | `@socket.io/redis-adapter ^8.3.0` adicionado | 1 |
| `apps/backend/src/assistant/assistant.gateway.ts` | `transports: ["websocket"]` (sem polling) | 1 |
| `apps/frontend/src/stores/assistant.store.ts` | `transports: ["websocket"]` (sem polling) | 1 |
| `apps/backend/src/assistant/assistant.service.ts` | Remover `graphMap` — graph construído por chamada | 2 |
| `apps/backend/src/assistant/conversation.service.ts` | Catch `23505` + re-fetch em `saveMessage` | 3 |
