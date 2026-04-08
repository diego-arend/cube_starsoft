import { describe, it, expect, beforeEach, vi } from "vitest";
import type { UserService } from "../../user.service";
import { UserController } from "../../user.controller";
import type { OffsetPaginationDto } from "@turborepo/database";
import type { RedisService } from "@turborepo/redis";

// Mock RolesGuard since we are testing the controller unit logic, not the guard itself
vi.mock("../../auth/guards/roles.guard", () => ({
  RolesGuard: vi.fn().mockImplementation(() => ({
    canActivate: vi.fn().mockReturnValue(true),
  })),
}));

describe("UserController (unit)", () => {
  let ctrl: UserController;
  let svc: Partial<UserService>;
  let redis: Partial<RedisService>;

  beforeEach(() => {
    svc = {
      create: vi.fn().mockResolvedValue({ id: "u1", email: "a@b.com" }),
      findAll: vi.fn().mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, pages: 0 },
      }),
      findOne: vi.fn().mockResolvedValue({ id: "u1", email: "a@b.com" }),
      update: vi.fn().mockResolvedValue({ id: "u1", email: "a@b.com" }),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    redis = {
      get: vi.fn(),
      set: vi.fn(),
    };
    ctrl = new UserController(
      svc as unknown as UserService,
      redis as unknown as RedisService
    );
  });

  it("create route calls service", async () => {
    const res = await ctrl.create({ email: "a@b.com", password: "p" });
    expect(svc.create).toHaveBeenCalled();
    expect(res.email).toBe("a@b.com");
  });

  it("findall returns paginated envelope", async () => {
    const pagination: OffsetPaginationDto = {
      page: 1,
      limit: 20,
    } as OffsetPaginationDto;
    const res = await ctrl.findAll(pagination);
    expect(svc.findAll).toHaveBeenCalledWith(pagination);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.meta).toBeDefined();
  });

  it("findOne calls and returns", async () => {
    const res = await ctrl.findOne("u1");
    expect(svc.findOne).toHaveBeenCalledWith("u1");
    expect(res.id).toBe("u1");
  });
});
