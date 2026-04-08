import { describe, it, expect, vi } from "vitest";
import { renderTemplate } from "../../templates";
import { EmailTemplateType } from "../../types";
import type { WelcomeEmailPayload } from "../../types";
import type nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { Env } from "@turborepo/config";

describe("templates", () => {
  it("renders welcome template", () => {
    const html = renderTemplate(EmailTemplateType.WELCOME, {
      to: "a@b.com",
      name: "X",
    });
    expect(html).toContain("Bem-vindo");
  });

  it("renders overdue payment template", () => {
    const html = renderTemplate(EmailTemplateType.OVERDUE_PAYMENT, {
      to: "a@b.com",
      customerName: "X",
      amount: 123,
      dueDate: new Date().toISOString(),
    });
    expect(html).toContain("vencida");
  });

  it("email service validates payload and sends email", async () => {
    const sendMail = vi.fn().mockResolvedValue({ accepted: ["a@b.com"] });
    const transporter = {
      sendMail,
      verify: vi.fn().mockResolvedValue(true),
    } as unknown as nodemailer.Transporter<SMTPTransport.SentMessageInfo>;

    const mockCfg = {
      SMTP_FROM: "noreply@example.com",
    } as unknown as Env;

    const { EmailService } = await import("../../email.service");
    const svc = new EmailService(transporter, mockCfg);
    await svc.init();
    await svc.sendTemplate(EmailTemplateType.WELCOME, {
      to: "a@b.com",
      name: "X",
    });
    expect(sendMail).toHaveBeenCalled();
  });

  it("email service throws on invalid payload", async () => {
    const sendMail = vi.fn().mockResolvedValue({ accepted: ["a@b.com"] });
    const transporter = {
      sendMail,
      verify: vi.fn().mockResolvedValue(true),
    } as unknown as nodemailer.Transporter<SMTPTransport.SentMessageInfo>;

    const mockCfg = {
      SMTP_FROM: "noreply@example.com",
    } as unknown as Env;

    const { EmailService } = await import("../../email.service");
    const svc = new EmailService(transporter, mockCfg);
    await svc.init();
    // intentionally pass an invalid payload to test runtime validation; the
    // TypeScript compiler would normally block this, so cast it to any.

    await expect(
      svc.sendTemplate(
        EmailTemplateType.WELCOME,
        {} as unknown as WelcomeEmailPayload
      )
    ).rejects.toThrow();
    expect(sendMail).not.toHaveBeenCalled();
  });
});
