import { DynamicModule, Global, Module } from "@nestjs/common";
import { NotificationConsumerService } from "./notification.consumer.service";
import { NotificationProcessorService } from "./notification.processor.service";

@Global()
@Module({})
export class NotificationModule {
  static forRoot(): DynamicModule {
    return {
      module: NotificationModule,
      providers: [NotificationProcessorService, NotificationConsumerService],
      exports: [NotificationProcessorService],
    };
  }
}
