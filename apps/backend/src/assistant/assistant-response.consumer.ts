import { Injectable, OnModuleInit } from "@nestjs/common";
import { RabbitMqService, createSubscriber } from "@turborepo/messaging";
import {
  ASSISTANT_EXCHANGE,
  ASSISTANT_RESPONSE_BASE,
  ASSISTANT_RESPONSE_QUEUE_PREFIX,
} from "@turborepo/messaging";
import { AssistantResponseChunkSchema } from "@turborepo/assistant";
import { NestPinoLogger } from "@turborepo/logging";
import { v4 as uuidv4 } from "uuid";
import { AssistantGateway } from "./assistant.gateway";

@Injectable()
export class AssistantResponseConsumer implements OnModuleInit {
  constructor(
    private readonly rabbitSvc: RabbitMqService,
    private readonly gateway: AssistantGateway,
    private readonly logger: NestPinoLogger
  ) {}

  async onModuleInit(): Promise<void> {
    const hostname = process.env["HOSTNAME"] ?? uuidv4();
    const queue = `${ASSISTANT_RESPONSE_QUEUE_PREFIX}.${hostname}`;

    const sub = createSubscriber(this.rabbitSvc, {
      exchange: ASSISTANT_EXCHANGE,
      queue,
      routingKey: `${ASSISTANT_RESPONSE_BASE}.#`,
      // Sem retry: chunks sem socket destino são descartados silenciosamente
    });

    await sub.subscribe((payload: unknown) => {
      const parsed = AssistantResponseChunkSchema.safeParse(payload);
      if (!parsed.success) {
        this.logger.warn(
          `Invalid assistant response chunk: ${JSON.stringify(parsed.error.issues)}`,
          AssistantResponseConsumer.name
        );
        return;
      }
      const { sessionId, messageId, chunk, done, error } = parsed.data;

      // Access gateway.server lazily — populated by @WebSocketServer() after
      // onApplicationBootstrap, so must be read at emit-time, not init-time.
      const server = this.gateway.server;
      if (!server) {
        this.logger.warn(
          `WebSocket server not yet available, dropping chunk for session ${sessionId}`,
          AssistantResponseConsumer.name
        );
        return;
      }

      const room = server.to(String(sessionId));

      if (error) {
        room.emit("assistant:error", { messageId, error });
      } else if (done) {
        room.emit("assistant:done", { messageId });
      } else {
        room.emit("assistant:chunk", { messageId, chunk });
      }
    });
  }
}
