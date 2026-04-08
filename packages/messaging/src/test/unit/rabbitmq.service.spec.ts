import { describe, it, expect, vi, beforeEach } from "vitest";

// Basic mocking of amqplib
const mockChannel = {
  assertExchange: vi.fn().mockResolvedValue(undefined),
  assertQueue: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn(
    (
      ex: string,
      rk: string,
      content: Buffer,
      opts: unknown,
      cb?: (err?: unknown) => void
    ) => cb && cb(undefined)
  ),
  consume: vi.fn(() => Promise.resolve({ consumerTag: "ctag" })),
  ack: vi.fn(),
  nack: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockConnection = {
  createConfirmChannel: vi.fn().mockResolvedValue(mockChannel),
  close: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

vi.mock("amqplib", () => ({
  default: { connect: vi.fn(async () => mockConnection) },
}));

describe("RabbitMqService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connects and publishes", async () => {
    const { RabbitMqService } = await import("../../../dist/index.js");
    const svc = new RabbitMqService();
    // inject mock channel/connection
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
    await svc.assertExchange("ex1", "topic");
    await svc.publish(
      "ex1",
      "rk",
      Buffer.from(JSON.stringify({ ok: true })),
      {}
    );
    expect(mockChannel.publish).toHaveBeenCalled();
    await svc.close();
    expect(mockChannel.close).toHaveBeenCalled();
    expect(mockConnection.close).toHaveBeenCalled();
  });
});
