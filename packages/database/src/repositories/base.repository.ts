import { Repository, FindOptionsWhere, DeepPartial } from "typeorm";
import type { PaginationOptions, PaginatedResult } from "../pagination";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../pagination";

// BaseRepository<T, P>
// - T: the entity type stored in the database
// - P: the public/serialized type returned by higher-level APIs
export class BaseRepository<T extends object, P = T> {
  constructor(protected readonly repo: Repository<T>) {}

  // By default, findAll will fetch entities and map them through `serialize`.
  // Subclasses may override `serialize` to return a different (public) shape.
  async findAll(): Promise<P[]> {
    const items = await this.repo.find();
    return items.map((i) => this.serialize(i));
  }

  // Generic pagination helper that returns a paginated result (data + meta).
  async findPaginated(opts: PaginationOptions): Promise<PaginatedResult<P>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? opts.take ?? DEFAULT_LIMIT;
    const take = Math.min(Math.max(1, Number(limit)), MAX_LIMIT);
    const skip = opts.skip ?? (page - 1) * take;

    const [rows, total] = await this.repo.findAndCount({
      where: opts.where as any,
      skip,
      take,
      order: opts.order as any,
    });

    const data = rows.map((r) => this.serialize(r));
    const pages = Math.max(1, Math.ceil(total / take));

    return {
      data,
      meta: {
        total,
        page,
        limit: take,
        pages,
      },
    };
  }

  async findOneById(id: string): Promise<T | null> {
    // The where clause will be cast to the TypeORM FindOptionsWhere<T> type
    const where = { id } as unknown as FindOptionsWhere<T>;
    return this.repo.findOne({ where });
  }

  async save(entity: DeepPartial<T>): Promise<T> {
    const saved = await this.repo.save(entity);
    return saved as T;
  }

  async remove(entity: T): Promise<T> {
    const removed = await this.repo.remove(entity);
    return removed;
  }

  // Default serializer: identity cast. Subclasses override this to provide
  // public DTO conversion/validation.
  protected serialize(entity: T): P {
    return entity as unknown as P;
  }
}
