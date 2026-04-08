import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import {
  AGENT_REPOSITORY,
  AgentEntity,
  PaginatedResult,
} from "@turborepo/database";
import type {
  IAgentRepository,
  CreateAgentDto,
  UpdateAgentDto,
  OffsetPaginationDto,
} from "@turborepo/database";

@Injectable()
export class AgentService {
  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepo: IAgentRepository
  ) {}

  async create(data: CreateAgentDto): Promise<AgentEntity> {
    return await this.agentRepo.createAgent(data);
  }

  async findAll(
    query: OffsetPaginationDto
  ): Promise<PaginatedResult<AgentEntity>> {
    return await this.agentRepo.findPaginatedList(query);
  }

  async findOne(id: string): Promise<AgentEntity> {
    const agent = await this.agentRepo.findById(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return agent;
  }

  async update(id: string, data: UpdateAgentDto): Promise<AgentEntity> {
    await this.findOne(id);
    return await this.agentRepo.updateAgent(id, data);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.agentRepo.removeById(id);
  }
}
