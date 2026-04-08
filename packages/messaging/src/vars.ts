// Messaging naming constants for notification exchange, queues, and routing keys
export const NOTIFICATIONS_EXCHANGE = "notifications";

// Email notifications base and routing keys
export const NOTIFICATIONS_EMAIL_BASE = "notifications.email";
export const ROUTING_KEY_EMAIL_WELCOME = `${NOTIFICATIONS_EMAIL_BASE}.welcome`;
export const ROUTING_KEY_EMAIL_OVERDUE_PAYMENT = `${NOTIFICATIONS_EMAIL_BASE}.overdue_payment`;

// Queue name for this worker (useful to avoid collisions from other consumers)
export const NOTIFICATIONS_EMAIL_QUEUE = `${NOTIFICATIONS_EMAIL_BASE}.backend-worker-notification`;

// Retry defaults
export const DEFAULT_RETRY_MAX = 3;
export const DEFAULT_RETRY_DELAY_MS = 5000;

export type NotificationRoutingKey =
  | typeof ROUTING_KEY_EMAIL_WELCOME
  | typeof ROUTING_KEY_EMAIL_OVERDUE_PAYMENT;

// Assistant async processing
export const ASSISTANT_EXCHANGE = "assistant";

export const ASSISTANT_QUERY_BASE = "assistant.query";
export const ASSISTANT_QUERY_QUEUE = "assistant.query.worker";

export const ASSISTANT_RESPONSE_BASE = "assistant.response";
// Fila exclusiva por instância do backend (auto-delete) para receber chunks via fanout
export const ASSISTANT_RESPONSE_QUEUE_PREFIX = "assistant.response.backend";
