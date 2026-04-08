import { describe, it, expect, vi } from "vitest";
import { RateLimitStoreAdapter } from "../../src/adapters/rate-limit-store";
import type Redis from "ioredis";
type MockRedisClient = {
  incr?: (...args: unknown[]) => Promise<number>;
  pttl?: (...args: unknown[]) => Promise<number>;
  pexpire?: (...args: unknown[]) => Promise<number>;
  del?: (...args: unknown[]) => Promise<number>;
};

describe("RateLimitStoreAdapter", () => {
  it("uses redis client when available (incr & pttl & pexpire & del)", async () => {
    const mockRedis: MockRedisClient = {
      incr: vi.fn().mockResolvedValue(1),
      pttl: vi.fn().mockResolvedValue(1000),
      pexpire: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
    };
    const s = new RateLimitStoreAdapter(mockRedis as unknown as Redis, 5000);
    const count = await s.incr("key1");
    expect(count).toBe(1);
    expect(mockRedis.incr).toHaveBeenCalledWith("key1");
    const ttl = await s.pttl("key1");
    expect(ttl).toBe(1000);
    await s.pexpire("key1", 2000);
    expect(mockRedis.pexpire).toHaveBeenCalledWith("key1", 2000);
    const del = await s.del("key1");
    expect(del).toBe(1);
  });

  it("falls back to local store when redis client not present", async () => {
    const s = new RateLimitStoreAdapter(null, 1000);
    const c1 = await s.incr("k");
    expect(c1).toBe(1);
    const c2 = await s.incr("k");
    expect(c2).toBe(2);
    const ttl = await s.pttl("k");
    expect(ttl).toBeGreaterThanOrEqual(0);
    await s.pexpire("k", 10);
    const del = await s.del("k");
    expect([0, 1]).toContain(del);
  });

  it("passthrough strategy does not count or set TTL", async () => {
    const s = new RateLimitStoreAdapter(null, 1000, "passthrough");
    const c1 = await s.incr("kpt");
    expect(c1).toBe(0);
    const ttl = await s.pttl("kpt");
    expect(ttl).toBeLessThanOrEqual(-1);
    await s.pexpire("kpt", 10);
    const del = await s.del("kpt");
    expect(del).toBe(0);
  });
});
