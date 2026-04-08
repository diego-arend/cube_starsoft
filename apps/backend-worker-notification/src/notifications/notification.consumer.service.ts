import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { RabbitMqService, createSubscriber } from "@turborepo/messaging";
import {
  NOTIFICATIONS_EXCHANGE,
  NOTIFICATIONS_EMAIL_QUEUE,
  NOTIFICATIONS_EMAIL_BASE,
  DEFAULT_RETRY_MAX,
  DEFAULT_RETRY_DELAY_MS,
} from "@turborepo/messaging";
import { NotificationProcessorService } from "./notification.processor.service";
import { metrics, Counter } from "@opentelemetry/api";

@Injectable()
export class NotificationConsumerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumerService.name);
  private counter: Counter;

  constructor(
    private readonly rabbitSvc: RabbitMqService,
    private readonly processor: NotificationProcessorService
  ) {
    const meter = metrics.getMeter("backend-worker-notification");
    this.counter = meter.createCounter("worker_jobs_total", {
      description: "Total number of jobs processed",
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log("Initializing notification consumer");
    const sub = createSubscriber(this.rabbitSvc, {
      exchange: NOTIFICATIONS_EXCHANGE,
      queue: NOTIFICATIONS_EMAIL_QUEUE,
      routingKey: `${NOTIFICATIONS_EMAIL_BASE}.#`,
      retry: {
        baseName: NOTIFICATIONS_EMAIL_BASE,
        maxRetries: DEFAULT_RETRY_MAX,
        retryDelayMs: DEFAULT_RETRY_DELAY_MS,
      },
    });

    await sub.subscribe(async (payload: unknown, context) => {
      try {
        await this.processor.process(payload, context?.messageId);
        this.counter.add(1, { status: "success" });
      } catch (err: unknown) {
        this.counter.add(1, { status: "error" });
        this.logger.error("Failed to process notification: " + String(err));
        throw err; // let Subscriber trigger retry/DLQ
      }
    });
  }
}
