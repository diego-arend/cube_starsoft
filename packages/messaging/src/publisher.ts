import { RabbitMqService } from "./rabbitmq/rabbitmq.service";
import { Options } from "amqplib";
import { Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { propagation, context } from "@opentelemetry/api";

const logger = new Logger("Publisher");

export interface PublisherOptions {
  exchange?: string;
  exchangeType?: string;
  routingKey?: string;
  persistent?: boolean;
  messageTTL?: number; // ms
}

export class Publisher {
  constructor(
    private readonly svc: RabbitMqService,
    private readonly opts: PublisherOptions = {}
  ) {}

  async publish(payload: unknown, routingKey?: string, opts?: Options.Publish) {
    const exchange = this.opts.exchange || "default";
    await this.svc.assertExchange(exchange, this.opts.exchangeType || "topic", {
      durable: true,
    });
    const key = routingKey ?? this.opts.routingKey ?? "";
    const content = Buffer.from(JSON.stringify(payload));

    const headers = { ...(opts?.headers || {}) };

    // Inject OpenTelemetry context for distributed tracing
    propagation.inject(context.active(), headers);

    const publishOptions: Options.Publish = {
      ...opts,
      persistent: opts?.persistent ?? this.opts.persistent ?? true,
      messageId: opts?.messageId ?? uuidv4(),
      headers,
    };
    if (this.opts.messageTTL) {
      publishOptions.expiration = `${this.opts.messageTTL}`;
    }

    logger.log(
      `Publishing message to exchange=${exchange} routingKey=${key} size=${content.length} persistent=${publishOptions.persistent} ttl=${publishOptions.expiration ?? "none"} messageId=${publishOptions.messageId}`
    );

    try {
      await this.svc.publish(exchange, key, content, publishOptions);
      logger.log(
        `Publish confirmed for exchange=${exchange} routingKey=${key} messageId=${publishOptions.messageId}`
      );
    } catch (err: unknown) {
      logger.warn(
        `Publish failed for exchange=${exchange} routingKey=${key}: ${String(err)}`
      );
      throw err;
    }
  }
}

export function createPublisher(svc: RabbitMqService, opts?: PublisherOptions) {
  return new Publisher(svc, opts);
}
