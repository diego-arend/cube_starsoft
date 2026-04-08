import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from "@nestjs/websockets";
import { Socket, Namespace } from "socket.io";
import { Publisher, RabbitMqService } from "@turborepo/messaging";
import { ASSISTANT_EXCHANGE, ASSISTANT_QUERY_BASE } from "@turborepo/messaging";
import { AssistantQuerySchema } from "@turborepo/assistant";
import { NestPinoLogger } from "@turborepo/logging";
import jwt from "jsonwebtoken";
import { typedEnv } from "../env";
import { trace, SpanStatusCode } from "@opentelemetry/api";

@WebSocketGateway({
  cors: {
    origin: "*",
    credentials: true,
  },
  namespace: "assistant",
  // websocket-only: eliminates HTTP long-polling, which could fan out
  // across replicas before the upgrade. The Redis adapter handles cross-replica
  // pub/sub for all socket events. No sticky sessions or polling needed.
  transports: ["websocket"],
})
export class AssistantGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Namespace;

  private publisher: Publisher;

  constructor(
    private readonly rabbitSvc: RabbitMqService,
    private readonly logger: NestPinoLogger
  ) {
    this.publisher = new Publisher(this.rabbitSvc, {
      exchange: ASSISTANT_EXCHANGE,
    });
  }

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      client.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      this.logger.warn(
        `Client ${client.id} tried to connect without token`,
        AssistantGateway.name
      );
      client.disconnect();
      return;
    }

    try {
      const secret = typedEnv.JWT_SECRET || process.env.JWT_SECRET;
      const decoded = jwt.verify(token, secret as jwt.Secret, {
        issuer: typedEnv.JWT_ISSUER || process.env.JWT_ISSUER,
        audience: typedEnv.JWT_AUDIENCE || process.env.JWT_AUDIENCE,
      }) as { sub: string };

      client.data.userId = decoded.sub;

      this.logger.log(
        `Client connected: ${client.id} (User: ${decoded.sub})`,
        AssistantGateway.name
      );
    } catch (err) {
      this.logger.error(
        `Invalid token for client ${client.id}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
        AssistantGateway.name
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`, AssistantGateway.name);
  }

  @SubscribeMessage("assistant:query")
  async handleQuery(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown
  ) {
    return await trace
      .getTracer("assistant-gateway")
      .startActiveSpan("assistant.handleQuery", async (span) => {
        try {
          const parsed = AssistantQuerySchema.safeParse(data);
          if (!parsed.success) {
            client.emit("assistant:error", { error: "Payload inválido" });
            return;
          }

          const payload = parsed.data;
          const activeSessionId = payload.conversationId ?? payload.sessionId;
          const userId = (client.data as { userId: string }).userId;

          this.logger.log(
            `Query received: session=${activeSessionId}, messageId=${payload.messageId}, agentId=${payload.agentId ?? "none"}`,
            AssistantGateway.name
          );

          // Garante que o socket receba os chunks via room (Redis adapter cross-réplica)
          await client.join(activeSessionId);

          await this.publisher.publish(
            {
              sessionId: activeSessionId,
              userId,
              messageId: payload.messageId,
              conversationId: payload.conversationId,
              query: payload.query,
              agentId: payload.agentId,
            },
            ASSISTANT_QUERY_BASE,
            { messageId: payload.messageId }
          );

          client.emit("assistant:queued", { messageId: payload.messageId });
        } catch (err) {
          const rawMessage =
            err instanceof Error ? err.message : "Internal error";

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: rawMessage,
          });
          if (err instanceof Error) span.recordException(err);

          this.logger.error(
            `Error processing query: ${rawMessage}`,
            err instanceof Error ? err.stack : undefined,
            AssistantGateway.name
          );

          client.emit("assistant:error", {
            sessionId: (data as Record<string, unknown>)?.sessionId,
            messageId: (data as Record<string, unknown>)?.messageId,
            error:
              "Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.",
          });
        } finally {
          span.end();
        }
      });
  }
}
