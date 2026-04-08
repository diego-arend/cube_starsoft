import { Provider } from "@nestjs/common";
import { Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AgentEntity } from "../entities/agent.entity";
import { BaseRepository } from "./base.repository";
import {
  PaginatedResult,
  OffsetPaginationDto,
  PaginationOptions,
} from "../pagination";

export const AGENT_REPOSITORY = Symbol("AGENT_REPOSITORY");

export interface IAgentRepository {
  findPaginatedList(
    query: OffsetPaginationDto
  ): Promise<PaginatedResult<AgentEntity>>;
  findById(id: string): Promise<AgentEntity | null>;
  findByName(name: string): Promise<AgentEntity | null>;
  createAgent(data: Partial<AgentEntity>): Promise<AgentEntity>;
  updateAgent(id: string, data: Partial<AgentEntity>): Promise<AgentEntity>;
  removeById(id: string): Promise<void>;
}

export class AgentRepository
  extends BaseRepository<AgentEntity>
  implements IAgentRepository
{
  constructor(repo: Repository<AgentEntity>) {
    super(repo);
  }

  async findPaginatedList(
    query: OffsetPaginationDto
  ): Promise<PaginatedResult<AgentEntity>> {
    const where: any = {};

    // Se onlyActive for explicitamente true, filtramos.
    // Usamos Record<string, any> para suportar query params dinâmicos não tipados no DTO base
    const customQuery = query as any;
    if (customQuery.onlyActive === true || customQuery.onlyActive === "true") {
      where.isActive = true;
    }

    const options: PaginationOptions = {
      ...query,
      where: Object.keys(where).length > 0 ? where : (query as any).where,
      order: query.sort ? { [query.sort]: query.order || "ASC" } : undefined,
    };
    return this.findPaginated(options);
  }

  async findById(id: string): Promise<AgentEntity | null> {
    return this.findOneById(id);
  }

  async findByName(name: string): Promise<AgentEntity | null> {
    return this.repo.findOne({ where: { name } as any });
  }

  async createAgent(data: Partial<AgentEntity>): Promise<AgentEntity> {
    const agent = this.repo.create(data);
    return this.repo.save(agent);
  }

  async updateAgent(
    id: string,
    data: Partial<AgentEntity>
  ): Promise<AgentEntity> {
    await this.repo.update(id, data);
    const updated = await this.findById(id);
    if (!updated) throw new Error("Agent not found after update");
    return updated;
  }

  async removeById(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}

export const AgentRepositoryProvider: Provider = {
  provide: AGENT_REPOSITORY,
  useFactory: (repo: Repository<AgentEntity>) => new AgentRepository(repo),
  inject: [getRepositoryToken(AgentEntity)],
};
