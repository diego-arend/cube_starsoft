import { Writable } from "node:stream";
import { describe, it, expect } from "vitest";
import { createLogger } from "../logger";

describe("createLogger", () => {
  it("creates a pino logger by default", () => {
    const l = createLogger({
      level: "info",
      pretty: false,
      serviceName: "svc",
    });
    expect(l.level).toBe("info");
  });

  it("should format level as uppercase string in JSON mode", () => {
    const chunks: string[] = [];
    const dest = new Writable({
      write(chunk: Buffer, _enc: string, cb: () => void) {
        chunks.push(chunk.toString());
        cb();
      },
    });
    const l = createLogger({
      level: "info",
      pretty: false,
      dest: dest as never,
    });
    l.info("test message");

    const lastChunk = chunks[chunks.length - 1];
    const parsed = JSON.parse(lastChunk);
    expect(parsed.level).toBe("INFO");
  });

  it("should include service and environment in the base log object", () => {
    const chunks: string[] = [];
    const dest = new Writable({
      write(chunk: Buffer, _enc: string, cb: () => void) {
        chunks.push(chunk.toString());
        cb();
      },
    });
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test-env";
    const l = createLogger({
      serviceName: "test-service",
      dest: dest as never,
    });
    l.info("msg");
    process.env.NODE_ENV = savedEnv;

    const lastChunk = chunks[chunks.length - 1];
    const parsed = JSON.parse(lastChunk);
    expect(parsed["service.name"]).toBe("test-service");
    expect(parsed["deployment.environment"]).toBe("test-env");
  });
});
