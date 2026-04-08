import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { Env } from "@turborepo/config";

export function createTransporter(
  cfg: Env
): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  // SMTP settings from cfg

  const host =
    cfg.SMTP_HOST ??
    (process.env.NODE_ENV === "development" ? "localhost" : undefined);

  const port =
    cfg.SMTP_PORT ??
    (process.env.NODE_ENV === "development" ? 1025 : undefined);
  const secure = cfg.SMTP_SECURE ?? false;
  const auth = cfg.SMTP_USER
    ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASSWORD }
    : undefined;

  if (!host || !port) {
    // nodemailer will throw later if host/port undefined; allow development defaults above
    // but guard and throw for clarity
    throw new Error(
      "SMTP_HOST and SMTP_PORT are required to create transporter"
    );
  }

  const transportOptions: SMTPTransport.Options = {
    host,
    port: Number(port),
    secure: Boolean(secure),
    auth,
  } as SMTPTransport.Options;

  return nodemailer.createTransport(transportOptions);
}
