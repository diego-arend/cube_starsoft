import { Injectable } from "@nestjs/common";
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  AssistantConversationRepository,
  AssistantMessageRepository,
  AssistantConversationEntity,
} from "@turborepo/database";
import { RedisService } from "@turborepo/redis";
import { NestPinoLogger } from "@turborepo/logging";
import { v7 as uuidv7 } from "uuid";

@Injectable()
export class ConversationService {
  private readonly REDIS_HISTORY_PREFIX = "assistant:history:";
  private readonly MAX_HISTORY_MESSAGES = 10;

  constructor(
    private readonly conversationRepo: AssistantConversationRepository,
    private readonly messageRepo: AssistantMessageRepository,
    private readonly redisService: RedisService,
    private readonly logger: NestPinoLogger
  ) {}

  async getHistory(sessionId: string): Promise<BaseMessage[]> {
    const redisKey = `${this.REDIS_HISTORY_PREFIX}${sessionId}`;

    try {
      // 1. Try Redis first
      const cached = await this.redisService.lRange(redisKey, 0, -1);
      if (cached && cached.length > 0) {
        return cached.map((m) => this.deserializeMessage(m));
      }

      // 2. Fallback to DB
      const messages = await this.messageRepo.findBySessionId(
        sessionId,
        this.MAX_HISTORY_MESSAGES
      );

      // Map DB to LangChain messages (reverse because findBySessionId usually returns desc)
      const langChainMessages = messages.reverse().map((m) => {
        if (m.role === "user") return new HumanMessage(m.content);
        if (m.role === "assistant") {
          return new AIMessage({
            content: m.content,
            additional_kwargs: {
              id: m.id,
            },
          });
        }
        return new SystemMessage(m.content);
      });

      // 3. Populate Redis for next time
      if (langChainMessages.length > 0) {
        for (const msg of langChainMessages) {
          await this.redisService.rPush(redisKey, this.serializeMessage(msg));
        }
        await this.redisService.expire(redisKey, 3600); // 1 hour cache
      }

      return langChainMessages;
    } catch (error: unknown) {
      this.logger.error(
        `Error getting history for ${sessionId}:`,
        error instanceof Error ? error.stack : undefined,
        ConversationService.name
      );
      return [];
    }
  }

  async saveMessage(
    sessionId: string,
    userId: string,
    role: "user" | "assistant" | "system",
    content: string,
    agentId?: string | null
  ): Promise<void> {
    const redisKey = `${this.REDIS_HISTORY_PREFIX}${sessionId}`;

    try {
      // 1. Ensure conversation exists in DB
      let conversation = await this.conversationRepo.findBySessionId(sessionId);

      // Handle non-UUID userId (e.g. "system") for the DB column
      const dbUserId = userId && userId.length === 36 ? userId : null;

      if (!conversation) {
        const rawTitle = role === "user" ? content : "Nova conversa";
        const title =
          rawTitle.length > 80 ? rawTitle.substring(0, 77) + "..." : rawTitle;

        try {
          conversation = await this.conversationRepo.save({
            id: uuidv7(),
            sessionId,
            userId: dbUserId,
            agentId: agentId ?? null,
            title,
          });
        } catch (err: unknown) {
          // Outra réplica criou a conversa primeiro (race condition).
          // PostgreSQL retorna código 23505 para unique_violation.
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
            conversation =
              await this.conversationRepo.findBySessionId(sessionId);
          } else {
            throw err;
          }
        }
      }

      if (!conversation) {
        throw new Error("Could not create/find conversation");
      }

      // 2. Save to DB (Persistent)
      await this.messageRepo.save({
        id: uuidv7(),
        conversationId: conversation.id,
        role,
        content,
      });

      // Bump conversation updatedAt for accurate history sorting
      await this.conversationRepo.save(conversation);

      // 3. Save to Redis (Cache)
      const msg =
        role === "user"
          ? new HumanMessage(content)
          : role === "assistant"
            ? new AIMessage(content)
            : new SystemMessage(content);
      await this.redisService.rPush(redisKey, this.serializeMessage(msg));
      await this.redisService.lTrim(redisKey, -this.MAX_HISTORY_MESSAGES, -1);
      await this.redisService.expire(redisKey, 3600);
    } catch (error: unknown) {
      this.logger.error(
        `Error saving message for ${sessionId}:`,
        error instanceof Error ? error.stack : undefined,
        ConversationService.name
      );
    }
  }

  async getConversationsByAgent(
    userId: string,
    agentId?: string | null
  ): Promise<AssistantConversationEntity[]> {
    return this.conversationRepo.findByUserAndAgent(userId, agentId);
  }

  async deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<void> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) return;
    if (conversation.userId !== userId) {
      throw new Error("Unauthorized");
    }
    const redisKey = `${this.REDIS_HISTORY_PREFIX}${conversation.sessionId}`;
    await this.redisService.del(redisKey);
    await this.conversationRepo.deleteById(conversationId);
  }

  async clearSessionCache(sessionId: string): Promise<void> {
    const redisKey = `${this.REDIS_HISTORY_PREFIX}${sessionId}`;
    await this.redisService.del(redisKey);
    this.logger.log(
      `Session cache invalidated for: ${sessionId}`,
      ConversationService.name
    );
  }

  private serializeMessage(message: BaseMessage): string {
    return JSON.stringify({
      type: message._getType(),
      content: message.content,
      metadata: message.additional_kwargs,
    });
  }

  private deserializeMessage(serialized: string): BaseMessage {
    const parsed = JSON.parse(serialized) as {
      type: string;
      content: string;
      metadata?: any;
    };
    if (parsed.type === "human") return new HumanMessage(parsed.content);
    if (parsed.type === "ai") {
      return new AIMessage({
        content: parsed.content,
        additional_kwargs: parsed.metadata || {},
      });
    }
    return new SystemMessage(parsed.content);
  }
}
