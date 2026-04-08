import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSubscriber } from "../../../dist/index.js";

const mockChannel = {
  assertExchange: vi.fn().mockResolvedValue(undefined),
  assertQueue: vi.fn().mockResolvedValue(undefined),
  bindQueue: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn(
    (
      exchange: string,
      rk: string,
      buf: Buffer,
      opts: unknown,
      cb?: (err?: unknown) => void
    ) => {
      // simulate confirm publish callback
      if (typeof cb === "function") cb(undefined);
      return true;
    }
  ),
  consume: vi.fn((queue: string, cb: (msg: unknown) => unknown) => {
    // Simulate delivering one message
    setTimeout(() => cb({ content: Buffer.from(JSON.stringify({ a: 1 })) }), 0);
    return Promise.resolve({ consumerTag: "ctag" });
  }),
  ack: vi.fn(),
  nack: vi.fn(),
};
const mockConnection = {
  createConfirmChannel: vi.fn().mockResolvedValue(mockChannel),
  on: vi.fn(),
};

vi.mock("amqplib", () => ({
  default: { connect: vi.fn(async () => mockConnection) },
}));

describe("Subscriber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consumes a message and calls handler", async () => {
    const { RabbitMqService } = await import("../../../dist/index.js");
    const svc = new RabbitMqService();
    (
      svc as unknown as {
        channel?: typeof mockChannel;
        conn?: typeof mockConnection;
      }
    ).channel = mockChannel;
    (
      svc as unknown as {
        channel?: typeof mockChannel;
        conn?: typeof mockConnection;
      }
    ).conn = mockConnection;
    const sub = createSubscriber(svc, {
      exchange: "ex1",
      queue: "q1",
      routingKey: "rk",
    });
    const handler = vi.fn(async (payload: unknown) => {
      expect(payload as { a: number }).toEqual({ a: 1 });
    });
    await sub.subscribe(handler);
    // wait a tick for consume simulation
    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalled();
    expect(mockChannel.bindQueue).toHaveBeenCalledWith(
      "q1",
      "ex1",
      "rk",
      undefined
    );
  });

  it("acks once when handler triggers retry flow", async () => {
    const { RabbitMqService } = await import("../../../dist/index.js");
    const svc = new RabbitMqService();
    (
      svc as unknown as {
        channel?: typeof mockChannel;
        conn?: typeof mockConnection;
      }
    ).channel = mockChannel;
    (
      svc as unknown as {
        channel?: typeof mockChannel;
        conn?: typeof mockConnection;
      }
    ).conn = mockConnection;

    // configure subscriber with retry enabled so handler throwing will trigger retry
    const sub = createSubscriber(svc, {
      exchange: "ex1",
      queue: "q1",
      routingKey: "rk",
      retry: {
        baseName: "bn",
        maxRetries: 1,
        retryDelayMs: 10,
      },
    });

    const handler = vi.fn(async () => {
      throw new Error("boom");
    });

    await sub.subscribe(handler);
    // wait a tick for consume and retry flow
    await new Promise((r) => setTimeout(r, 20));

    // assert that the channel ack was called exactly once (no double ack)
    expect(mockChannel.ack).toHaveBeenCalledTimes(1);
  });

  it("preserves messageId on retry republish", async () => {
    const { RabbitMqService } = await import("../../../dist/index.js");
    const svc = new RabbitMqService();
    (
      svc as unknown as {
        channel?: typeof mockChannel;
        conn?: typeof mockConnection;
      }
    ).channel = mockChannel;
    (
      svc as unknown as {
        channel?: typeof mockChannel;
        conn?: typeof mockConnection;
      }
    ).conn = mockConnection;

    // temporarily override consume to deliver a message with messageId and x-retries=0
    const originalConsume = mockChannel.consume;
    const messageId = "orig-id";
    mockChannel.consume = vi.fn(
      (queue: string, cb: (msg: unknown) => unknown) => {
        setTimeout(
          () =>
            cb({
              content: Buffer.from(JSON.stringify({ a: 1 })),
              properties: { messageId, headers: { "x-retries": 0 } },
            }),
          0
        );
        return Promise.resolve({ consumerTag: "ctag" });
      }
    );

    const sub = createSubscriber(svc, {
      exchange: "ex1",
      queue: "q1",
      routingKey: "rk",
      retry: {
        baseName: "bn",
        maxRetries: 1,
        retryDelayMs: 10,
      },
    });

    const handler = vi.fn(async () => {
      throw new Error("boom");
    });

    await sub.subscribe(handler);
    // wait for retry publish to occur
    await new Promise((r) => setTimeout(r, 20));

    expect(mockChannel.publish).toHaveBeenCalled();
    const calls = (
      mockChannel.publish as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls;

    // Find the publish call that went to the retry exchange
    const found = calls.find(
      (c) => c[3] && (c[3] as { messageId: string }).messageId === messageId
    );
    expect(found).toBeDefined();
    expect(found![3].headers["x-retries"]).toBe(1);

    // restore consume
    mockChannel.consume = originalConsume;
  });
});
