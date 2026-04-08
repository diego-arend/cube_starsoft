import { describe, it, expect, beforeAll } from "vitest";

// import compiled dist to avoid transform issues for Nest packages
type NestPinoLoggerConstructor = new (opts?: {
  level?: string;
  serviceName?: string;
}) => {
  log: (message: string, context?: string) => void;
  error: (message: string, trace?: string, context?: string) => void;
  warn: (message: string, context?: string) => void;
  debug: (message: string, context?: string) => void;
  verbose: (message: string, context?: string) => void;
};

let NestPinoLogger: NestPinoLoggerConstructor;
beforeAll(async () => {
  const mod = await import("../../dist/index.js");
  NestPinoLogger = mod.NestPinoLogger;
});

describe("NestPinoLogger", () => {
  it("does not throw when logging methods are used", () => {
    const logger = new NestPinoLogger({
      level: "info",
      serviceName: "test-svc",
    });
    expect(() => logger.log("hello", "ctx")).not.toThrow();
    expect(() => logger.error("err", "trace", "ctx")).not.toThrow();
    expect(() => logger.warn("w", "ctx")).not.toThrow();
    expect(() => logger.debug("d", "ctx")).not.toThrow();
    expect(() => logger.verbose("v", "ctx")).not.toThrow();
  });
});
