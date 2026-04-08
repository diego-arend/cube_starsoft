function createBrowserLogger() {
  const formatArgs = (args: unknown[]) => {
    if (
      args.length === 1 &&
      typeof args[0] === "object" &&
      args[0] !== null &&
      "msg" in args[0]
    ) {
      const { msg, ...rest } = args[0] as { msg: string };
      return [msg, rest];
    }
    return args;
  };

  // Browser-side logging
  if (typeof window !== "undefined") {
    return {
      info: (...args: unknown[]) => console.log(...formatArgs(args)),
      warn: (...args: unknown[]) => console.warn(...formatArgs(args)),
      error: (...args: unknown[]) => console.error(...formatArgs(args)),
      debug: (...args: unknown[]) => console.debug(...formatArgs(args)),
      trace: (...args: unknown[]) => console.trace(...args),
      child: () => createBrowserLogger(),
    };
  }

  // We are on the server (Node.js or Edge)
  // Use eval('require') to completely hide from static analysis bundlers (Next.js/Webpack)
  // this prevents the bundler from trying to bundle Node-only packages into the browser
  try {
    const req = eval("require");
    const { createLogger } = req("@turborepo/logging");
    return createLogger({
      serviceName: "frontend-server",
      pretty: process.env.NODE_ENV === "development",
      level: process.env.LOG_LEVEL || "info",
    });
  } catch {
    // Fallback if logging package is not available or in Edge runtime
    return {
      info: (...args: unknown[]) => console.info(...formatArgs(args)),
      warn: (...args: unknown[]) => console.warn(...formatArgs(args)),
      error: (...args: unknown[]) => console.error(...formatArgs(args)),
      debug: (...args: unknown[]) => console.debug(...formatArgs(args)),
      trace: (...args: unknown[]) => console.trace(...formatArgs(args)),
      child: () => createBrowserLogger(),
    };
  }
}

export const logger = createBrowserLogger();
