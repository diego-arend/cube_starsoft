import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from "@nestjs/common";
import { AgentService } from "./agent.service";
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  OffsetPaginationSchema,
  UserRole,
  AgentEntity,
  PaginatedResult,
} from "@turborepo/database";
import type {
  CreateAgentDto,
  UpdateAgentDto,
  OffsetPaginationDto,
} from "@turborepo/database";
import { ZodValidationPipe } from "../shared/pipes/zod-validation.pipe";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import Roles from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";

@ApiTags("agents")
@ApiBearerAuth()
@Controller("agents")
@UseGuards(RolesGuard)
export class AgentController {
  constructor(private readonly agentSvc: AgentService) {}

  @Post("/")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Create agent" })
  async create(
    @Body(new ZodValidationPipe(CreateAgentSchema as any)) body: CreateAgentDto
  ): Promise<AgentEntity> {
    return await this.agentSvc.create(body);
  }

  @Get("/")
  @ApiOperation({ summary: "List agents (paginated)" })
  async findAll(
    @Query(new ZodValidationPipe(OffsetPaginationSchema as any))
    query: OffsetPaginationDto
  ): Promise<PaginatedResult<AgentEntity>> {
    return await this.agentSvc.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get agent by ID" })
  async findOne(@Param("id") id: string): Promise<AgentEntity> {
    return await this.agentSvc.findOne(id);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update agent" })
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateAgentSchema as any)) body: UpdateAgentDto
  ): Promise<AgentEntity> {
    return await this.agentSvc.update(id, body);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Delete agent" })
  async remove(@Param("id") id: string) {
    await this.agentSvc.remove(id);
    return { success: true };
  }
}
