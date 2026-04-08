import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AssistantMessageEntity } from "../entities/assistant-message.entity";
import { BaseRepository } from "./base.repository";

export const ASSISTANT_MESSAGE_REPOSITORY = Symbol(
  "ASSISTANT_MESSAGE_REPOSITORY"
);

export interface IAssistantMessageRepository {
  findByConversationId(
    conversationId: string,
    limit?: number
  ): Promise<AssistantMessageEntity[]>;
  findBySessionId(
    sessionId: string,
    limit?: number
  ): Promise<AssistantMessageEntity[]>;
  findLastBySessionId(
    sessionId: string
  ): Promise<AssistantMessageEntity | null>;
  findByIdWithConversation(id: string): Promise<AssistantMessageEntity | null>;
  findOneById(id: string): Promise<AssistantMessageEntity | null>;
  save(
    entity: Partial<AssistantMessageEntity>
  ): Promise<AssistantMessageEntity>;
}

export class AssistantMessageRepository
  extends BaseRepository<AssistantMessageEntity>
  implements IAssistantMessageRepository
{
  constructor(
    @InjectRepository(AssistantMessageEntity)
    repo: Repository<AssistantMessageEntity>
  ) {
    super(repo);
  }

  async findByIdWithConversation(
    id: string
  ): Promise<AssistantMessageEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ["conversation"],
    });
  }

  async findLastBySessionId(
    sessionId: string
  ): Promise<AssistantMessageEntity | null> {
    const items = await this.repo.find({
      where: { conversation: { sessionId } },
      order: { createdAt: "DESC" },
      take: 1,
    });
    return items[0] || null;
  }

  async findByConversationId(
    conversationId: string,
    limit = 20
  ): Promise<AssistantMessageEntity[]> {
    return this.repo.find({
      where: { conversationId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async findBySessionId(
    sessionId: string,
    limit = 20
  ): Promise<AssistantMessageEntity[]> {
    return this.repo.find({
      where: { conversation: { sessionId } },
      order: { createdAt: "DESC" },
      take: limit,
      relations: ["conversation"],
    });
  }
}
