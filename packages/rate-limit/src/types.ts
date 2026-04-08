export interface RateLimitStore {
  incr(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  pexpire(key: string, ttlMs: number): Promise<void>;
  del(key: string): Promise<number>;
}
