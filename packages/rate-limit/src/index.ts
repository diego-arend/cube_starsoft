import type { FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { DynamicModule, Module } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Env } from "@turborepo/config";
import type { RateLimitStore } from "./types";
export type { RateLimitStore } from "./types";
import {
  RedisService,
  RateLimitStoreAdapter,
  RateLimitAdapterLogger,
  createFastifyRateLimitStoreCtor,
  type RateLimitFailoverStrategy,
} from "@turborepo/redis";
import { NestPinoLogger } from "@turborepo/logging";

export async function registerRateLimit(
  app: NestFastifyApplication,
  cfg: Env,
  providedStore?: RateLimitStore
) {
  const envRec = cfg as unknown as Record<string, unknown>;
  const rateLimitEnabled =
    envRec.RATE_LIMIT_ENABLED === true || envRec.RATE_LIMIT_ENABLED === "true";
  if (!rateLimitEnabled) return;

  const max = Number(envRec.RATE_LIMIT_MAX_REQUESTS ?? 100);
  const timeWindow = Number(envRec.RATE_LIMIT_WINDOW_MS ?? 60_000);

  let store: RateLimitStore | undefined = providedStore;
  if (
    !store &&
    (envRec.REDIS_ENABLED === true || envRec.REDIS_ENABLED === "true")
  ) {
    const rawStrategy = envRec.RATE_LIMIT_FAILOVER_STRATEGY;
    const strategy: RateLimitFailoverStrategy =
      rawStrategy === "passthrough" ? "passthrough" : "in-memory";
    const appLogger = app.get<NestPinoLogger | undefined>(
      NestPinoLogger as unknown as new (...args: unknown[]) => NestPinoLogger,
      { strict: false }
    );
    const logger: RateLimitAdapterLogger = {
      debug: (msg: unknown) => {
        try {
          appLogger?.debug?.(String(msg));
        } catch {
          /* swallow logging errors */
        }
      },
      info: (msg: unknown) => {
        try {
          appLogger?.log?.(String(msg));
        } catch {
          /* swallow logging errors */
        }
      },
      warn: (msg: unknown) => {
        try {
          appLogger?.warn?.(String(msg));
        } catch {
          /* swallow logging errors */
        }
      },
      error: (msg: unknown) => {
        try {
          appLogger?.error?.(String(msg));
        } catch {
          /* swallow logging errors */
        }
      },
    };
    try {
      const redisService = app.get<RedisService | undefined>(
        RedisService as unknown as new (...args: unknown[]) => RedisService,
        { strict: false }
      );
      const redisSvc = redisService;
      if (redisSvc) {
        // Use factory method for better encapsulation
        store = redisSvc.getRateLimitStore(timeWindow, strategy, logger);
      } else {
        store = new RateLimitStoreAdapter(
          undefined,
          timeWindow,
          strategy,
          logger
        );
      }
    } catch {
      store = new RateLimitStoreAdapter(
        undefined,
        timeWindow,
        strategy,
        logger
      );
    }
  }

  const keyGenerator = (req: FastifyRequest): string => {
    const xfwd = (req.headers &&
      (req.headers["x-forwarded-for"] as unknown)) as string | undefined;
    const xh = String(xfwd ?? "");
    if (xh.length > 0) {
      const first = xh.split(",")[0] ?? "";
      return first.trim();
    }
    const ip: string =
      req.ip || (req.raw?.socket?.remoteAddress as string) || "unknown";
    return ip;
  };

  const pluginOpts: Record<string, unknown> = {
    global: true,
    max,
    timeWindow,
    keyGenerator,
  };
  if (store) {
    const ctor = createFastifyRateLimitStoreCtor(store);
    pluginOpts.store = ctor as unknown;
  }
  await (
    app.register as unknown as (
      this: unknown,
      plugin: unknown,
      opts?: unknown
    ) => Promise<void>
  ).call(app, rateLimit as unknown, pluginOpts);
}

// Explicit import makes login-rate-limit.ts reachable to static analysis tools
import { observeLoginAttempt } from "./login-rate-limit";
export { observeLoginAttempt };

@Module({})
export class RateLimitModule {
  static forRoot(): DynamicModule {
    return { module: RateLimitModule };
  }
}
