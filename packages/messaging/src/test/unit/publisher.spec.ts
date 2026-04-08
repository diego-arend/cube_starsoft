import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPublisher } from "../../../dist/index.js";

const mockChannel = {
  assertExchange: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn(
    (
      ex: string,
      rk: string,
      content: Buffer,
      opts: unknown,
      cb?: (err?: unknown) => void
    ) => cb && cb(undefined)
  ),
};
const mockConnection = {
  createConfirmChannel: vi.fn().mockResolvedValue(mockChannel),
  on: vi.fn(),
};

vi.mock("amqplib", () => ({
  default: { connect: vi.fn(async () => mockConnection) },
}));

describe("Publisher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes a JSON payload", async () => {
    const { RabbitMqService } = await import("../../../dist/index.js");
    const svc = new RabbitMqService();
    // inject channel
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
    const p = createPublisher(svc, { exchange: "ex1", routingKey: "rk" });
    await p.publish({ hello: "world" });
    expect(mockChannel.assertExchange).toHaveBeenCalledWith("ex1", "topic", {
      durable: true,
    });
    expect(mockChannel.publish).toHaveBeenCalled();
  });
});
