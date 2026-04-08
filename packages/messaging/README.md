# @turborepo/messaging 🚀

## Propósito

Pacote de integração com RabbitMQ para o monorepo. Exporta um `RabbitMqService` para gerenciar conexão/canal e utilitários para criar _publishers_ e _subscribers_ programaticamente em aplicações NestJS.

## Resumo das refatorações recentes

- **Suporte a QoS (Prefetch)**: `RabbitMqService` agora aceita configuração de prefetch (`RABBITMQ_PREFETCH`) para escalabilidade horizontal justa entre réplicas de workers.
- **Deduplicação e Idempotência**:
  - `Publisher` agora gera automaticamente um `messageId` (UUID v4) se nenhum for fornecido.
  - `Subscriber` preserva e propaga o `messageId` original durante todo o fluxo de retentativa (Retry/DLQ), permitindo que workers implementem travas de idempotência consistentes.
- `RabbitMqService` ganhou logs mais verbosos para conectar, criar/existir exchanges e filas, bind e publish/confirm.
- `bindQueue()` é exposto para vincular filas explicitamente quando necessário.
- `createPublisher` agora publica com confirmação (confirm channel) e registra _publish confirmed_ quando a confirmação chega.
- `createSubscriber` vincula a fila à exchange quando `routingKey` está presente, e trata corretamente o fluxo de retry/DLQ.
- Corrigimos um problema de _double-ack_ usando uma marca `__acknowledged` para evitar ack duplo em caminhos de retry/DLQ.

## Quick start

- Adicione `MessagingModule.forRoot()` ao `AppModule` do NestJS.
- Injete `RabbitMqService` em serviços que publicam/consomem mensagens.

## Configuração

As configurações são lidas por `@turborepo/config` (veja `config.yaml`). Valores relevantes:

- `RABBITMQ_URL` (recomendado) — ex: `amqp://rabbitmq:rabbitmq@127.0.0.1:5672`
- `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`
- `RABBITMQ_RECONNECT_TIMEOUT_MS`
- `RABBITMQ_PREFETCH` (Default: 10) — Define quantas mensagens um consumidor pode receber sem enviar o ACK. Essencial para Fair Dispatch em ambientes com múltiplas réplicas.

## Escalabilidade e Idempotência ⚖️

Este pacote foi projetado para rodar em ambientes com múltiplas réplicas (escala horizontal):

### 1. Fair Dispatch (QoS)

Ao configurar `RABBITMQ_PREFETCH`, garantimos que uma réplica do worker não "sequestre" todas as mensagens da fila se estiver processando lentamente, permitindo que réplicas ociosas assumam o trabalho.

### 2. Idempotência Preservada

O `messageId` é gerado na origem (Publisher) e mantido pelo `Subscriber` mesmo após falhas e retentativas nas filas de `.retry`. Os consumidores podem usar este ID (disponível no contexto do `subscribe`) para implementar braços de deduplicação (ex: usando Redis SET NX).

```ts
await sub.subscribe(async (payload, context) => {
  const messageId = context.messageId;
  // Use messageId para garantir que este processamento ocorra apenas uma vez
  await processWithIdempotency(messageId, payload);
});
```

## Uso (exemplos) 🔧

Publisher com opções (persistência / ttl):

```ts
import { createPublisher } from "@turborepo/messaging";

const publisher = createPublisher(rabbitSvc, {
  exchange: "events",
  routingKey: "user.created",
});

// publish (confirm is awaited and logged by the library)
await publisher.publish(
  { id: "123", name: "Alice" },
  { persistent: true, ttlMs: undefined }
);
```

Subscriber com retry/DLQ (exemplo):

```ts
import { createSubscriber } from "@turborepo/messaging";

const sub = createSubscriber(rabbitSvc, {
  exchange: "notifications",
  queue: "notifications.email.backend-worker-notification",
  routingKey: "notifications.email.#",
  retry: {
    baseName: "notifications.email",
    maxRetries: 3,
    retryDelayMs: 1000,
  },
});

await sub.subscribe(async (payload) => {
  // Se algo falhar, lance (throw) para que o Subscriber trate retry/DLQ
  // O Subscriber cuida de marcar a mensagem como __acknowledged quando
  // faz ack manual no fluxo de retry para evitar double-ack.
  await processNotification(payload);
});
```

## Como cadastrar Exchanges/Queues 🛠️

No `@turborepo/messaging`, o cadastro de exchanges e filas é feito de forma **declarativa e automática** através dos utilitários `createPublisher` e `createSubscriber`. O pacote garante que elas existam ao iniciar o serviço.

1.  **Exchanges**: São configuradas via `PublisherOptions` ou `SubscriberOptions`. Se a exchange não existir, o serviço a criará (padrão `topic`, `durable: true`).
2.  **Queues**: São declaradas no `createSubscriber`. Ao definir o nome da `queue`, o pacote realiza o `assertQueue` (padrão `durable: true`).
3.  **Binding**: Ao fornecer uma `routingKey` no `createSubscriber`, o pacote automaticamente vincula (`bind`) a fila à exchange especificada.

Exemplo de nova fila de integração:

```ts
const sub = createSubscriber(rabbitSvc, {
  exchange: "domain.events",
  queue: "my-service.order-processed.worker",
  routingKey: "order.status.completed",
  retry: {
    baseName: "my-service.order-processed",
    maxRetries: 5,
  },
});
```

## Melhores Práticas (RabbitMQ) 💡

- **Idempotência**: Mensagens podem ser entregues mais de uma vez (at-least-once delivery). Utilize o `messageId` (UUID v4) gerado automaticamente para garantir que o processamento seja único.
- **Mensagens Persistentes**: Garanta que mensagens críticas sobrevivam a reinícios do broker. O `Publisher` já define `persistent: true` por padrão.
- **Dead Letter Queues (DLQ)**: Sempre configure uma estratégia de `retry`. Mensagens que falham continuamente ("poison pills") devem ser movidas para filas de DLQ para análise posterior, não ficando presas na fila principal.
- **Prefetch Count**: Use o `RABBITMQ_PREFETCH` para balancear a carga entre réplicas. Para tarefas rápidas, use valores maiores; para tarefas pesadas, valores menores (ex: 1).
- **Naming Patterns**: Use padrões consistentes como `<serviço>.<finalidade>.<tipo_processamento>` para filas e `<domínio>.<tipo>` para exchanges.

## Dicas de Desenvolvimento e FAQ 🧠

### Diferença entre Exchange e Fila

- **Exchange (O Roteador)**: É o destino inicial de toda mensagem publicada. Ela recebe a mensagem do produtor e a encaminha para uma ou mais filas baseada em regras de roteamento (_Routing Keys_). No `@turborepo/messaging`, usamos por padrão o tipo `topic`.
- **Fila (O Armazenamento)**: É onde as mensagens ficam guardadas até serem consumidas. Um _Subscriber_ se conecta a uma fila, não à exchange diretamente.
- _Analogia_: A Exchange é o centro de triagem dos Correios; a Fila é a sua caixa de correspondência individual.

### Como tratar mensagens enviadas para DLQ?

Quando uma mensagem atinge o `maxRetries`, ela é movida para a fila nomeada com o sufixo `.dlq`.

1.  **Analise a Causa**: Verifique os logs do worker ou os headers da mensagem na DLQ para entender o erro.
2.  **Corrija o Código**: Se for um bug de lógica ou validação, faça o deploy da correção.
3.  **Reprocesse**: Você pode usar o plugin **Shovel** do RabbitMQ Management para mover as mensagens da `.dlq` de volta para a fila original (`queue`) ou para a exchange original.
4.  **Descarte**: Mensagens malformadas ou com payloads inválidos que não podem ser corrigidas devem ser removidas da DLQ após análise.

### Dicas de Uso do Pacote

- **Fluxo de Retry**: No callback do `subscribe`, sempre lance uma exceção (`throw`) se o processamento falhar. Isso sinaliza para o pacote aplicar a estratégia de retry configurada. Se você capturar o erro com `try/catch` e não relançar, o pacote assumirá que a mensagem foi processada com sucesso (ACK).
- **Evite Bloqueios**: Não realize operações extremamente longas ou síncronas dentro do `subscribe` sem considerar o timeout e o `prefetch`. Se o worker "travar", ele deixará de responder ao batimento cardíaco (_heartbeat_) do RabbitMQ e a conexão poderá ser encerrada.
- **Concorrência (`maxConcurrency`)**: Use a opção `maxConcurrency` no `createSubscriber` para limitar quantas mensagens são processadas em paralelo por instância. Deve igualar o valor de `RABBITMQ_PREFETCH` para que o broker nunca entregue mais mensagens do que o processo consegue tratar. Com N réplicas, a capacidade total é `maxConcurrency × N`. Internamente usa semáforo baseado em Promises com `try/finally` para garantir liberação do slot mesmo em caso de erro.
- **Naming Convention**: Prefira usar as constantes exportadas em `src/vars.ts` para garantir consistência entre quem publica e quem consome.

## Observabilidade e logs 🕵️‍♀️

Procure os seguintes logs para depurar o fluxo E2E:

- `RabbitMqService`: "Attempting to connect to RabbitMQ", "RabbitMQ connected and channel created"
- `RabbitMqService`: "Ensuring exchange ..." / "Ensuring queue ..."
- `RabbitMqService`: "Binding queue ... to exchange ... with routingKey=..."
- `Publisher`: "Publishing message to exchange=... routingKey=... size=... persistent=..."
- `RabbitMqService`: "Publishing to exchange=... routingKey=... size=..."
- `RabbitMqService`: "Publish confirmed exchange=... routingKey=..."
- `NotificationConsumerService` (ou similar): "Received notification payload: ..." / "Notification processed successfully" / "Failed to process notification: ..."

Também utilize a API HTTP do RabbitMQ (Management UI) para checar fila/exchange e consumidores:

- Ex.: `http://localhost:15672/api/queues/%2f/<queue_name>`
- `consumers` e `messages_ready` ajudam a identificar problemas de timing/consumer

## Boas práticas e notas de migração 🧭

- Evite ack manual e automático misturados: o Subscriber marca uma flag `__acknowledged` quando faz ack manual em caminhos de retry para prevenir `PRECONDITION-FAILED` causados por ack duplicado.
- Use `createSubscriber(..., { retry: { baseName, maxRetries, retryDelayMs }})` para configurar retry/DLQ com nomes padronizados de filas/exchanges (o helper cria `*.retry` e `*.dlq` automaticamente).
- Publique mensagens idempotentes ou inclua metadata de deduplicação para garantir reprocessamento seguro.

## Constantes exportadas 📦

Use as constantes exportadas para manter nomes padronizados entre produtores e consumidores:

- `NOTIFICATIONS_EXCHANGE` = `notifications`
- `NOTIFICATIONS_EMAIL_BASE` = `notifications.email`
- `ROUTING_KEY_EMAIL_WELCOME` = `notifications.email.welcome`
- `NOTIFICATIONS_EMAIL_QUEUE` = `notifications.email.backend-worker-notification`
- `DEFAULT_RETRY_MAX`, `DEFAULT_RETRY_DELAY_MS`

## Testes 🧪

- Os testes unitários do pacote estão em `src/test/unit` e cobrem comportamento de publish/subscribe, bind e retry/ack.
- Execute: `pnpm -C packages/messaging test`.

## Contribuições e PRs

Se você alterar comportamento de ACK/retry ou o naming padrão, atualize a documentação e adicione testes que cubram o novo fluxo.

---

Se quiser, posso abrir um PR com esta atualização e adicionar um exemplo de integração para validar o fluxo publish -> queue -> consumer no CI. Quer que eu faça isso? 🟢
