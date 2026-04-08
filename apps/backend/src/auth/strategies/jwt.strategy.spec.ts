import { describe, it, expect, vi } from "vitest";
import type { RedisService } from "@turborepo/redis";
import { JwtAuthStrategy } from "./jwt.strategy";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

vi.mock("../../env", () => ({
  typedEnv: {
    JWT_SECRET: "testsecret",
    JWT_REFRESH_SECRET: "refreshsecret",
    JWT_EXPIRES_IN: 3600,
    JWT_REFRESH_EXPIRES_IN: 604800,
  },
}));

describe("JwtAuthStrategy", () => {
  it("includes role in tokens and stores jtis in redis", async () => {
    const expireMock = vi.fn().mockResolvedValue(1);
    const redis = {
      set: vi.fn().mockResolvedValue("OK"),
      sAdd: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue("user-id"),
      sRem: vi.fn().mockResolvedValue(1),
      expire: expireMock,
    } as unknown as RedisService;
    const strat = new JwtAuthStrategy(redis);
    const user = { id: uuidv4(), email: "a@b.com", role: "ADMIN" } as {
      id: string;
      email: string;
      role?: string;
    };
    const res = await strat.login(user);
    expect(res.accessToken).toBeTruthy();
    const decoded = jwt.verify(res.accessToken, "testsecret") as any;
    expect(decoded.role).toEqual("ADMIN");
    // ensure per-user sets expire was called for access and refresh
    expect(expireMock).toHaveBeenCalledWith(
      `auth:access:user:${user.id}`,
      3600
    );
    expect(expireMock).toHaveBeenCalledWith(
      `auth:refresh:user:${user.id}`,
      604800
    );
  });

  it("throws when JWT_EXPIRES_IN is invalid", async () => {
    const redis = {
      set: vi.fn().mockResolvedValue("OK"),
      sAdd: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue("user-id"),
      sRem: vi.fn().mockResolvedValue(1),
    } as unknown as RedisService;
    const strat = new JwtAuthStrategy(redis);
    // simulate invalid configuration
    (strat as any).jwtExpiresIn = 0;
    const user = { id: uuidv4(), email: "a@b.com" } as {
      id: string;
      email: string;
    };
    await expect(strat.login(user)).rejects.toThrow(
      /JWT_EXPIRES_IN|Invalid configuration: JWT_EXPIRES_IN/
    );
  });
});
