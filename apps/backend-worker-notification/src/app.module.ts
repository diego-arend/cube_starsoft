import { Module, OnApplicationBootstrap, Logger } from "@nestjs/common";
import { createNestConfigModule, typedEnv } from "./env";
import { LoggingModule } from "@turborepo/logging";
import { MessagingModule, RabbitMqService } from "@turborepo/messaging";
import { EmailModule, EmailService } from "@turborepo/email";
import { RedisModule } from "@turborepo/redis";
import { DatabaseModule } from "@turborepo/database";
import { NotificationModule } from "./notifications/notification.module";
import { AssistantWorkerModule } from "./assistant-worker/assistant-worker.module";
import { ObservabilityModule } from "@turborepo/observability/nest";

@Module({
  imports: [
    createNestConfigModule(),
    ObservabilityModule.forRoot(typedEnv, { enableProxy: false }),
    LoggingModule.forRoot(typedEnv),
    MessagingModule.forRoot(typedEnv),
    RedisModule.forRoot(typedEnv),
    DatabaseModule.forRoot(typedEnv),
    EmailModule.forRoot(typedEnv),
    NotificationModule.forRoot(),
    AssistantWorkerModule.forRoot(),
  ],
})
export class AppModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly emailService: EmailService
  ) {}

  async onApplicationBootstrap() {
    try {
      const isRabbitConnected = await this.rabbitMqService.waitForChannel(5000);
      if (isRabbitConnected) {
        this.logger.log("RabbitMQ connection established successfully");
      } else {
        this.logger.error("Failed to establish RabbitMQ connection within 5s");
      }
    } catch (error) {
      this.logger.error("Error checking RabbitMQ connection", error);
    }

    try {
      await this.emailService.init();
      this.logger.log("SMTP connection established successfully");
    } catch (error) {
      this.logger.error("Failed to establish SMTP connection", error);
    }
  }
}
