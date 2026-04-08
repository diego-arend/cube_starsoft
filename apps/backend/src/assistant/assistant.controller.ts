import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  Delete,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { ConversationService } from "@turborepo/assistant";
import { AssistantQuerySchema } from "@turborepo/assistant";
import { Publisher, RabbitMqService } from "@turborepo/messaging";
import { ASSISTANT_EXCHANGE, ASSISTANT_QUERY_BASE } from "@turborepo/messaging";
import { NestPinoLogger } from "@turborepo/logging";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@ApiTags("assistant")
@ApiBearerAuth()
@Controller("assistant")
export class AssistantController {
  private readonly publisher: Publisher;

  constructor(
    private readonly conversationService: ConversationService,
    private readonly rabbitSvc: RabbitMqService,
    private readonly logger: NestPinoLogger
  ) {
    this.publisher = new Publisher(this.rabbitSvc, {
      exchange: ASSISTANT_EXCHANGE,
    });
  }

  @Get("conversations")
  @ApiOperation({
    summary:
      "List conversations for the current user, optionally filtered by agent",
  })
  async getConversations(
    @Req() req: AuthenticatedRequest,
    @Query("agentId") agentId?: string
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const conversations =
      await this.conversationService.getConversationsByAgent(userId, agentId);
    return conversations.map((c) => ({
      id: c.id,
      sessionId: c.sessionId,
      title: c.title || "Nova conversa",
      updatedAt: c.updatedAt,
      agentId: c.agentId,
    }));
  }

  @Delete("conversations/:id")
  @ApiOperation({ summary: "Delete a conversation by ID" })
  async deleteConversation(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    await this.conversationService.deleteConversation(id, userId);
    return { success: true };
  }

  @Get("history/:sessionId")
  @ApiOperation({ summary: "Get conversation history for a session" })
  async getHistory(@Param("sessionId") sessionId: string) {
    const history = await this.conversationService.getHistory(sessionId);
    return history.map((msg) => ({
      id: msg.additional_kwargs?.id,
      role: msg._getType() === "human" ? "user" : "assistant",
      content: msg.content,
    }));
  }

  @Post("query")
  @ApiOperation({ summary: "Enqueue an assistant query (async)" })
  @ApiResponse({ status: 202, description: "Query enqueued" })
  async query(@Req() req: AuthenticatedRequest, @Body() data: unknown) {
    const payload = AssistantQuerySchema.parse(data);
    const userId = req.user?.id || "system";
    const activeSessionId = payload.conversationId ?? payload.sessionId;

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

    return {
      sessionId: activeSessionId,
      messageId: payload.messageId,
      queued: true,
    };
  }

  @Post("clear-cache/:sessionId")
  @ApiOperation({ summary: "Clear the session cache for the assistant" })
  async clearCache(@Param("sessionId") sessionId: string) {
    await this.conversationService.clearSessionCache(sessionId);
    return { success: true };
  }
}
