import amqplib, {
  Connection,
  ConfirmChannel,
  ConsumeMessage,
  Options,
} from "amqplib";
import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import type { Env } from "@turborepo/config";

export interface RabbitMqOptions {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  prefetch?: number;
}

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private conn?: Connection;
  private channel?: ConfirmChannel;
  private readonly options: RabbitMqOptions;
  private reconnectTimeout = 2000;
  private connected = false;
  private readonly logger = new Logger(RabbitMqService.name);

  constructor(env?: Env) {
    if (!env) {
      // In tests or if someone misconfigures it, we might not have env
      // but the factory in MessagingModule ALWAYS provides it.
      this.options = {} as RabbitMqOptions;
      return;
    }
    // prefer url if present
    this.options = {
      url: env.RABBITMQ_URL || undefined,
      host: env.RABBITMQ_HOST || undefined,
      port: env.RABBITMQ_PORT || undefined,
      username: env.RABBITMQ_USER || undefined,
      password: env.RABBITMQ_PASSWORD || undefined,
      prefetch: env.RABBITMQ_PREFETCH || undefined,
    } as RabbitMqOptions;
    // reconnect timeout override from env (ms)
    const reconnect = env.RABBITMQ_RECONNECT_TIMEOUT_MS ?? undefined;
    if (typeof reconnect === "number") this.reconnectTimeout = reconnect;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async connect(): Promise<void> {
    try {
      if (this.conn && this.connected) return;
      const connUrl = this.getUrl();
      this.logger.log(`Attempting to connect to RabbitMQ at ${connUrl}`);
      this.conn = await amqplib.connect(connUrl);
      this.conn.on("error", (err) => {
        this.logger.warn("RabbitMQ connection error: " + String(err));
        this.connected = false;
        // try reconnect
        setTimeout(() => this.connect().catch(() => {}), this.reconnectTimeout);
      });
      this.conn.on("close", () => {
        this.logger.warn("RabbitMQ connection closed");
        this.connected = false;
        setTimeout(() => this.connect().catch(() => {}), this.reconnectTimeout);
      });
      this.channel = await this.conn.createConfirmChannel();
      if (this.options.prefetch) {
        this.logger.log(`Setting QoS prefetch to ${this.options.prefetch}`);
        await this.channel.prefetch(this.options.prefetch);
      }
      this.connected = true;
      this.logger.log("RabbitMQ connected and channel created");
    } catch (err) {
      this.logger.warn("RabbitMQ connect failed: " + String(err));
      this.connected = false;
      // schedule reconnect
      setTimeout(() => this.connect().catch(() => {}), this.reconnectTimeout);
    }
  }

  /**
   * Wait until the internal channel is available. Useful for callers
   * that need to assert exchanges/queues during startup but RabbitMQ
   * may not yet be reachable. Will poll until `timeoutMs` and then
   * reject if channel is not initialized.
   */
  async waitForChannel(timeoutMs = 10000): Promise<boolean> {
    const interval = 200;
    const start = Date.now();
    while (!this.channel) {
      if (Date.now() - start > timeoutMs) return false;
      await new Promise((res) => setTimeout(res, interval));
    }
    return true;
  }

  async close(): Promise<void> {
    try {
      this.connected = false;
      await this.channel?.close();
      await this.conn?.close();
    } catch {
      // ignore
    }
  }

  private getUrl(): string {
    if (this.options.url) return this.options.url;
    const user = this.options.username || undefined;
    const pass = this.options.password || undefined;
    const host = this.options.host || "127.0.0.1";
    const port = this.options.port || 5672;
    if (user && pass) return `amqp://${user}:${pass}@${host}:${port}`;
    return `amqp://${host}:${port}`;
  }

  async assertExchange(
    exchange: string,
    type: string = "topic",
    options?: Options.AssertExchange
  ): Promise<void> {
    if (!this.channel) throw new Error("RabbitMQ channel not initialized");
    this.logger.log(`Ensuring exchange ${exchange} (type=${type})`);
    await this.channel.assertExchange(exchange, type, options);
  }

  async assertQueue(
    queue: string,
    options?: Options.AssertQueue
  ): Promise<void> {
    if (!this.channel) throw new Error("RabbitMQ channel not initialized");
    this.logger.log(`Ensuring queue ${queue}`);
    await this.channel.assertQueue(queue, options);
  }

  async bindQueue(
    queue: string,
    exchange: string,
    routingKey: string = "",
    args?: Record<string, unknown>
  ): Promise<void> {
    if (!this.channel) throw new Error("RabbitMQ channel not initialized");
    this.logger.log(
      `Binding queue ${queue} to exchange ${exchange} with routingKey=${routingKey}`
    );
    await this.channel.bindQueue(queue, exchange, routingKey, args);
  }

  async publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Options.Publish
  ): Promise<void> {
    if (!this.channel) throw new Error("RabbitMQ channel not initialized");
    this.logger.log(
      `Publishing to exchange=${exchange} routingKey=${routingKey} size=${content.length}`
    );
    return new Promise((resolve, reject) => {
      this.channel!.publish(
        exchange,
        routingKey,
        content,
        options || {},
        (err: unknown) => {
          if (err) {
            this.logger.warn(
              `Publish failed exchange=${exchange} routingKey=${routingKey}: ${String(err)}`
            );
            return reject(err as Error);
          }
          this.logger.log(
            `Publish confirmed exchange=${exchange} routingKey=${routingKey}`
          );
          resolve();
        }
      );
    });
  }

  async subscribe(
    queue: string,
    onMessage: (msg: ConsumeMessage) => Promise<void>,
    options?: Options.Consume
  ) {
    if (!this.channel) throw new Error("RabbitMQ channel not initialized");
    await this.channel.consume(
      queue,
      async (raw: ConsumeMessage | null) => {
        if (!raw) return;
        try {
          await onMessage(raw);
          // avoid double-acking when the handler already acked the message
          if (
            !(raw as unknown as { __acknowledged?: boolean }).__acknowledged
          ) {
            this.channel!.ack(raw);
          }
        } catch {
          this.channel!.nack(raw, false, false);
        }
      },
      options
    );
  }
}
