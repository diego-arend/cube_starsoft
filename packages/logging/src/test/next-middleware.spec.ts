import { describe, it, expect } from "vitest";
import type pino from "pino";
import type { NextRequest } from "next/server";
import { createNextServerLoggerMiddleware } from "../next/middleware";

describe("Next server middleware", () => {
  it("attaches a logger to the request object", () => {
    const middleware = createNextServerLoggerMiddleware({
      serviceName: "frontend",
    });
    const req = new Request("http://localhost") as unknown as NextRequest & {
      logger?: pino.Logger;
    };
    const _result = middleware(req as NextRequest);
    void _result;
    expect(req.logger).toBeDefined();
  });
});
