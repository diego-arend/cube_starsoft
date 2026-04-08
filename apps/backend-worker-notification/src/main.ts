import "./instrumentation";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";
import { NestPinoLogger } from "@turborepo/logging";

async function bootstrap() {
  // Initialize logger first to capture bootstrap logs
  const nestLogger = new NestPinoLogger();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: nestLogger, // Use pino logger during bootstrap
  });
  const logger = new Logger("backend-worker-notification");

  // Ensure logger is set (redundant if passed to createApplicationContext, but safe)
  app.useLogger(nestLogger);

  logger.log("Worker started");

  async function gracefulShutdown(err?: unknown) {
    logger.warn("Shutdown initiated");
    try {
      if (err) logger.error("Shutdown reason: " + String(err));
      await app.close();
      process.exit(0);
    } catch (e: unknown) {
      logger.error("Shutdown error: " + String(e));
      process.exit(1);
    }
  }

  process.once("SIGINT", () => void gracefulShutdown());
  process.once("SIGTERM", () => void gracefulShutdown());
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
