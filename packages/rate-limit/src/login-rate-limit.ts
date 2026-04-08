import type { Env } from "@turborepo/config";
import type { RateLimitStore } from "./types";

export async function observeLoginAttempt(
  store: RateLimitStore,
  ip: string,
  email?: string,
  cfgParam?: Env
): Promise<{ ipCount?: number; emailCount?: number }> {
  if (!cfgParam) {
    throw new Error("observeLoginAttempt requires Env configuration");
  }
  const cfg: Env = cfgParam;
  void cfg;
  const ipKey = `rl:login:ip:${ip}`;
  let ipCount: number | undefined = undefined;
  try {
    ipCount = await store.incr(ipKey);
  } catch {
    // allow fallback stores to no-op; propagate nothing
    ipCount = undefined;
  }

  let emailCount: number | undefined = undefined;
  if (email) {
    const key = `rl:login:email:${String(email).toLowerCase()}`;
    try {
      emailCount = await store.incr(key);
    } catch {
      emailCount = undefined;
    }
  }
  return { ipCount, emailCount };
}
