import { z } from "zod";

export enum EmailTemplateType {
  WELCOME = "welcome",
  OVERDUE_PAYMENT = "overdue_payment",
}

export const BaseEmailSchema = z.object({
  to: z.string().email(),
  toName: z.string().optional(),
});

export const WelcomeEmailSchema = BaseEmailSchema.extend({
  name: z.string(),
  activationUrl: z.string().url().optional(),
});

export const OverduePaymentSchema = BaseEmailSchema.extend({
  customerName: z.string(),
  amount: z.coerce.number(),
  dueDate: z.string(),
  paymentLink: z.string().url().optional(),
});

export type WelcomeEmailPayload = z.infer<typeof WelcomeEmailSchema>;
export type OverduePaymentPayload = z.infer<typeof OverduePaymentSchema>;

export type EmailPayload = WelcomeEmailPayload | OverduePaymentPayload;
