import type nodemailer from "nodemailer";
import { createTransporter } from "./mailer-client";
import {
  EmailTemplateType,
  WelcomeEmailSchema,
  OverduePaymentSchema,
} from "./types";
import type { WelcomeEmailPayload, OverduePaymentPayload } from "./types";
import { renderTemplate, getDefaultSubject } from "./templates";
import type { Env } from "@turborepo/config";

export class EmailService {
  private transporter?: nodemailer.Transporter;
  private defaultFrom?: string;
  private cfg: Env;

  constructor(transporter?: nodemailer.Transporter, cfg?: Env) {
    this.transporter = transporter;
    if (!cfg) {
      throw new Error("EmailService requires Env configuration");
    }
    this.cfg = cfg;
    this.defaultFrom = this.cfg.SMTP_FROM ?? `noreply@example.com`;
  }

  async init() {
    if (!this.transporter) {
      this.transporter = createTransporter(this.cfg);
    }
    // verify transport
    if (this.transporter && typeof this.transporter.verify === "function") {
      await this.transporter.verify();
    }
  }

  async close() {
    // nodemailer transports may expose close
    if (this.transporter) {
      const maybeCloser = (
        this.transporter as unknown as {
          close?: () => void;
        }
      ).close;
      if (typeof maybeCloser === "function") maybeCloser();
    }
  }

  async sendTemplate(
    type: EmailTemplateType,
    payload: WelcomeEmailPayload | OverduePaymentPayload,
    opts?: { from?: string; subject?: string; to?: string }
  ) {
    if (!this.transporter)
      throw new Error("Transporter not initialized — call init() first");
    // Validate payload for template type
    switch (type) {
      case EmailTemplateType.WELCOME:
        WelcomeEmailSchema.parse(payload);
        break;
      case EmailTemplateType.OVERDUE_PAYMENT:
        OverduePaymentSchema.parse(payload);
        break;
    }

    const html = renderTemplate(type, payload);
    const subject = opts?.subject ?? getDefaultSubject(type);
    const from = opts?.from ?? this.defaultFrom;
    const to = opts?.to ?? payload.to;
    if (!to) throw new Error("Recipient 'to' is required in payload or opts");

    await this.transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
  }
}
