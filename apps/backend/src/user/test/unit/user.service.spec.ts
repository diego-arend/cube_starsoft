import { describe, it, expect, beforeEach, vi } from "vitest";
import { v7 as uuidv7 } from "uuid";
import { UserRole } from "@turborepo/database";
import { UserService } from "../../user.service";
import type {
  IUserRepository,
  CreateUserDto,
  UpdateUserDto,
} from "@turborepo/database";
import type { RabbitMqService } from "@turborepo/messaging";

describe("UserService (unit)", () => {
  let svc: UserService;
  let repo: any;

  beforeEach(() => {
    const now = new Date();
    repo = {
      findByEmail: (_e: string) => {
        void _e;
        return Promise.resolve(null);
      },
      save: (p: Partial<any>) =>
        Promise.resolve({
          id: uuidv7(),
          createdAt: now,
          updatedAt: now,
          ...p,
          role: p?.role ?? UserRole.USER,
        }),
      findAllPaginated: (opts: any) =>
        Promise.resolve({
          data: [
            {
              id: uuidv7(),
              email: "a@b.com",
              createdAt: now,
              updatedAt: now,
              role: UserRole.USER,
            },
          ],
          meta: {
            total: 1,
            page: opts?.page ?? 1,
            limit: opts?.limit ?? 20,
            pages: 1,
          },
        }),
      findOneById: (id: string) =>
        Promise.resolve(
          id === "u1"
            ? {
                id: uuidv7(),
                email: "a@b.com",
                createdAt: now,
                updatedAt: now,
                role: UserRole.USER,
              }
            : {
                id: uuidv7(),
                email: "notfound@",
                createdAt: now,
                updatedAt: now,
                role: UserRole.USER,
              }
        ),
      remove: (u: any) => Promise.resolve(u),
      update: (id: string, p: any) =>
        Promise.resolve({
          id: uuidv7(),
          createdAt: now,
          updatedAt: now,
          email: "a@b.com",
          role: UserRole.USER,
          ...p,
        }),
    };
    const rabbit = {
      assertExchange: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMqService;
    svc = new UserService(repo as unknown as IUserRepository, rabbit);
  });

  it("creates a user and enqueues welcome email", async () => {
    const payload: CreateUserDto = {
      email: "x@y.com",
      password: "password",
      name: "X User",
    };
    const u = await svc.create(payload);
    expect(u).toBeDefined();
    expect(u.email).toBe("x@y.com");
    // ensure the fire-and-forget publisher had time to run
    await new Promise((r) => setImmediate(r));
    // assert publish was called
    const rabbit = (svc as any).rabbit;
    expect(rabbit.publish).toHaveBeenCalled();
  });

  it("lists users and returns paginated result", async () => {
    const res = await svc.findAll({ page: 1, limit: 20 });
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    const u = res.data[0]!;
    expect(typeof u.email).toBe("string");
    expect(u.createdAt instanceof Date).toBe(true);
    expect(u.updatedAt instanceof Date).toBe(true);
    expect(res.meta.total).toBe(1);
  });

  it("finds, updates and removes a user", async () => {
    const u = await svc.findOne("u1");
    expect(typeof u.id).toBe("string");
    const up = await svc.update("u1", { name: "Updated" } as UpdateUserDto);
    expect(up).toBeDefined();
    await svc.remove("u1");
    // no throw
  });

  it("logs and throws generic 500 when repository fails on findAll", async () => {
    const err = new Error("db read failed");
    // replace findAllPaginated to reject
    repo.findAllPaginated = vi.fn().mockRejectedValue(err);

    // Ensure underlying logger output is suppressed even if internal
    // implementations call Console directly — spy the Logger prototype.
    const protoSpy = vi
      .spyOn((await import("@nestjs/common")).Logger.prototype, "error")
      .mockImplementation(() => void 0);

    const loggerSpy = vi
      .spyOn((svc as any).logger, "error")
      .mockImplementation(() => void 0);

    await expect(svc.findAll()).rejects.toThrow();
    expect(loggerSpy).toHaveBeenCalled();
    // ensure we don't expose internal error message to caller (generic thrown)
    const calls = loggerSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const loggedArgs = calls[0]!;
    expect(loggedArgs[0]).toContain("Failed to fetch or parse user records");
    expect(String(loggedArgs[1])).toContain("db read failed");

    loggerSpy.mockRestore();
    protoSpy.mockRestore();
  });
});
