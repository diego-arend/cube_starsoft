import { describe, it, expect, vi } from "vitest";
import type { AuthStrategy } from "./strategies/auth.strategy";
import { AuthService } from "./auth.service";
import type { UserRepository } from "@turborepo/database";
import { RedisService } from "@turborepo/redis";

describe("AuthService", () => {
  it("should throw if credentials invalid", async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue(null),
    } as unknown as UserRepository;
    const redis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    } as unknown as RedisService;
    const stubStrategy = {
      name: "jwt",
      login: vi.fn().mockResolvedValue({ accessToken: "tok", expiresIn: 3600 }),
      refresh: vi
        .fn()
        .mockResolvedValue({ accessToken: "tok2", expiresIn: 3600 }),
    } as unknown;
    const svc = new AuthService(repo, redis, [
      stubStrategy as AuthStrategy<unknown>,
    ]);
    await expect(svc.login("not@found", "pwd")).rejects.toThrow();
  });

  it("logout should delete access and associated refresh jti in redis", async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue(null),
    } as unknown as UserRepository;
    const redisDel = vi.fn().mockResolvedValue(1);
    const redisSRem = vi.fn().mockResolvedValue(1);
    const redis = {
      get: vi
        .fn()
        .mockImplementation((k: string) =>
          Promise.resolve(
            k === "auth:session:the-jti" ? "refresh-123" : "user-id"
          )
        ),
      set: vi.fn(),
      del: redisDel,
      sRem: redisSRem,
    } as unknown as RedisService;
    const stubStrategy = {
      name: "jwt",
      login: vi.fn().mockResolvedValue({ accessToken: "tok", expiresIn: 3600 }),
      refresh: vi
        .fn()
        .mockResolvedValue({ accessToken: "tok2", expiresIn: 3600 }),
    } as unknown;
    const svc = new AuthService(repo, redis, [
      stubStrategy as AuthStrategy<unknown>,
    ]);
    const res = await svc.logout("user-id", "the-jti");
    expect(redisDel).toHaveBeenCalledWith("auth:access:the-jti");
    expect(redisDel).toHaveBeenCalledWith("auth:refresh:refresh-123");
    expect(redisSRem).toHaveBeenCalledWith(
      "auth:refresh:user:user-id",
      "refresh-123"
    );
    expect(redisDel).toHaveBeenCalledWith("auth:session:the-jti");
    expect(res).toEqual({ success: true });
  });
});
