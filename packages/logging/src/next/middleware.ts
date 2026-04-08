import type { NextRequest } from "next/server";
import { createLogger, type EnhancedLogger } from "../logger";
import type { LoggerOptions } from "../types";

export function createNextServerLoggerMiddleware(opts: LoggerOptions = {}) {
  const logger = createLogger(opts);

  return (req: NextRequest) => {
    (req as unknown as { logger: EnhancedLogger }).logger = logger;
    return undefined;
  };
}
