# /be-worker-consumer

Scaffolda um novo consumer RabbitMQ seguindo o padrão de `apps/backend-worker-notification`.

## Uso
```
/be-worker-consumer <nome> <exchange> <queue> [routing-key]
```

- `<nome>` — nome do domínio do consumer (ex: `payment`, `report`, `audit`)
- `<exchange>` — nome do exchange RabbitMQ (ex: `payments`, `reports`)
- `<queue>` — nome da fila (ex: `payments.process`, `reports.generate`)
- `[routing-key]` — padrão de routing key opcional (ex: `payments.*`, `reports.pdf`)

**Exemplos:**
- `/be-worker-consumer payment payments payments.process payments.*`
- `/be-worker-consumer report reports reports.generate reports.#`
- `/be-worker-consumer audit audit-events audit.log`

---

## Decisão: novo worker ou novo consumer no worker existente?

Antes de gerar, pergunte ao usuário:

> "O consumer deve ser criado dentro do worker existente (`apps/backend-worker-notification`) ou em um novo app worker separado?"

- **Dentro do worker existente** → cria apenas os arquivos de consumer e atualiza o `app.module.ts` do worker
- **Novo worker separado** → cria toda a estrutura de app (ver seção abaixo)

---

## Opção A: Consumer no worker existente

### 1. Leia os arquivos de referência

- `apps/backend-worker-notification/src/app.module.ts`
- `apps/backend-worker-notification/src/notifications/notification.module.ts`
- `apps/backend-worker-notification/src/notifications/notification.consumer.service.ts`
- `apps/backend-worker-notification/src/notifications/notification.processor.service.ts`

### 2. Crie os arquivos em `apps/backend-worker-notification/src/<nome>/`

#### `<nome>.module.ts`

```typescript
import { DynamicModule, Module } from '@nestjs/common';
import { <Nome>ConsumerService } from './<nome>.consumer.service';
import { <Nome>ProcessorService } from './<nome>.processor.service';
import type { Env } from '../env';

@Module({})
export class <Nome>Module {
  static forRoot(env: Env): DynamicModule {
    return {
      module: <Nome>Module,
      providers: [
        <Nome>ProcessorService,
        {
          provide: <Nome>ConsumerService,
          useFactory: (processor: <Nome>ProcessorService) =>
            new <Nome>ConsumerService(env, processor),
          inject: [<Nome>ProcessorService],
        },
      ],
      exports: [<Nome>ConsumerService],
    };
  }
}
```

#### `<nome>.consumer.service.ts`

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createSubscriber } from '@turborepo/messaging';
import { metrics } from '@opentelemetry/api';
import type { Env } from '../env';
import { <Nome>ProcessorService } from './<nome>.processor.service';

const EXCHANGE = '<exchange>';
const QUEUE = '<queue>';
const ROUTING_KEY = '<routing-key>';

@Injectable()
export class <Nome>ConsumerService implements OnModuleInit {
  private readonly logger = new Logger(<Nome>ConsumerService.name);
  private readonly jobCounter = metrics
    .getMeter('<nome>-worker')
    .createCounter('<nome>.jobs', {
      description: 'Contador de jobs processados pelo <nome> consumer',
    });

  constructor(
    private readonly env: Env,
    private readonly processor: <Nome>ProcessorService,
  ) {}

  async onModuleInit() {
    this.logger.log('Inicializando consumer...');
    await this.startConsuming();
  }

  private async startConsuming() {
    const subscriber = await createSubscriber({
      url: this.env.RABBITMQ_URL,
      exchange: EXCHANGE,
      queue: QUEUE,
      routingKey: ROUTING_KEY,
      prefetch: 5,
      retryDelay: 5000,
      maxRetries: 3,
    });

    await subscriber.consume(async (message) => {
      const jobAttributes = { exchange: EXCHANGE, queue: QUEUE };

      try {
        this.logger.log(`Processando mensagem: ${JSON.stringify(message)}`);
        await this.processor.process(message);
        this.jobCounter.add(1, { ...jobAttributes, status: 'success' });
        this.logger.log('Mensagem processada com sucesso');
      } catch (error) {
        this.jobCounter.add(1, { ...jobAttributes, status: 'error' });
        this.logger.error('Erro ao processar mensagem', error);
        throw error; // rejeita para acionar retry/DLQ
      }
    });

    this.logger.log(`Consumer iniciado — exchange: ${EXCHANGE}, queue: ${QUEUE}`);
  }
}
```

#### `<nome>.processor.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';

// Defina o tipo da mensagem esperada
interface <Nome>Message {
  // campos da mensagem RabbitMQ
  id: string;
  // ...
}

@Injectable()
export class <Nome>ProcessorService {
  private readonly logger = new Logger(<Nome>ProcessorService.name);

  async process(message: <Nome>Message): Promise<void> {
    this.logger.log(`Processando <nome>: ${message.id}`);
    // lógica de processamento aqui
  }
}
```

### 3. Registre no `app.module.ts` do worker

```typescript
import { <Nome>Module } from './<nome>/<nome>.module';

@Module({
  imports: [
    // ... módulos existentes
    <Nome>Module.forRoot(env),
  ],
})
export class AppModule implements OnApplicationBootstrap {
  // verificar conexão com nova dependência se necessário
}
```

---

## Opção B: Novo app worker separado

### 1. Crie a estrutura completa em `apps/worker-<nome>/`

Modele exatamente sobre `apps/backend-worker-notification/`. Crie:

```
apps/worker-<nome>/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── env.ts
│   ├── instrumentation.ts
│   └── <nome>/
│       ├── <nome>.module.ts
│       ├── <nome>.consumer.service.ts
│       └── <nome>.processor.service.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

#### `main.ts` (sem servidor HTTP)

```typescript
import './instrumentation';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestPinoLogger } from '@turborepo/logging';
import { loadEnv } from '@turborepo/config/load';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    bufferLogs: true,
  });

  app.useLogger(app.get(NestPinoLogger));

  const logger = app.get(NestPinoLogger);

  process.on('SIGINT', async () => {
    logger.log('Shutting down worker...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.log('Shutting down worker...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('Erro ao iniciar worker:', err);
  process.exit(1);
});
```

#### `app.module.ts`

```typescript
import { DynamicModule, Module, OnApplicationBootstrap } from '@nestjs/common';
import { LoggingModule } from '@turborepo/logging';
import { MessagingModule } from '@turborepo/messaging';
import { ObservabilityModule } from '@turborepo/observability';
import { <Nome>Module } from './<nome>/<nome>.module';
import type { Env } from './env';

@Module({})
export class AppModule implements OnApplicationBootstrap {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggingModule.forRoot(env),
        ObservabilityModule.forRoot(env),
        MessagingModule.forRoot(env),
        <Nome>Module.forRoot(env),
      ],
    };
  }

  async onApplicationBootstrap() {
    // verificar conexões críticas ao iniciar
  }
}
```

#### `package.json`

Copie de `apps/backend-worker-notification/package.json` e ajuste:
- `name`: `@turborepo/worker-<nome>`
- `description`: descrição do worker
- Mantenha as mesmas dependências de workspace

#### Adicione ao `pnpm-workspace.yaml` e ao `turbo.json`

Informe o usuário para adicionar `apps/worker-<nome>` no workspace.

---

## Após gerar

Informe o usuário:

1. **Arquivos criados** com caminhos completos
2. **Variáveis de ambiente necessárias** — o novo consumer precisa de `RABBITMQ_URL` (e outras dependências do processor, ex: SMTP se for email)
3. **Próximos passos:**
   - Implementar a lógica em `<nome>.processor.service.ts`
   - Definir a interface `<Nome>Message` com os campos corretos da mensagem
   - Publicar mensagens do backend com: `publisher.publish(EXCHANGE, ROUTING_KEY, payload)`
   - Gerar testes com `/be-test apps/.../`nome`.consumer.service.ts`
4. **Como publicar mensagens** a partir do backend principal:

```typescript
// No service do backend que dispara o evento:
await this.publisher.publish('<exchange>', '<routing-key>', {
  id: entity.id,
  // ... dados da mensagem
});
```

---

## Regras obrigatórias

- Consumer sempre implementa `OnModuleInit` — nunca `OnApplicationBootstrap` no consumer diretamente
- Sempre lançar o erro após logar no `catch` — para ativar o retry/DLQ do RabbitMQ
- Métrica OpenTelemetry obrigatória: contador com `status: 'success' | 'error'`
- `private readonly logger = new Logger(ClassName.name)` — nunca `console.log`
- Separação obrigatória entre consumer (infraestrutura) e processor (lógica de negócio)
- Variáveis de exchange/queue como constantes no topo do arquivo consumer — nunca strings inline
