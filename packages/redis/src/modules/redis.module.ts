import { Module, Global, DynamicModule } from "@nestjs/common";
import type { Env } from "@turborepo/config";
import { RedisService } from "../redis.service";
import { FallbackService } from "../fallback.service";

@Global()
@Module({})
export class RedisModule {
  // Track whether forRoot() has already been invoked to prevent
  // registering duplicate providers if `forRoot()` is called multiple
  // times across the app.
  private static _initialized = false;

  static forRoot(cfg: Env): DynamicModule {
    const providers = [
      FallbackService,
      {
        provide: RedisService,
        useFactory: (fallback: FallbackService) =>
          new RedisService(fallback, cfg),
        inject: [FallbackService],
      },
    ];

    const imports: any[] = [];

    if (!RedisModule._initialized) {
      RedisModule._initialized = true;
      // First call: register and export providers as usual.
      return {
        module: RedisModule,
        providers,
        exports: providers,
        imports,
      };
    }
    // Subsequent calls: return the module without re-registering providers.
    // This avoids duplicate provider instances.
    return {
      module: RedisModule,
      imports,
    };
  }
}
