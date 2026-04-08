import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import { UserEntity } from "../entities/user.entity";
import type { UpdateUserDto, UserPublicDto } from "../dto/user.dto";
import { BaseRepository } from "./base.repository";
import type { PaginationOptions, PaginatedResult } from "../pagination";

/**
 * Runtime DI token used to inject a repository that implements `IUserRepository`.
 *
 * Prefer injecting this token when you want to depend on the repository _abstraction_
 * rather than the concrete implementation. This makes it easy to mock or replace
 * the repository in tests via `overrideProvider(USER_REPOSITORY)`.
 *
 * The `DatabaseModule.forFeature(...)` registers a provider for this token and also
 * registers the concrete `UserRepository` class as `useExisting` to ensure
 * backwards compatibility with modules that inject the class directly.
 */
export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findOneById(id: string): Promise<UserEntity | null>;
  save(entity: Partial<UserEntity>): Promise<UserEntity>;
  findAll(): Promise<UserPublicDto[]>;
  findAllPaginated(
    opts: PaginationOptions
  ): Promise<PaginatedResult<UserPublicDto>>;
  update(id: string, data: UpdateUserDto): Promise<UserEntity>;
  remove(entity: UserEntity): Promise<UserEntity>;
}

export class UserRepository
  extends BaseRepository<UserEntity, UserPublicDto>
  implements IUserRepository
{
  constructor(@InjectRepository(UserEntity) repo: Repository<UserEntity>) {
    super(repo);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    // cast to where clause
    const where = { email } as unknown as { email?: string };
    return this.repo.findOne({ where });
  }

  // CRUD helpers delegated to BaseRepository — re-declared here so IDEs and
  // callers can see the concrete method signatures on `UserRepository`.
  // Returns public DTOs (UserPublicDto[]) by parsing with Zod schema.
  async findAll(): Promise<UserPublicDto[]> {
    return super.findAll();
  }

  async findAllPaginated(
    opts: PaginationOptions
  ): Promise<PaginatedResult<UserPublicDto>> {
    if (opts.q) {
      const page = opts.page ?? 1;
      const limit = opts.limit ?? 20;
      const take = Math.min(Math.max(1, Number(limit)), 100);
      const skip = (page - 1) * take;
      const search = `%${opts.q}%`;

      const [rows, total] = await this.repo.findAndCount({
        where: [{ name: ILike(search) }, { email: ILike(search) }],
        take,
        skip,
        order: opts.order as any,
      });

      const pages = Math.max(1, Math.ceil(total / take));

      return {
        data: rows as unknown as UserPublicDto[],
        meta: {
          total,
          page,
          limit: take,
          pages,
        },
      };
    }
    return super.findPaginated(opts);
  }

  async findOneById(id: string): Promise<UserEntity | null> {
    return super.findOneById(id);
  }

  async save(entity: Partial<UserEntity>): Promise<UserEntity> {
    // The repository does not accept or propagate caller-provided `id` values.
    // The `UserEntity` lifecycle (`@BeforeInsert`) is responsible for
    // generating a unique v7 UUID when the entity is persisted.

    const instance = new UserEntity();

    if (entity.email !== undefined) instance.email = entity.email;
    if (entity.name !== undefined) instance.name = entity.name;
    if (entity.passwordHash !== undefined)
      instance.passwordHash = entity.passwordHash;
    if (entity.role !== undefined) instance.role = entity.role as any;

    return super.save(instance as any);
  }

  async remove(entity: UserEntity): Promise<UserEntity> {
    return super.remove(entity);
  }

  /**
   * Update a user by id with partial fields and return the updated entity.
   *
   * Note: this method accepts a repository-level DTO `UpdateUserDto` (from
   * `packages/database/src/dto/user.dto.ts`) which restricts updatable fields
   * (excludes `id` and privileged fields like `role`). The repository will
   * fetch the existing entity, apply allowed changes, and persist the update.
   */
  async update(id: string, data: UpdateUserDto): Promise<UserEntity> {
    const existing = await this.findOneById(id);
    if (!existing) throw new Error("User not found");

    if (data.email !== undefined) existing.email = data.email;
    if (data.name !== undefined) existing.name = data.name;

    const saved = await this.repo.save(existing);
    return saved;
  }
}
