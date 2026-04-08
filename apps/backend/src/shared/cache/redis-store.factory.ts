import { RedisService } from "@turborepo/redis";

export const redisStoreFactory = (redisService: RedisService): any => {
  const store = {
    name: "redis",
    get: async <T>(key: string): Promise<T | undefined> => {
      const val = await redisService.get(key);
      if (val === null || val === undefined) {
        return undefined;
      }
      try {
        return JSON.parse(val) as T;
      } catch {
        return val as unknown as T;
      }
    },
    set: async <T>(key: string, value: T, ttl?: number): Promise<void> => {
      // cache-manager v5 passes ttl in milliseconds
      // RedisService expects seconds
      const ttlSeconds = ttl ? Math.ceil(ttl / 1000) : undefined;
      await redisService.set(key, JSON.stringify(value), ttlSeconds);
    },
    del: async (key: string): Promise<void> => {
      await redisService.del(key);
    },
    keys: async (pattern?: string): Promise<string[]> => {
      return await redisService.keys(pattern || "*");
    },
    reset: async (): Promise<void> => {
      const keys = await redisService.keys("*");
      await Promise.all(keys.map((k) => redisService.del(k)));
    },
    ttl: async (): Promise<number> => {
      return Promise.resolve(10000);
    },
    mset: async (args: [string, unknown][], ttl?: number): Promise<void> => {
      const ttlSeconds = ttl ? Math.ceil(ttl / 1000) : undefined;
      for (const [key, value] of args) {
        await redisService.set(key, JSON.stringify(value), ttlSeconds);
      }
    },
    mget: async (...args: string[]): Promise<unknown[]> => {
      const values = await Promise.all(
        args.map((key) => redisService.get(key))
      );
      return values.map((val) => {
        if (val === null || val === undefined) return undefined;
        try {
          return JSON.parse(val) as unknown;
        } catch {
          return val;
        }
      });
    },
  };

  return {
    store: store,
    ttl: 10000, // Default TTL in milliseconds
  };
};
