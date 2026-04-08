import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Env } from "@turborepo/config";
// Import the compiled package entry for runtime stability in tests.
import { RedisService, FallbackService } from "../../../dist/index.js";

type TestEnv = {
  REDIS_FALLBACK_ENABLED?: boolean;
  REDIS_FAILURE_THRESHOLD?: number;
  REDIS_RESET_TIMEOUT_MS?: number;
  REDIS_ENABLED?: boolean;
};

type RedisSvcLike = {
  isFallbackActive: () => boolean;
  set: (k: string, v: string, ttl?: number) => Promise<string | null>;
  get: (k: string) => Promise<string | null>;
  del: (k: string) => Promise<number>;
  invalidate: (p: string) => Promise<number>;
  getRateLimitStore: (
    windowMs?: number,
    strategy?: string,
    logger?: unknown
  ) => { incr: (key: string) => Promise<number> };
  onModuleInit?: () => Promise<void>;
};

describe("RedisService (concise)", () => {
  let svc: RedisSvcLike;

  beforeEach(async (): Promise<void> => {
    const cfg: TestEnv = {
      REDIS_FALLBACK_ENABLED: true,
      REDIS_FAILURE_THRESHOLD: 2,
      REDIS_RESET_TIMEOUT_MS: 50,
      REDIS_ENABLED: false,
    };
    const fallback = new FallbackService();
    svc = new RedisService(
      fallback,
      cfg as unknown as Env
    ) as unknown as RedisSvcLike;
    await svc.onModuleInit?.();
  });

  it("reads config & activates fallback when disabled", () => {
    expect(svc.isFallbackActive()).toBe(true);
  });

  it("uses fallback store operations", async (): Promise<void> => {
    await svc.set("a", "x", 10);
    expect(await svc.get("a")).toBe("x");
    await svc.del("a");
    expect(await svc.get("a")).toBeNull();
  });

  it("invalidates keys by pattern", async (): Promise<void> => {
    await svc.set("user:1:details", "data", 60);
    await svc.set("user:1:profile", "data", 60);
    await svc.set("user:2:details", "data", 60);

    const count = await svc.invalidate("user:1:*");
    expect(count).toBe(2);
    expect(await svc.get("user:1:details")).toBeNull();
    expect(await svc.get("user:1:profile")).toBeNull();
    expect(await svc.get("user:2:details")).toBe("data");
  });

  it("reconnects and disables fallback when Redis becomes available", async (): Promise<void> => {
    const fallback2 = new FallbackService();
    const cfg2: TestEnv = {
      REDIS_FALLBACK_ENABLED: false,
      REDIS_FAILURE_THRESHOLD: 1,
      REDIS_RESET_TIMEOUT_MS: 25,
      REDIS_ENABLED: true,
    };
    const svcReal = new RedisService(
      fallback2,
      cfg2 as unknown as Env
    ) as unknown as RedisSvcLike & {
      createClient?: () => unknown;
      client?: unknown;
    };

    let attempts = 0;
    const fakeClient: unknown = {
      on: (...args: unknown[]) => {
        void args;
        return undefined;
      },
      connect: () => {
        attempts += 1;
        if (attempts === 1) throw new Error("connect failure");
        return Promise.resolve();
      },
      get: () => Promise.resolve(null),
      set: () => Promise.resolve("OK"),
      del: () => Promise.resolve(0),
      flushall: () => Promise.resolve("OK"),
      quit: () => Promise.resolve(undefined),
      disconnect: () => undefined,
    };

    const svcRec = svcReal as unknown as Record<string, unknown>;
    svcRec["createClient"] = () => fakeClient;
    await svcReal.onModuleInit?.();
    expect(svcReal.isFallbackActive()).toBe(true);
    svcRec["client"] = null;
    await vi.waitFor(() => expect(svcReal.isFallbackActive()).toBe(false), {
      timeout: 2000,
      interval: 25,
    });
  });

  it("provides a rate limit store", async (): Promise<void> => {
    const store = svc.getRateLimitStore(60000, "in-memory");
    expect(store).toBeDefined();
    expect(typeof store.incr).toBe("function");

    const count = await store.incr("test-key");
    expect(count).toBe(1);
    const count2 = await store.incr("test-key");
    expect(count2).toBe(2);
  });
});
