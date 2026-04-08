import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

import { NotificationConsumerService } from "../../notifications/notification.consumer.service";
import type { NotificationProcessorService } from "../../notifications/notification.processor.service";
import type { RabbitMqService } from "@turborepo/messaging";

vi.mock("@turborepo/messaging", () => ({
  createSubscriber: vi.fn(() => ({
    subscribe: vi.fn(async () => undefined),
  })),
  NOTIFICATIONS_EXCHANGE: "notifications",
  NOTIFICATIONS_EMAIL_QUEUE: "notifications.email.backend-worker-notification",
  NOTIFICATIONS_EMAIL_BASE: "notifications.email",
  DEFAULT_RETRY_MAX: 3,
  DEFAULT_RETRY_DELAY_MS: 5000,
}));

describe("NotificationConsumerService", () => {
  let svc: NotificationConsumerService;
  const rabbitMock = {} as Partial<RabbitMqService>;
  const processorMock: Partial<NotificationProcessorService> = {
    process: vi.fn(async () => undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new NotificationConsumerService(
      rabbitMock as RabbitMqService,
      processorMock as NotificationProcessorService
    );
  });

  it("subscribes using messaging constants and applies retry", async () => {
    await svc.onModuleInit();
    const { createSubscriber } = await import("@turborepo/messaging");
    expect(createSubscriber).toHaveBeenCalled();
    const createSubMock = createSubscriber as unknown as Mock;
    const created = createSubMock.mock.results[0]?.value as {
      subscribe?: unknown;
    };
    expect(created.subscribe).toBeDefined();
  });

  it("passes messageId to the processor when receiving a message", async () => {
    let capturedCallback:
      | ((payload: unknown, context: { messageId: string }) => Promise<void>)
      | undefined;
    const { createSubscriber } = await import("@turborepo/messaging");
    (createSubscriber as unknown as Mock).mockReturnValue({
      subscribe: vi.fn((cb) => {
        capturedCallback = cb;
      }),
    });

    await svc.onModuleInit();
    const payload = { test: true };
    const context = { messageId: "msg-123" };

    if (!capturedCallback) {
      throw new Error("Callback was not captured");
    }

    await capturedCallback(payload, context);

    expect(processorMock.process).toHaveBeenCalledWith(payload, "msg-123");
  });
});
