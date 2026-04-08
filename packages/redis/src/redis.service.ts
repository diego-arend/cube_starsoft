import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import Redis, { RedisOptions } from "ioredis";
import type { Env } from "@turborepo/config";
import { FallbackService } from "./fallback.service";
import {
  RateLimitStoreAdapter,
  type RateLimitFailoverStrategy,
  type RateLimitAdapterLogger,
  type RateLimitStore,
} from "./adapters/rate-limit-store";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private fallbackActive = false;
  private readonly cfg: Env;
  private consecutiveErrors = 0;
  private failureThreshold: number;
  private resetTimeoutMs: number; // ms
  private openUntil: number | null = null;
  private connecting = false;

  constructor(
    private readonly fallback: FallbackService,
    cfg: Env
  ) {
    // use fallback by default if configured
    this.cfg = cfg;

    if (this.cfg.REDIS_FALLBACK_ENABLED) {
      this.fallbackActive = true;
    }
    // Read failureThreshold and resetTimeoutMs from config/environment
    this.failureThreshold = Number(this.cfg.REDIS_FAILURE_THRESHOLD ?? 5);
    this.resetTimeoutMs = Number(this.cfg.REDIS_RESET_TIMEOUT_MS ?? 10_000);
  }

  async onModuleInit(): Promise<void> {
    if (!this.cfg.REDIS_ENABLED) {
      this.logger.warn("Redis is disabled by config (REDIS_ENABLED=false)");
      this.fallbackActive = true;
      return;
    }
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private createClient(): Redis {
    const url = this.cfg.REDIS_URL;
    const opts: RedisOptions = {};
    const host = this.cfg.REDIS_HOST;
    const port = this.cfg.REDIS_PORT;
    const password = this.cfg.REDIS_PASSWORD;
    if (host) opts.host = host;
    if (port) opts.port = port;
    if (password) opts.password = password;
    // Avoid ioredis auto-connect on instantiation to prevent "already
    // connecting/connected" errors when calling `connect()` explicitly.
    // `lazyConnect: true` defers the connection until `client.connect()` is
    // awaited.
    opts.lazyConnect = true;
    if (url) {
      // prefer URL if provided
      return new Redis(url, { lazyConnect: true } as RedisOptions);
    }
    return new Redis(opts);
  }

  async connect(): Promise<void> {
    if (this.client) return;
    try {
      this.client = this.createClient();
      this.client.on("error", (err) => this.onClientError(err));
      this.client.on("end", () => this.onClientClose());
      await this.client.connect();
      this.logger.log("Connected to Redis");
      this.fallbackActive = false;
      this.consecutiveErrors = 0;
    } catch (err) {
      this.onClientError(err as Error);
    }
  }

  private onClientError(err: Error) {
    this.consecutiveErrors += 1;
    this.logger.error("Redis client error", err?.message ?? String(err));
    if (this.consecutiveErrors >= this.failureThreshold) {
      this.activateFallback();
    }
  }

  private onClientClose() {
    this.logger.warn("Redis connection closed");
    this.activateFallback();
  }

  private activateFallback() {
    if (!this.fallbackActive) {
      this.logger.warn("Activating Redis fallback (in-memory store)");
      this.fallbackActive = true;
      this.openUntil = Date.now() + this.resetTimeoutMs;
      // attempt reconnect after resetTimeoutMs
      setTimeout(() => {
        void this.tryReset();
      }, this.resetTimeoutMs + 50);
    }
  }

  private async tryReset() {
    if (!this.openUntil || Date.now() < this.openUntil) return;
    this.logger.log("Attempting Redis reconnect...");
    this.consecutiveErrors = 0;
    try {
      await this.connect();
      // if connect() succeeded, fallbackActive should now be false
      if (!this.fallbackActive) {
        this.logger.log("Redis reconnect successful: disabling fallback");
        return;
      }
    } catch {
      this.logger.warn("Redis reconnect failed");
      this.openUntil = Date.now() + this.resetTimeoutMs;
      setTimeout(() => {
        void this.tryReset();
      }, this.resetTimeoutMs + 50);
    }
  }

  private async exec<T>(
    op: () => Promise<T>,
    fallbackFn?: () => T
  ): Promise<T> {
    if (this.fallbackActive || !this.client) {
      // fallback to in-memory store
      this.logger.debug("Using fallback store for Redis operation");
      if (!fallbackFn)
        throw new Error("Redis is unavailable and no fallback provided");
      return fallbackFn();
    }

    try {
      const res = await op();
      this.consecutiveErrors = 0;
      return res;
    } catch (err) {
      this.onClientError(err as Error);
      if (this.fallbackActive && fallbackFn) {
        return fallbackFn();
      }
      throw err;
    }
  }

  async get(key: string): Promise<string | null> {
    return this.exec(
      async () => {
        const val = await this.client!.get(key);
        return val;
      },
      () => this.fallback.get(key)
    );
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<string | null> {
    return this.exec(
      async () => {
        if (ttlSeconds) {
          return await this.client!.set(key, value, "EX", ttlSeconds);
        }
        return await this.client!.set(key, value);
      },
      () => this.fallback.set(key, value, ttlSeconds)
    );
  }

  /**
   * Set key to value only if it does not exist (NX).
   * @returns "OK" if set, null if already exists
   */
  async setNx(
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<string | null> {
    return this.exec(
      async () => {
        if (ttlSeconds) {
          // ioredis set(key, value, 'EX', ttl, 'NX') returns 'OK' or null
          return await this.client!.set(key, value, "EX", ttlSeconds, "NX");
        }
        return await this.client!.set(key, value, "NX");
      },
      () => {
        const exists = this.fallback.get(key);
        if (exists !== null) return null;
        this.fallback.set(key, value, ttlSeconds);
        return "OK";
      }
    );
  }

  async del(key: string): Promise<number> {
    return this.exec(
      async () => {
        return await this.client!.del(key);
      },
      () => this.fallback.del(key)
    );
  }

  async sAdd(key: string, member: string): Promise<number> {
    return this.exec(
      async () => {
        // return number of items added (1 or 0)
        return await this.client!.sadd(key, member);
      },
      () => this.fallback.sAdd(key, member)
    );
  }

  async sRem(key: string, member: string): Promise<number> {
    return this.exec(
      async () => {
        return await this.client!.srem(key, member);
      },
      () => this.fallback.sRem(key, member)
    );
  }

  async sMembers(key: string): Promise<string[]> {
    return this.exec(
      async () => {
        return await this.client!.smembers(key);
      },
      () => this.fallback.sMembers(key)
    );
  }

  /**
   * Invalidate cache keys matching a pattern.
   * @param pattern Glob pattern (e.g. "*users*")
   * @returns Number of keys deleted
   */
  async invalidate(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    this.logger.log(
      `invalidate("${pattern}") found ${keys.length} keys: ${JSON.stringify(keys)}`
    );
    if (keys.length === 0) return 0;
    this.logger.log(`Invalidating ${keys.length} keys matching "${pattern}"`);
    await Promise.all(keys.map((k) => this.del(k)));
    return keys.length;
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    return this.exec(
      async () => {
        return Number(await this.client!.expire(key, ttlSeconds));
      },
      () => this.fallback.expire(key, ttlSeconds)
    );
  }

  async rPush(key: string, value: string): Promise<number> {
    return this.exec(
      async () => {
        return await this.client!.rpush(key, value);
      },
      () => 0
    );
  }

  async lRange(key: string, start: number, stop: number): Promise<string[]> {
    return this.exec(
      async () => {
        return await this.client!.lrange(key, start, stop);
      },
      () => []
    );
  }

  async lTrim(
    key: string,
    start: number,
    stop: number
  ): Promise<string | null> {
    return this.exec(
      async () => {
        return await this.client!.ltrim(key, start, stop);
      },
      () => "OK"
    );
  }

  async flushAll(): Promise<string | null> {
    return this.exec(
      async () => {
        // `flushall` is the Redis command name in ioredis (lowercase)
        return (await (this.client! as unknown as Redis).flushall()) as
          | string
          | null;
      },
      () => {
        this.fallback.flushAll();
        return "OK";
      }
    );
  }

  async keys(pattern: string): Promise<string[]> {
    return this.exec(
      async () => {
        return await this.client!.keys(pattern);
      },
      () => this.fallback.keys(pattern)
    );
  }

  isFallbackActive(): boolean {
    return this.fallbackActive;
  }

  /**
   * Internal helper to get the raw ioredis client if it is currently available and healthy.
   * This is intended for use by low-level adapters (e.g. rate-limit store) within the monorepo.
   */
  getInternalClient(): Redis | undefined {
    if (this.fallbackActive || !this.client) {
      return undefined;
    }
    return this.client;
  }

  /**
   * Factory method to create a RateLimitStoreAdapter using this Redis instance.
   * Falls back to in-memory if Redis is unavailable.
   */
  getRateLimitStore(
    windowMs?: number,
    strategy: RateLimitFailoverStrategy = "in-memory",
    logger?: RateLimitAdapterLogger
  ): RateLimitStore {
    return new RateLimitStoreAdapter(
      this.getInternalClient(),
      windowMs,
      strategy,
      logger
    );
  }

  async close(): Promise<void> {
    const client = this.client;
    if (client) {
      try {
        await client.quit();
      } catch {
        try {
          client.disconnect();
        } catch {
          // ignore
        }
      }
      this.client = null;
    }
  }
}
