import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseInterceptors,
  Logger,
  UseGuards,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { RedisService } from "@turborepo/redis";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserPublicSchema,
  OffsetPaginationSchema,
  UserRole,
} from "@turborepo/database";
import type {
  CreateUserDto,
  UpdateUserDto,
  OffsetPaginationDto,
  PaginatedResult,
  UserPublicDto,
} from "@turborepo/database";
import { ZodValidationPipe } from "../shared/pipes/zod-validation.pipe";
import { ZodSerializerInterceptor } from "../shared/interceptors/zod-serializer.interceptor";
import { Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import Roles from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("users")
@ApiTags("users")
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userSvc: UserService,
    private readonly redis: RedisService
  ) {}

  private async invalidateUserCache() {
    try {
      await this.redis.invalidate("users:list*");
    } catch (e) {
      this.logger.error(
        "Failed to invalidate cache",
        e instanceof Error ? (e.stack as string) : String(e)
      );
    }
  }

  @Post("/")
  @ApiOperation({ summary: "Create user" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateUser" } })
  @ApiResponse({
    status: 201,
    schema: { $ref: "#/components/schemas/UserPublic" },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (validation failure)",
    schema: { $ref: "#/components/schemas/ErrorBadRequest" },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    schema: { $ref: "#/components/schemas/ErrorUnauthorized" },
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden (requires ADMIN role)",
    schema: { $ref: "#/components/schemas/ErrorForbidden" },
  })
  @ApiResponse({
    status: 409,
    description: "Conflict (email already in use)",
    schema: { $ref: "#/components/schemas/ErrorConflict" },
  })
  @UseInterceptors(new ZodSerializerInterceptor(UserPublicSchema))
  async create(
    @Body(new ZodValidationPipe(CreateUserSchema as any))
    body: CreateUserDto
  ) {
    const user = await this.userSvc.create(body);
    await this.invalidateUserCache();
    return user;
  }

  @Get("/")
  @ApiOperation({ summary: "List users (paginated)" })
  @ApiResponse({
    status: 200,
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/UserPublic" },
        },
        meta: { $ref: "#/components/schemas/PaginationMeta" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    schema: { $ref: "#/components/schemas/ErrorUnauthorized" },
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden (requires ADMIN role)",
    schema: { $ref: "#/components/schemas/ErrorForbidden" },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    schema: { $ref: "#/components/schemas/ErrorUnauthorized" },
  })
  async findAll(
    @Query(new ZodValidationPipe(OffsetPaginationSchema as any))
    query: OffsetPaginationDto
  ) {
    const cacheKey = `users:list?page=${query.page}&limit=${query.limit}&q=${query.q || ""}&sort=${query.sort || ""}&order=${query.order || ""}`;
    const cached =
      this.redis && typeof this.redis.get === "function"
        ? await this.redis.get(cacheKey)
        : null;
    if (cached) {
      return JSON.parse(cached) as PaginatedResult<UserPublicDto>;
    }

    const users = await this.userSvc.findAll(query);
    if (this.redis && typeof this.redis.set === "function") {
      await this.redis.set(cacheKey, JSON.stringify(users), 60);
    }
    return users;
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiResponse({
    status: 200,
    schema: { $ref: "#/components/schemas/UserPublic" },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    schema: { $ref: "#/components/schemas/ErrorUnauthorized" },
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden (requires ADMIN role)",
    schema: { $ref: "#/components/schemas/ErrorForbidden" },
  })
  @ApiResponse({
    status: 404,
    description: "Not found",
    schema: { $ref: "#/components/schemas/ErrorNotFound" },
  })
  @UseInterceptors(new ZodSerializerInterceptor(UserPublicSchema))
  async findOne(@Param("id") id: string) {
    return await this.userSvc.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update user" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateUser" } })
  @ApiResponse({
    status: 200,
    schema: { $ref: "#/components/schemas/UserPublic" },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
    schema: { $ref: "#/components/schemas/ErrorBadRequest" },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    schema: { $ref: "#/components/schemas/ErrorUnauthorized" },
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden (requires ADMIN role)",
    schema: { $ref: "#/components/schemas/ErrorForbidden" },
  })
  @ApiResponse({
    status: 404,
    description: "Not found",
    schema: { $ref: "#/components/schemas/ErrorNotFound" },
  })
  @UseInterceptors(new ZodSerializerInterceptor(UserPublicSchema))
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema as any))
    body: UpdateUserDto
  ) {
    const user = await this.userSvc.update(id, body);
    await this.invalidateUserCache();
    return user;
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete user" })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    schema: { $ref: "#/components/schemas/ErrorUnauthorized" },
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden (requires ADMIN role)",
    schema: { $ref: "#/components/schemas/ErrorForbidden" },
  })
  @ApiResponse({
    status: 404,
    description: "Not found",
    schema: { $ref: "#/components/schemas/ErrorNotFound" },
  })
  async remove(@Param("id") id: string) {
    await this.userSvc.remove(id);
    await this.invalidateUserCache();
    return { success: true };
  }
}
