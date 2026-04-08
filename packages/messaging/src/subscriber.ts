import { RabbitMqService } from "./rabbitmq/rabbitmq.service";
import { setupRetryDLQ, RetryConfig } from "./retry-strategy";
import { Options, ConsumeMessage } from "amqplib";
import { propagation, context, trace, SpanKind } from "@opentelemetry/api";

// Helper type for optional waitForChannel hook on the service
type WaitForChannel = { waitForChannel?: () => Promise<boolean> };

export interface SubscriberOptions {
  exchange?: string;
  exchangeType?: string;
  queue?: string;
  routingKey?: string;
  noAck?: boolean;
  retry?: RetryConfig;
  /**
   * Maximum number of messages processed concurrently by this subscriber.
   * Should match the RabbitMQ prefetch count so the broker never dispatches
   * more messages than the process can handle at once.
   *
   * With horizontal replicas each pod applies this limit independently:
   *   total throughput = maxConcurrency × replica count
   *
   * Defaults to undefined (no explicit cap — relies solely on prefetch).
   */
  maxConcurrency?: number;
}

export class Subscriber {
  constructor(
    private readonly svc: RabbitMqService,
    private readonly opts: SubscriberOptions = {}
  ) {}

  async subscribe(
    onMessage: (
      payload: unknown,
      context?: { messageId?: string; headers?: Record<string, unknown> }
    ) => Promise<void> | void,
    opts?: Options.Consume
  ) {
    // Ensure the underlying RabbitMQ channel is available before attempting
    // to assert exchanges/queues. This prevents startup crashes when
    // RabbitMQ is not yet reachable and the service will retry internally.
    const svcWithWait = this.svc as unknown as WaitForChannel;
    if (typeof svcWithWait.waitForChannel === "function") {
      const ready = await svcWithWait.waitForChannel();
      if (!ready) {
        // If channel is not ready within the timeout, schedule retries in
        // background and return early so the application can continue
        // starting up while we poll for availability.
        const pollMs = 2000;
        const iv = setInterval(async () => {
          const ok = await svcWithWait.waitForChannel!();
          if (ok) {
            clearInterval(iv);
            // try subscribing again now that channel is available
            await this.subscribe(onMessage, opts);
          }
        }, pollMs);
        return;
      }
    }
    const exchange = this.opts.exchange ?? "default";
    const queue = this.opts.queue ?? `queue.${exchange}`;
    await this.svc.assertExchange(exchange, this.opts.exchangeType ?? "topic", {
      durable: true,
    });
    await this.svc.assertQueue(queue, { durable: true });
    let retrySetup: Awaited<ReturnType<typeof setupRetryDLQ>> | null = null;
    if (this.opts.retry)
      retrySetup = await setupRetryDLQ(this.svc, this.opts.retry);

    // Concurrency semaphore — caps how many messages are processed in parallel
    // per subscriber instance. Pair with an equal RabbitMQ prefetch so the
    // broker never dispatches more messages than this process can handle.
    // Each replica applies the limit independently:
    //   total throughput = maxConcurrency × replica count
    const maxConcurrency = this.opts.maxConcurrency;
    let activeSlots = 0;
    const pendingSlots: Array<() => void> = [];
    const acquireSlot = (): Promise<void> => {
      if (!maxConcurrency || activeSlots < maxConcurrency) {
        activeSlots++;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        pendingSlots.push(() => {
          activeSlots++;
          resolve();
        });
      });
    };
    const releaseSlot = (): void => {
      activeSlots--;
      const next = pendingSlots.shift();
      if (next) next();
    };

    await this.svc.subscribe(
      queue,
      async (raw: ConsumeMessage | null) => {
        // raw content will be Buffer
        if (!raw) return;

        // Block until a concurrency slot is available (no-op when maxConcurrency is unset)
        await acquireSlot();

        // Extract OpenTelemetry context from message headers
        const parentContext = propagation.extract(
          context.active(),
          raw.properties?.headers || {}
        );

        const tracer = trace.getTracer("messaging-subscriber");
        const spanName = `amqp.consume ${queue}`;

        const ctxRun = context.with(parentContext, async () => {
          await tracer.startActiveSpan(
            spanName,
            { kind: SpanKind.CONSUMER },
            async (span) => {
              let content = "";
              try {
                content = raw.content ? raw.content.toString("utf8") : "";
                const parsed = content
                  ? (JSON.parse(content) as unknown)
                  : null;
                const msgContext = {
                  messageId: raw.properties?.messageId,
                  headers: raw.properties?.headers as Record<string, unknown>,
                };

                span.setAttributes({
                  "messaging.system": "rabbitmq",
                  "messaging.destination": queue,
                  "messaging.message_id": raw.properties?.messageId || "",
                });

                await Promise.resolve(onMessage(parsed, msgContext));
                span.end();
              } catch (err: unknown) {
                span.recordException(err as Error);
                span.setStatus({ code: 1, message: String(err) });
                span.end();

                // manage retry flow if configured
                if (retrySetup) {
                  const headers =
                    (
                      (raw.properties || {}) as unknown as {
                        headers?: Record<string, unknown>;
                      }
                    )?.headers ?? {};
                  const tries = (headers["x-retries"] as number) || 0;
                  if (tries < retrySetup.retries) {
                    const newHeaders = { ...headers, "x-retries": tries + 1 };
                    await this.svc.publish(
                      retrySetup.retryExchange,
                      this.opts.routingKey || "#",
                      Buffer.from(content),
                      {
                        headers: newHeaders,
                        messageId: raw.properties?.messageId,
                      }
                    );
                    // Ack original message so it doesn't re-run; mark to avoid double-ack
                    (
                      raw as unknown as { __acknowledged: boolean }
                    ).__acknowledged = true;
                    this.svc["channel"]!.ack(raw);
                    return;
                  }
                  // move to DLQ
                  await this.svc.publish(
                    retrySetup.dlx,
                    "",
                    Buffer.from(content),
                    {
                      headers,
                      messageId: raw.properties?.messageId,
                    }
                  );
                  (
                    raw as unknown as { __acknowledged: boolean }
                  ).__acknowledged = true;
                  this.svc["channel"]!.ack(raw);
                  return;
                }
                // default: rethrow so underlying service will nack
                throw err;
              }
            }
          );
        });
        try {
          await ctxRun;
        } finally {
          // Always release the concurrency slot, even on error or retry/DLQ paths
          releaseSlot();
        }
      },
      opts
    );
    // bind queue to exchange with routing key
    if (this.opts.routingKey) {
      await this.svc.bindQueue(queue, exchange, this.opts.routingKey);
    }
  }
}

export const createSubscriber = (
  svc: RabbitMqService,
  opts?: SubscriberOptions
) => new Subscriber(svc, opts);
