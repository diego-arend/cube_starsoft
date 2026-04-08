import type Redis from "ioredis";

/**
 * Adapter used by the rate limiter. This encapsulates the operations
 * needed by a rate-limiter (incr, pttl, pexpire, del) and uses Redis
 * when available; otherwise, it falls back to an in-memory store.
 *
 * The adapter supports a `failoverStrategy` with values:
 * - `in-memory` (default): maintain counts in an in-memory Map when Redis is unavailable.
 * - `passthrough`: fail-open strategy, which does not count requests while in fallback so
 *                 rate limiting is effectively disabled when Redis is down.
 *
 * The adapter also accepts an optional minimal logger which will be used to emit
 * a single warning when the adapter falls back to a non-Redis mode.
 */
export type RateLimitFailoverStrategy = "in-memory" | "passthrough";

export interface RateLimitAdapterLogger {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

export type RateLimitStore = {
  incr(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  pexpire(key: string, ttlMs: number): Promise<void>;
  del(key: string): Promise<number>;
};

export class RateLimitStoreAdapter implements RateLimitStore {
  private readonly local = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  private readonly windowMs: number;
  private readonly client?: Redis | null;
  private readonly strategy: RateLimitFailoverStrategy;
  private readonly logger?: RateLimitAdapterLogger;
  private fallbackLogged = false;

  constructor(
    client?: Redis | null,
    windowMs = 60000,
    strategy: RateLimitFailoverStrategy = "in-memory",
    logger?: RateLimitAdapterLogger
  ) {
    this.client = client ?? null;
    this.windowMs = windowMs;
    this.strategy = strategy;
    this.logger = logger;
  }

  async incr(key: string): Promise<number> {
    // Use raw ioredis client if present
    if (this.client) {
      const client = this.client;
      const res = await client.incr(key);
      if (Number(res) === 1) {
        void client.pexpire(key, this.windowMs);
      }
      return Number(res);
    }
    // If no client present, we are in fallback mode; log once
    if (!this.client && !this.fallbackLogged) {
      this.logger?.warn?.(
        "RateLimitStoreAdapter: no redis client available, using fallback store"
      );
      this.fallbackLogged = true;
    }

    if (this.strategy === "passthrough") {
      // Fail-open: do not count, always return 0 so rate limiter does not block
      if (!this.fallbackLogged) {
        this.logger?.warn?.(
          "RateLimitStoreAdapter: using passthrough fallback strategy"
        );
        this.fallbackLogged = true;
      }
      return 0;
    }

    const now = Date.now();
    const entry = this.local.get(key);
    if (!entry || now >= entry.expiresAt) {
      this.local.set(key, { count: 1, expiresAt: now + this.windowMs });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  async pttl(key: string): Promise<number> {
    if (this.client) {
      const client = this.client;
      const res = await client.pttl(key);
      return Number(res);
    }
    const entry = this.local.get(key);
    if (!entry) return -1;
    return Math.max(entry.expiresAt - Date.now(), -1);
  }

  async pexpire(key: string, ttlMs: number): Promise<void> {
    if (this.client) {
      const client = this.client;
      await client.pexpire(key, ttlMs);
      return;
    }
    if (!this.client && !this.fallbackLogged) {
      this.logger?.warn?.(
        "RateLimitStoreAdapter: no redis client available, using fallback store"
      );
      this.fallbackLogged = true;
    }

    if (this.strategy === "passthrough") {
      if (!this.fallbackLogged) {
        this.logger?.warn?.(
          "RateLimitStoreAdapter: using passthrough fallback strategy"
        );
        this.fallbackLogged = true;
      }
      return;
    }
    const entry = this.local.get(key);
    if (entry) entry.expiresAt = Date.now() + ttlMs;
  }

  async del(key: string): Promise<number> {
    if (this.client) {
      const client = this.client;
      return Number(await client.del(key));
    }
    if (!this.client && !this.fallbackLogged) {
      this.logger?.warn?.(
        "RateLimitStoreAdapter: no redis client available, using fallback store"
      );
      this.fallbackLogged = true;
    }

    if (this.strategy === "passthrough") {
      if (!this.fallbackLogged) {
        this.logger?.warn?.(
          "RateLimitStoreAdapter: using passthrough fallback strategy"
        );
        this.fallbackLogged = true;
      }
      return 0;
    }
    return this.local.delete(key) ? 1 : 0;
  }
}
