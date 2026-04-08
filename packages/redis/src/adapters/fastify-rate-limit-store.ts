/**
 * Minimal types describing the constructor and instance shape the
 * `@fastify/rate-limit` plugin expects from a custom store.
 */
type FastifyRateLimitStoreCtorType = new (
  globalParams?: Record<string, unknown>
) => FastifyRateLimitStoreType;

type FastifyRateLimitStoreType = {
  incr(
    key: string,
    cb: (err: Error | null, res?: { current: number; ttl: number }) => void,
    timeWindowMs?: number,
    max?: number
  ): void;
  child(routeOptions?: Record<string, unknown>): FastifyRateLimitStoreType;
};
import type { RateLimitStore } from "./rate-limit-store";

export function createFastifyRateLimitStoreCtor(
  adapter: RateLimitStore
): FastifyRateLimitStoreCtorType {
  class FastifyRateLimitStoreCtor implements FastifyRateLimitStoreType {
    private readonly _adapter: RateLimitStore;
    private readonly _globalParams?: Record<string, unknown>;
    constructor(globalParams?: Record<string, unknown>) {
      this._globalParams = globalParams;
      this._adapter = adapter;
    }

    incr(
      key: string,
      cb: (err: Error | null, res?: { current: number; ttl: number }) => void,
      timeWindowMs?: number,
      _max?: number
    ) {
      void (async () => {
        try {
          if (timeWindowMs) {
            const ttl = await this._adapter.pttl(key);
            if (ttl < 0) {
              await this._adapter.pexpire(key, Number(timeWindowMs));
            }
          }
          const current = await this._adapter.incr(key);
          const ttl = await this._adapter.pttl(key);
          cb(null, { current: Number(current), ttl: Number(ttl) });
        } catch (err: any) {
          cb(err as Error);
        }
      })();
      void _max;
    }

    child(_: Record<string, unknown> | undefined): FastifyRateLimitStoreType {
      void _;
      return this;
    }
  }

  return FastifyRateLimitStoreCtor as unknown as FastifyRateLimitStoreCtorType;
}
