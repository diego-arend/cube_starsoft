import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { DatabaseModule, UserEntity } from "@turborepo/database";
import { createNestConfigModule, typedEnv } from "./env";
import { RedisModule, RedisService } from "@turborepo/redis";
import { LoggingModule } from "@turborepo/logging";
import { RateLimitModule } from "@turborepo/rate-limit";
import { CacheModule } from "@nestjs/cache-manager";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";
import { DocumentModule } from "./document/document.module";
import { AssistantModule } from "./assistant/assistant.module";
import { AgentModule } from "./agent/agent.module";
import { HttpExceptionFilter } from "./shared/filters/http-exception.filter";
import { MessagingModule } from "@turborepo/messaging";
import { BucketModule } from "@turborepo/bucket";
import { redisStoreFactory } from "./shared/cache/redis-store.factory";
import { ObservabilityModule } from "@turborepo/observability/nest";
@Module({
  imports: [
    createNestConfigModule(),
    ObservabilityModule.forRoot(typedEnv),
    LoggingModule.forRoot(typedEnv),
    RedisModule.forRoot(typedEnv),
    RateLimitModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: redisStoreFactory,
      inject: [RedisService],
    }),
    DatabaseModule.forRoot(typedEnv),
    DatabaseModule.forFeature([UserEntity]),
    BucketModule.forRoot(typedEnv),
    AuthModule.forRoot(),
    UserModule.forRoot(),
    // Messaging (RabbitMQ) for background notifications
    // Provides `RabbitMqService` used to publish events to queues
    MessagingModule.forRoot(typedEnv),
    DocumentModule,
    // Assistant module for AI chat support
    AssistantModule,
    AgentModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
