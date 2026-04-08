import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  RabbitMqService,
  createSubscriber,
  Publisher,
} from "@turborepo/messaging";
import {
  ASSISTANT_EXCHANGE,
  ASSISTANT_QUERY_BASE,
  ASSISTANT_QUERY_QUEUE,
  ASSISTANT_RESPONSE_BASE,
} from "@turborepo/messaging";
import { AssistantService } from "@turborepo/assistant";
import { AssistantQueryMessageSchema } from "@turborepo/assistant";
import { NestPinoLogger } from "@turborepo/logging";

@Injectable()
export class AssistantQueryConsumer implements OnModuleInit {
  constructor(
    private readonly rabbitSvc: RabbitMqService,
    private readonly assistantService: AssistantService,
    private readonly logger: NestPinoLogger
  ) {}

  async onModuleInit(): Promise<void> {
    const publisher = new Publisher(this.rabbitSvc, {
      exchange: ASSISTANT_EXCHANGE,
    });

    const sub = createSubscriber(this.rabbitSvc, {
      exchange: ASSISTANT_EXCHANGE,
      queue: ASSISTANT_QUERY_QUEUE,
      routingKey: ASSISTANT_QUERY_BASE,
      // Process up to 10 queries concurrently per replica, matching RABBITMQ_PREFETCH.
      // In production: total throughput = 10 × worker replica count.
      maxConcurrency: 10, // semaphore active
      retry: {
        baseName: ASSISTANT_QUERY_BASE,
        maxRetries: 3,
        retryDelayMs: 5000,
      },
    });

    await sub.subscribe(async (payload: unknown) => {
      const parsed = AssistantQueryMessageSchema.safeParse(payload);
      if (!parsed.success) {
        this.logger.warn(
          `Invalid assistant query message: ${JSON.stringify(parsed.error.issues)}`,
          AssistantQueryConsumer.name
        );
        return;
      }
      const { sessionId, userId, messageId, query, agentId } = parsed.data;

      try {
        for await (const chunk of this.assistantService.streamQuery(
          { query, agentId },
          sessionId,
          userId
        )) {
          await publisher.publish(
            { sessionId, messageId, chunk, done: false },
            `${ASSISTANT_RESPONSE_BASE}.${sessionId}`
          );
        }
        // Sinaliza fim do stream
        await publisher.publish(
          { sessionId, messageId, chunk: "", done: true },
          `${ASSISTANT_RESPONSE_BASE}.${sessionId}`
        );
      } catch (err) {
        this.logger.error(
          `Error processing assistant query for session ${sessionId}: ${String(err)}`,
          err instanceof Error ? err.stack : undefined,
          AssistantQueryConsumer.name
        );
        // Publica evento de erro antes de relançar para acionar retry/DLQ
        await publisher.publish(
          {
            sessionId,
            messageId,
            chunk: "",
            done: true,
            error: "Erro ao processar solicitação.",
          },
          `${ASSISTANT_RESPONSE_BASE}.${sessionId}`
        );
        throw err;
      }
    });
  }
}
