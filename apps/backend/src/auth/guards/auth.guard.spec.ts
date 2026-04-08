import { describe, it, expect, vi } from "vitest";
import type { RedisService } from "@turborepo/redis";
import { Reflector } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";

vi.mock("../../env", () => ({
  typedEnv: {
    JWT_SECRET: "testsecret",
    JWT_REFRESH_SECRET: "refreshsecret",
    JWT_EXPIRES_IN: 3600,
    JWT_REFRESH_EXPIRES_IN: 604800,
  },
}));

import { JwtAuthGuard } from "./auth.guard";

describe("JwtAuthGuard", () => {
  // no beforeEach required
  // Keep tests isolated by creating fresh JwtAuthGuard instances per test

  it("should authenticate and attach role on valid token", async () => {
    const userId = "user-123";
    const redis = {
      get: vi.fn().mockResolvedValue(userId),
    } as unknown as RedisService;
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as any as Reflector;
    const guard = new JwtAuthGuard(redis, reflector);
    const token = jwt.sign(
      { sub: userId, jti: "abc", role: "ADMIN" },
      "testsecret",
      { expiresIn: 3600 }
    );
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it("throws UnauthorizedException for invalid token", async () => {
    const redis = { get: vi.fn() } as unknown as RedisService;
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as any as Reflector;
    const guard = new JwtAuthGuard(redis, reflector);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: `Bearer invalid` } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("bypasses auth when route is public", async () => {
    const redis = { get: vi.fn() } as unknown as RedisService;
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as any as Reflector;
    const guard = new JwtAuthGuard(redis, reflector);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
