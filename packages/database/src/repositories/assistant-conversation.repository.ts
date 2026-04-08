import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AssistantConversationEntity } from "../entities/assistant-conversation.entity";
import { BaseRepository } from "./base.repository";

export const ASSISTANT_CONVERSATION_REPOSITORY = Symbol(
  "ASSISTANT_CONVERSATION_REPOSITORY"
);

export interface IAssistantConversationRepository {
  findBySessionId(
    sessionId: string
  ): Promise<AssistantConversationEntity | null>;
  findById(id: string): Promise<AssistantConversationEntity | null>;
  findByUserAndAgent(
    userId: string,
    agentId?: string | null
  ): Promise<AssistantConversationEntity[]>;
  save(
    entity: Partial<AssistantConversationEntity>
  ): Promise<AssistantConversationEntity>;
  deleteById(id: string): Promise<void>;
}

export class AssistantConversationRepository
  extends BaseRepository<AssistantConversationEntity>
  implements IAssistantConversationRepository
{
  constructor(
    @InjectRepository(AssistantConversationEntity)
    repo: Repository<AssistantConversationEntity>
  ) {
    super(repo);
  }

  async findBySessionId(
    sessionId: string
  ): Promise<AssistantConversationEntity | null> {
    return this.repo.findOne({ where: { sessionId } });
  }

  async findById(id: string): Promise<AssistantConversationEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByUserAndAgent(
    userId: string,
    agentId?: string | null
  ): Promise<AssistantConversationEntity[]> {
    return this.repo.find({
      where: agentId ? { userId, agentId } : { userId },
      order: { updatedAt: "DESC" },
      take: 50,
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
