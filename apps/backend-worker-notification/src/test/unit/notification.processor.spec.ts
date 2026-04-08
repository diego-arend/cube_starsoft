import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock the email package before importing the service so templates are not loaded
vi.mock("@turborepo/email", () => {
  const cls = class {
    init = vi.fn(async () => undefined);
    close = vi.fn(async () => undefined);
    sendTemplate = vi.fn(async () => undefined);
  };
  return {
    EmailService: cls,
    default: cls,
    EmailTemplateType: {
      WELCOME: "welcome",
      OVERDUE_PAYMENT: "overdue_payment",
    },
  };
});

import type { EmailService } from "@turborepo/email";
import { EmailTemplateType } from "@turborepo/email";
import { NotificationProcessorService } from "../../notifications/notification.processor.service";
import type { RedisService } from "@turborepo/redis";

describe("NotificationProcessorService", () => {
  let processor: NotificationProcessorService;
  const emailMock: Partial<EmailService> = {
    sendTemplate: vi.fn(async () => undefined),
    init: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  const redisMock: Partial<RedisService> = {
    setNx: vi.fn(async () => "OK"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new NotificationProcessorService(
      emailMock as unknown as EmailService,
      redisMock as unknown as RedisService
    );
  });

  it("initializes the email service on module init", async () => {
    await processor.onModuleInit();
    expect(emailMock.init).toHaveBeenCalled();
  });

  it("sends welcome email when payload has type welcome", async () => {
    const payload = {
      type: EmailTemplateType.WELCOME,
      to: "a@a.com",
      name: "A",
    };
    await processor.process(payload);
    expect(emailMock.sendTemplate).toHaveBeenCalledWith(
      EmailTemplateType.WELCOME,
      payload
    );
  });

  it("infers welcome email when payload contains name", async () => {
    const payload = { to: "a@a.com", name: "A" };
    await processor.process(payload);
    expect(emailMock.sendTemplate).toHaveBeenCalledWith(
      EmailTemplateType.WELCOME,
      payload
    );
  });

  it("skips processing if messageId is already in redis (idempotency)", async () => {
    (redisMock.setNx as unknown as Mock).mockResolvedValue(null); // Already exists

    const payload = {
      type: EmailTemplateType.WELCOME,
      to: "a@a.com",
    };
    await processor.process(payload, "duplicate-id");

    expect(redisMock.setNx).toHaveBeenCalledWith(
      expect.stringContaining("duplicate-id"),
      "processing",
      expect.any(Number)
    );
    expect(emailMock.sendTemplate).not.toHaveBeenCalled();
  });
});
