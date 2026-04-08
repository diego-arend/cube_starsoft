import { Module, Global, DynamicModule } from "@nestjs/common";
import { NestPinoLogger } from "./logger";
import type { Env } from "@turborepo/config";
import type pino from "pino";

@Global()
@Module({})
export class LoggingModule {
  static forRoot(cfg: Env): DynamicModule {
    const provider = {
      provide: NestPinoLogger,
      useFactory: () =>
        new NestPinoLogger({
          level: cfg.LOG_LEVEL as pino.LevelWithSilent,
          serviceName: cfg.OTEL_SERVICE_NAME,
          pretty: cfg.LOG_FORMAT === "pretty",
        }),
    };
    return {
      module: LoggingModule,
      providers: [provider],
      exports: [provider],
    };
  }
}
