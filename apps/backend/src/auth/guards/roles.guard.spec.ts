import { describe, it, expect, vi } from "vitest";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { RolesGuard } from "./roles.guard";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@turborepo/database";

describe("RolesGuard", () => {
  it("allows when no roles are required", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as any as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("allows when user has required role", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.ADMIN]),
    } as any as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.ADMIN } }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("throws ForbiddenException when user lacks role", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.ADMIN]),
    } as any as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.USER } }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrowError(ForbiddenException);
  });
});
