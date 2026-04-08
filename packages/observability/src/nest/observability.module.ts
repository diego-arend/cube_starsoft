import { Module, DynamicModule, Global, Provider, Type } from "@nestjs/common";
import type { Env } from "@turborepo/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { OtelAuthGuard } from "./otel-auth.guard";
import { OtelProxyService } from "./otel-proxy.service";
import { OtelController } from "./otel.controller";
import { LoggingInterceptor } from "./logging.interceptor";
import { MetricsInterceptor } from "./metrics.interceptor";
import { TracingInterceptor } from "./tracing.interceptor";

export interface ObservabilityModuleOptions {
  enableProxy?: boolean;
  enableInterceptors?: boolean;
}

@Global()
@Module({})
export class ObservabilityModule {
  static forRoot(
    cfg: Env,
    options: ObservabilityModuleOptions = {}
  ): DynamicModule {
    const providers: Provider[] = [
      { provide: "OBSERVABILITY_CONFIG", useValue: cfg },
      OtelProxyService,
      OtelAuthGuard,
    ];
    const controllers: Type<unknown>[] = [];

    if (options.enableProxy !== false) {
      controllers.push(OtelController);
    }

    if (options.enableInterceptors !== false) {
      providers.push(
        {
          provide: APP_INTERCEPTOR,
          useClass: LoggingInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: MetricsInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: TracingInterceptor,
        }
      );
    }

    return {
      module: ObservabilityModule,
      providers,
      controllers,
      exports: [OtelProxyService, OtelAuthGuard],
    };
  }
}
