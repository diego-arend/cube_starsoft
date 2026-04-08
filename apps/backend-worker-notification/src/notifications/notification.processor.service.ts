import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { EmailService, EmailTemplateType } from "@turborepo/email";
import { RedisService } from "@turborepo/redis";
import type {
  WelcomeEmailPayload,
  OverduePaymentPayload,
} from "@turborepo/email";

@Injectable()
export class NotificationProcessorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationProcessorService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly redis: RedisService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.emailService.init();
    } catch (err) {
      this.logger.warn("EmailService initialization failed: " + String(err));
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.emailService.close();
    } catch (err) {
      this.logger.warn("EmailService close failed: " + String(err));
    }
  }

  async process(payload: unknown, messageId?: string): Promise<void> {
    // Check for idempotency if messageId is provided
    if (messageId) {
      const lockKey = `idempotency:notification:${messageId}`;
      const isLocked = await this.redis.setNx(lockKey, "processing", 86400); // 24h TTL

      if (!isLocked) {
        this.logger.warn(
          `Ignoring duplicate notification (already processed or processing): ${messageId}`
        );
        return;
      }
    }

    // Payload is expected to contain a `type` field and payload fields required
    // by `EmailService.sendTemplate`.
    const obj = (payload as Record<string, unknown> | undefined) ?? undefined;
    const type = obj && (obj.type as EmailTemplateType | undefined);

    if (!type) {
      // try to infer type
      if (
        obj &&
        (typeof obj.name === "string" || typeof obj.activationUrl === "string")
      ) {
        // welcome
        const p = obj as unknown as WelcomeEmailPayload;
        await this.emailService.sendTemplate(EmailTemplateType.WELCOME, p);
        this.logger.log("Notification processed successfully (welcome)");
        return;
      }

      if (obj && typeof obj.customerName === "string") {
        const p = obj as unknown as OverduePaymentPayload;
        await this.emailService.sendTemplate(
          EmailTemplateType.OVERDUE_PAYMENT,
          p
        );
        return;
      }

      throw new Error("Unknown notification type — payload missing `type`");
    }

    if (type === EmailTemplateType.WELCOME) {
      await this.emailService.sendTemplate(
        EmailTemplateType.WELCOME,
        obj as unknown as WelcomeEmailPayload
      );
      this.logger.log("Notification processed successfully (welcome)");
      return;
    }

    if (type === EmailTemplateType.OVERDUE_PAYMENT) {
      await this.emailService.sendTemplate(
        EmailTemplateType.OVERDUE_PAYMENT,
        obj as unknown as OverduePaymentPayload
      );
      this.logger.log("Notification processed successfully (overdue)");
      return;
    }

    // Fallback: try as union
    await this.emailService.sendTemplate(
      type,
      obj as unknown as WelcomeEmailPayload | OverduePaymentPayload
    );
    this.logger.log("Notification processed successfully (fallback)");
  }
}
