import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  Inject,
  Optional,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import {
  USER_REPOSITORY,
  UserPublicSchema,
  OffsetPaginationSchema,
} from "@turborepo/database";
import type {
  IUserRepository,
  CreateUserDto,
  UpdateUserDto,
  UserPublicDto,
  OffsetPaginationDto,
  PaginatedResult,
} from "@turborepo/database";
import { createPublisher } from "@turborepo/messaging";
import {
  ROUTING_KEY_EMAIL_WELCOME,
  NOTIFICATIONS_EXCHANGE,
} from "@turborepo/messaging";
import { RabbitMqService } from "@turborepo/messaging";
import { EmailTemplateType } from "@turborepo/email";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Optional() private readonly rabbit?: RabbitMqService
  ) {}

  async create(data: CreateUserDto): Promise<UserPublicDto> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) throw new ConflictException("Email already in use");
    const hashed = data.password
      ? await bcrypt.hash(data.password, 10)
      : undefined;
    const saved = await this.userRepo.save({
      email: data.email,
      name: data.name,
      passwordHash: hashed,
      role: data.role,
    } as Partial<import("@turborepo/database").UserEntity>);

    // enqueue welcome email notification (fire-and-forget)
    try {
      if (this.rabbit) {
        const publisher = createPublisher(this.rabbit, {
          exchange: NOTIFICATIONS_EXCHANGE,
          routingKey: ROUTING_KEY_EMAIL_WELCOME,
          persistent: true,
        });
        const payload = {
          type: EmailTemplateType.WELCOME,
          to: saved.email,
          toName: saved.name ?? undefined,
          name: saved.name ?? saved.email,
        };
        // don't await to avoid blocking the request; still catch errors
        void publisher
          .publish(payload, ROUTING_KEY_EMAIL_WELCOME)
          .catch((e) =>
            this.logger.warn("Failed to enqueue welcome email: " + String(e))
          );
      }
    } catch (err) {
      this.logger.warn("Failed to publish welcome email", String(err));
    }

    return UserPublicSchema.parse(saved);
  }

  async findAll(
    opts?: OffsetPaginationDto
  ): Promise<PaginatedResult<UserPublicDto>> {
    try {
      // Validate and coerce paging values using the shared schema
      const parsed = OffsetPaginationSchema.parse(opts ?? {});

      // only allow specific sort fields to avoid SQL injection
      const allowed = new Set(["createdAt", "email", "id", "name"]);
      const order: Record<string, "ASC" | "DESC"> =
        parsed.sort && allowed.has(parsed.sort)
          ? { [parsed.sort]: parsed.order ?? "DESC" }
          : { createdAt: "DESC" };

      const res = await this.userRepo.findAllPaginated({
        page: parsed.page,
        limit: parsed.limit,
        order,
        q: parsed.q,
      });

      return res;
    } catch (err: unknown) {
      const message: string =
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "unknown error";
      this.logger.error("Failed to fetch or parse user records", message);
      throw new InternalServerErrorException("Failed to fetch user records");
    }
  }

  async findOne(id: string): Promise<UserPublicDto> {
    const user = await this.userRepo.findOneById(id);
    if (!user) throw new NotFoundException("User not found");
    return UserPublicSchema.parse(user);
  }

  /**
   * Update a user by id using the public `UpdateUserDto` (validated by the
   * controller). Note: `role` cannot be changed via this endpoint — it is
   * intentionally ignored to prevent privilege escalation.
   */
  async update(id: string, data: UpdateUserDto): Promise<UserPublicDto> {
    const user = await this.userRepo.findOneById(id);
    if (!user) throw new NotFoundException("User not found");
    // prepare partial update payload (uses `UpdateUserDto`)
    const partial: UpdateUserDto = {};

    if (data.email !== undefined) partial.email = data.email;
    if (data.name !== undefined) partial.name = data.name;
    // role cannot be changed via the public update endpoint; ignore any
    // provided role value to protect against privilege escalation.

    const updated = await this.userRepo.update(id, partial);
    return UserPublicSchema.parse(updated);
  }

  async remove(id: string): Promise<void> {
    const user = await this.userRepo.findOneById(id);
    if (!user) throw new NotFoundException("User not found");
    await this.userRepo.remove(user);
  }
}
