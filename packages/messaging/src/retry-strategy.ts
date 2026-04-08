import { RabbitMqService } from "./rabbitmq/rabbitmq.service";

export interface RetryConfig {
  baseName: string; // base name for queue + dlx
  maxRetries?: number;
  retryDelayMs?: number; // TTL for retry queue
}

export async function setupRetryDLQ(svc: RabbitMqService, cfg: RetryConfig) {
  const base = cfg.baseName;
  const retries = cfg.maxRetries ?? 3;
  const retryDelay = cfg.retryDelayMs ?? 5000;
  const dlx = `${base}.dlx`;
  const dlq = `${base}.dlq`;
  const retryExchange = `${base}.retry`;
  const retryQueue = `${base}.retry_q`;

  await svc.assertExchange(dlx, "fanout", { durable: true });
  await svc.assertQueue(dlq, { durable: true });
  // DLX to route to DLQ
  // retry exchange and retry queue setup
  await svc.assertExchange(retryExchange, "direct", { durable: true });
  await svc.assertQueue(retryQueue, {
    durable: true,
    arguments: {
      // after TTL expires, dead-letter to main DLX (routing via exchange)
      "x-dead-letter-exchange": dlx,
      "x-message-ttl": retryDelay,
    },
  });
  return {
    dlx,
    dlq,
    retryExchange,
    retryQueue,
    retries,
  };
}
