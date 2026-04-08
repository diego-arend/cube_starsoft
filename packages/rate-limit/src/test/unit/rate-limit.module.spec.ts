import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerRateLimit } from "../../index";
import type { RateLimitStore } from "../../index";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyRequest } from "fastify";
type Env = {
  RATE_LIMIT_ENABLED?: boolean;
  RATE_LIMIT_MAX_REQUESTS?: number;
  RATE_LIMIT_WINDOW_MS?: number;
};

describe("registerRateLimit — simplified unit tests", () => {
  const envBackup = { ...process.env };
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...envBackup } as NodeJS.ProcessEnv;
  });
  afterEach(() => {
    process.env = envBackup as NodeJS.ProcessEnv;
  });

  it("does not register the plugin when disabled", async () => {
    const cfg = { RATE_LIMIT_ENABLED: false } as unknown as Env;
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const app = { register: registerMock } as unknown as Pick<
      NestFastifyApplication,
      "register"
    >;
    await registerRateLimit(app as unknown as NestFastifyApplication, cfg);
    expect(registerMock).toHaveBeenCalledTimes(0);
  });

  it("registers plugin with expected options when enabled", async () => {
    const cfg = {
      RATE_LIMIT_ENABLED: true,
      RATE_LIMIT_MAX_REQUESTS: 7,
      RATE_LIMIT_WINDOW_MS: 3000,
    } as unknown as Env;
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const app = { register: registerMock } as unknown as Pick<
      NestFastifyApplication,
      "register"
    >;
    await registerRateLimit(app as unknown as NestFastifyApplication, cfg);
    expect(registerMock).toHaveBeenCalledTimes(1);
    const [, opts] = registerMock.mock.calls[0] as [
      unknown,
      {
        global?: boolean;
        max?: number;
        timeWindow?: number;
        keyGenerator?: (req: FastifyRequest) => string;
      },
    ];
    expect(opts).toBeDefined();
    expect(opts.global).toBe(true);
    expect(opts.max).toBe(Number(cfg.RATE_LIMIT_MAX_REQUESTS));
    expect(opts.timeWindow).toBe(Number(cfg.RATE_LIMIT_WINDOW_MS));
    const req = { headers: {}, ip: "127.0.0.1" } as unknown as FastifyRequest;
    expect(typeof opts.keyGenerator).toBe("function");
    expect(opts.keyGenerator?.(req)).toBe("127.0.0.1");
  });

  it("exposes a constructor function when provided a RateLimitStore", async () => {
    const cfg = {
      RATE_LIMIT_ENABLED: true,
      RATE_LIMIT_MAX_REQUESTS: 1,
      RATE_LIMIT_WINDOW_MS: 1000,
    } as unknown as Env;
    const store: RateLimitStore = {
      incr: (_key: string) => {
        void _key;
        return Promise.resolve(1);
      },
      pttl: (_key: string) => {
        void _key;
        return Promise.resolve(100);
      },
      pexpire: (_key: string, _ttlMs: number) => {
        void _key;
        void _ttlMs;
        return Promise.resolve();
      },
      del: (_key: string) => {
        void _key;
        return Promise.resolve(1);
      },
    };
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const app = { register: registerMock } as unknown as Pick<
      NestFastifyApplication,
      "register"
    >;
    await registerRateLimit(
      app as unknown as NestFastifyApplication,
      cfg,
      store
    );
    const [, opts] = registerMock.mock.calls[0] as [
      unknown,
      {
        global?: boolean;
        max?: number;
        timeWindow?: number;
        keyGenerator?: (req: FastifyRequest) => string;
        store?: unknown;
      },
    ];
    expect(opts.store).toBeDefined();
    expect(typeof opts.store).toBe("function");
  });
});
