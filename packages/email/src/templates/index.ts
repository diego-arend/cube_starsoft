import Handlebars from "handlebars";
import welcomeHtml from "./welcome.html.hbs?raw";
import overdueHtml from "./overdue-payment.html.hbs?raw";
import { EmailTemplateType } from "../types";
import type { WelcomeEmailPayload, OverduePaymentPayload } from "../types";

const compiledCache: Partial<
  Record<EmailTemplateType, Handlebars.TemplateDelegate>
> = {
  [EmailTemplateType.WELCOME]: Handlebars.compile(welcomeHtml),
  [EmailTemplateType.OVERDUE_PAYMENT]: Handlebars.compile(overdueHtml),
};

function getTemplate(type: EmailTemplateType) {
  const fn = compiledCache[type];
  if (!fn) throw new Error(`Template not found: ${String(type)}`);
  return fn as Handlebars.TemplateDelegate;
}

const defaultSubjects = {
  [EmailTemplateType.WELCOME]: "Bem-vindo!",
  [EmailTemplateType.OVERDUE_PAYMENT]: "Pagamento vencido",
};

export function renderTemplate(
  type: EmailTemplateType,
  data: WelcomeEmailPayload | OverduePaymentPayload
) {
  const fn = getTemplate(type);
  if (!fn) throw new Error(`Template not found: ${type}`);
  return fn(data);
}

export function getDefaultSubject(type: EmailTemplateType) {
  return defaultSubjects[type] ?? "";
}
