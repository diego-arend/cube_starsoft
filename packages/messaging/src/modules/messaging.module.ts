import { Module, Global, DynamicModule } from "@nestjs/common";
import type { Env } from "@turborepo/config";
import { RabbitMqService } from "../rabbitmq/rabbitmq.service";

@Global()
@Module({})
export class MessagingModule {
  private static _initialized = false;

  static forRoot(cfg: Env): DynamicModule {
    const providers = [
      {
        provide: RabbitMqService,
        useFactory: () => new RabbitMqService(cfg),
      },
    ];
    if (!MessagingModule._initialized) {
      MessagingModule._initialized = true;
      return {
        module: MessagingModule,
        providers,
        exports: providers,
      };
    }
    return {
      module: MessagingModule,
    };
  }
}
