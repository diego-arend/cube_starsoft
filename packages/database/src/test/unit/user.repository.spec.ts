import { describe, it, expect, vi } from "vitest";
import type { UpdateUserDto } from "../../dto/user.dto";
import { UserRepository } from "../../repositories/user.repository";
import { Repository } from "typeorm";
import { UserEntity } from "../../entities/user.entity";

describe("UserRepository", () => {
  it("should delegate save to repository with a UserEntity instance", async () => {
    const saved = { id: "123", email: "a@b.com" } as unknown as UserEntity;
    class FakeRepo1 {
      public _save = vi.fn().mockResolvedValue(saved) as unknown as (
        ...args: [Partial<UserEntity>]
      ) => Promise<UserEntity>;
      public save(this: void, ...args: unknown[]): Promise<UserEntity> {
        return (
          this as unknown as {
            _save: (...args: unknown[]) => Promise<UserEntity>;
          }
        )._save(...args);
      }
    }
    const repo = new FakeRepo1();
    const ur = new UserRepository(repo as unknown as Repository<UserEntity>);
    const res = await ur.save({ email: "a@b.com" });
    expect(repo._save).toHaveBeenCalled();
    const arg = (repo._save as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0] as UserEntity;
    expect(arg.constructor.name).toBe("UserEntity");
    expect(res).toEqual(saved);
  });

  it("ignores a provided id and does not copy it into the entity instance", async () => {
    const saved = { id: "generated-id", email: "x@x" } as unknown as UserEntity;
    class FakeRepo2 {
      public _save = vi.fn().mockResolvedValue(saved) as unknown as (
        ...args: [Partial<UserEntity>]
      ) => Promise<UserEntity>;
      public save(this: void, ...args: unknown[]): Promise<UserEntity> {
        return (
          this as unknown as {
            _save: (...args: unknown[]) => Promise<UserEntity>;
          }
        )._save(...args);
      }
    }
    const repo = new FakeRepo2();
    const ur = new UserRepository(repo as unknown as Repository<UserEntity>);
    const res = await ur.save({
      id: "some-id",
      email: "x@x",
    } as Partial<UserEntity>);
    expect(repo._save).toHaveBeenCalled();
    const arg = (repo._save as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0] as UserEntity;
    expect(arg.constructor.name).toBe("UserEntity");
    // repository should not copy provided `id` into the entity instance
    expect(arg.id).toBeUndefined();
    expect(res).toEqual(saved);
  });

  it("updates an existing user by id and returns saved entity", async () => {
    const existing = { id: "u1", email: "old@x" } as UserEntity;
    const saved = { id: "u1", email: "new@x" } as unknown as UserEntity;
    class FakeRepo3 {
      public _findOne = vi.fn().mockResolvedValue(existing) as unknown as (
        ...args: [string]
      ) => Promise<UserEntity | null>;
      public findOne(
        this: void,
        ...args: unknown[]
      ): Promise<UserEntity | null> {
        return (
          this as unknown as {
            _findOne: (...args: unknown[]) => Promise<UserEntity | null>;
          }
        )._findOne(...args);
      }
      public _save = vi.fn().mockResolvedValue(saved) as unknown as (
        ...args: [UserEntity]
      ) => Promise<UserEntity>;
      public save(this: void, ...args: unknown[]): Promise<UserEntity> {
        return (
          this as unknown as {
            _save: (...args: unknown[]) => Promise<UserEntity>;
          }
        )._save(...args);
      }
    }
    const repoMock = new FakeRepo3();
    const repo = repoMock as unknown as Repository<UserEntity>;

    const ur = new UserRepository(repo);
    const res = await ur.update("u1", { email: "new@x" } as UpdateUserDto);
    expect(repoMock._findOne).toHaveBeenCalled();
    expect(repoMock._save).toHaveBeenCalledWith(existing);
    expect(res).toEqual(saved);
  });

  it("ignores role changes on update", async () => {
    const existing = { id: "u1", email: "old@x", role: "USER" } as UserEntity;
    const saved = {
      id: "u1",
      email: "old@x",
      role: "USER",
    } as unknown as UserEntity;
    class FakeRepo4 {
      public _findOne = vi.fn().mockResolvedValue(existing) as unknown as (
        ...args: [string]
      ) => Promise<UserEntity | null>;
      public findOne(
        this: void,
        ...args: unknown[]
      ): Promise<UserEntity | null> {
        return (
          this as unknown as {
            _findOne: (...args: unknown[]) => Promise<UserEntity | null>;
          }
        )._findOne(...args);
      }
      public _save = vi.fn().mockResolvedValue(saved) as unknown as (
        ...args: [UserEntity]
      ) => Promise<UserEntity>;
      public save(this: void, ...args: unknown[]): Promise<UserEntity> {
        return (
          this as unknown as {
            _save: (...args: unknown[]) => Promise<UserEntity>;
          }
        )._save(...args);
      }
    }
    const repoMock = new FakeRepo4() as unknown as Repository<UserEntity>;

    const ur = new UserRepository(repoMock);
    const res = await ur.update("u1", { role: "ADMIN" } as UpdateUserDto);
    expect((repoMock as unknown as FakeRepo4)._findOne).toHaveBeenCalled();
    expect((repoMock as unknown as FakeRepo4)._save).toHaveBeenCalledWith(
      existing
    );
    expect(existing.role).toBe("USER");
    expect(res).toEqual(saved);
  });
});
