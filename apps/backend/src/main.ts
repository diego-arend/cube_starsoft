import "./instrumentation";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { typedEnv, type Env } from "./env";
import { RedisIoAdapter } from "./shared/adapters/redis-io.adapter";
import {
  NestFastifyApplication,
  FastifyAdapter,
} from "@nestjs/platform-fastify";
import { initSwagger } from "./swagger";
import { Logger } from "@nestjs/common";
import { NestPinoLogger, createLogger } from "@turborepo/logging";
type PinoLevelWithSilent =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";
import cors, { type FastifyCorsOptions } from "@fastify/cors";
import helmet, { type FastifyHelmetOptions } from "@fastify/helmet";
import cookie, { type FastifyCookieOptions } from "@fastify/cookie";
import { registerRateLimit } from "@turborepo/rate-limit";
import { JwtAuthGuard } from "./auth/guards/auth.guard";
import multipart from "@fastify/multipart";

async function bootstrap() {
  const cfg: Env = typedEnv;

  const adapter = new FastifyAdapter({
    loggerInstance: createLogger({
      level: cfg.LOG_LEVEL as unknown as PinoLevelWithSilent,
      serviceName: "backend-api",
      pretty: cfg.LOG_FORMAT === "pretty",
    }),
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    {
      logger: false, // Suppress default NestJS logger
    }
  );
  const logger = new Logger("bootstrap");
  // Wrapper for `app.register` so we can pass plugin and options consistently.
  function register(
    plugin: Parameters<typeof app.register>[0],
    options?: Parameters<typeof app.register>[1]
  ) {
    return app.register(plugin, options);
  }
  // Register Fastify plugins

  // Setup logging provider after loading cfg
  try {
    const nestLogger = new NestPinoLogger({
      level: cfg.LOG_LEVEL as unknown as PinoLevelWithSilent,
      serviceName: "backend-api",
      pretty: cfg.LOG_FORMAT === "pretty",
    });
    app.useLogger(nestLogger);
  } catch {
    logger.warn(
      "Could not initialize NestPinoLogger; falling back to Nest logger"
    );
  }

  // Register Redis Adapter for Socket.IO multi-replica support.
  // Graceful degradation: falls back to in-memory adapter if Redis is unavailable.
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(app);
  app.useWebSocketAdapter(redisIoAdapter);

  const corsOptions: FastifyCorsOptions = {
    origin: cfg.CORS_ORIGIN ?? true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "traceparent",
      "tracestate",
      "baggage",
      "x-api-key",
      "span_id",
      "trace_id",
      "Span_id",
      "Trace_id",
      "Traceparent",
      "trace-id",
      "span-id",
      "X-Trace-Id",
      "X-Span-Id",
      "x-trace-id",
      "x-span-id",
    ],
    credentials: true,
  } as FastifyCorsOptions;
  const helmetOptions: FastifyHelmetOptions = {} as FastifyHelmetOptions;
  const cookieOptions: FastifyCookieOptions = {} as FastifyCookieOptions;

  await register(cors, corsOptions);
  // Register helmet cautiously: some releases of @fastify/helmet are tied to
  // a particular major Fastify version. To avoid failing dev startup on a
  // mismatch we only register helmet when explicitly requested in config
  // (e.g., production). During development we can safely skip this plugin.
  if (cfg.NODE_ENV === "production") {
    await register(helmet, helmetOptions);
  }
  if (cfg.NODE_ENV === "production") {
    await register(cookie, cookieOptions);
  }

  // Register multipart support: enable file uploads documents
  await register(multipart as unknown as Parameters<typeof app.register>[0], {
    addToBody: true,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });
  // Register rate limit (IP-based) if enabled, using Redis client if available
  try {
    // Let registerRateLimit resolve RedisService from DI itself instead of
    // passing the service instance (avoid exposing raw RedisService across
    // boundaries). This keeps the service encapsulated and prevents accidental
    // use of RedisService as a `RateLimitStore`.
    await registerRateLimit(app, cfg);
  } catch (err) {
    logger.warn("RateLimit plugin not registered: " + String(err));
  }

  // Apply authentication guard globally; endpoints can opt-out using @Public()
  try {
    const jwtGuard = app.get(JwtAuthGuard);
    app.useGlobalGuards(jwtGuard);
  } catch (err) {
    logger.warn("Global JWT guard not registered: " + String(err));
  }

  // Listen on configured port
  // Setup Swagger (OpenAPI) docs if enabled
  initSwagger(app, cfg);

  const port: number = Number(cfg.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  // try {
  //   const url = await app.getUrl();
  //   logger.log(`Server listening at ${url}`);
  // } catch (err) {
  //   logger.log(`Server started (could not get URL): ${String(err)}`);
  // }

  // Graceful shutdown handling
  const shutdownTimeout = Number(cfg.SHUTDOWN_TIMEOUT ?? 30000);
  let shutdownCalled = false;
  async function gracefulShutdown(
    signal: string | undefined,
    reason?: Error | null
  ) {
    if (shutdownCalled) return;
    shutdownCalled = true;
    logger.warn(`Shutdown initiated${signal ? ` by ${signal}` : ""}`);
    if (reason) logger.error("Shutdown reason: " + String(reason));
    const force = setTimeout(() => {
      logger.error("Forcing shutdown after timeout");
      process.exit(1);
    }, shutdownTimeout);
    try {
      await app.close();
      clearTimeout(force);
      // logger.log("Graceful shutdown complete");
      process.exit(0);
    } catch (err: any) {
      logger.error("Error during shutdown: " + String(err));
      process.exit(1);
    }
  }

  process.once("SIGINT", () => void gracefulShutdown("SIGINT", null));
  process.once("SIGTERM", () => void gracefulShutdown("SIGTERM", null));
  process.on("unhandledRejection", (err) => {
    logger.error("Unhandled Rejection: " + String(err));
    void gracefulShutdown("unhandledRejection", err as Error);
  });
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception: " + String(err));
    void gracefulShutdown("uncaughtException", err);
  });
}

bootstrap().catch((err) => {
  // Log error and exit with non-zero code
  console.error(err);
  process.exit(1);
});
