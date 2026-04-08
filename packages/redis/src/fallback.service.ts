import { Injectable, Logger } from "@nestjs/common";

type TTLItem = { value: string; expiresAt?: number };

@Injectable()
export class FallbackService {
  private readonly logger = new Logger(FallbackService.name);
  private store = new Map<string, TTLItem>();
  private setStore = new Map<string, Set<string>>();
  // Track timeouts for expiring keys/sets in the fallback store
  private expiryTimeouts = new Map<string, NodeJS.Timeout>();

  set(key: string, value: string, ttlSeconds?: number) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    if (expiresAt && ttlSeconds) {
      setTimeout(
        () => {
          const item = this.store.get(key);
          if (item && item.expiresAt && Date.now() >= item.expiresAt) {
            this.store.delete(key);
          }
        },
        ttlSeconds * 1000 + 100
      );
    }
    return "OK";
  }

  get(key: string): string | null {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() >= item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  del(key: string) {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  flushAll() {
    this.store.clear();
    this.setStore.clear();
  }

  // SET-like operations for fallback
  sAdd(key: string, member: string) {
    let s = this.setStore.get(key);
    if (!s) {
      s = new Set();
      this.setStore.set(key, s);
    }
    s.add(member);
    return 1;
  }

  sRem(key: string, member: string) {
    const s = this.setStore.get(key);
    if (!s) return 0;
    const existed = s.delete(member);
    if (s.size === 0) this.setStore.delete(key);
    return existed ? 1 : 0;
  }

  sMembers(key: string) {
    const s = this.setStore.get(key);
    if (!s) return [] as string[];
    return Array.from(s);
  }

  expire(key: string, ttlSeconds: number) {
    if (!ttlSeconds || ttlSeconds <= 0) return 0;
    const now = Date.now();
    const exists = this.store.has(key) || this.setStore.has(key);
    if (!exists) return 0;
    // clear any existing timeout
    const existing = this.expiryTimeouts.get(key);
    if (existing) clearTimeout(existing);
    const to = setTimeout(
      () => {
        this.store.delete(key);
        this.setStore.delete(key);
        this.expiryTimeouts.delete(key);
      },
      ttlSeconds * 1000 + 100
    );
    this.expiryTimeouts.set(key, to);
    // if it's a scalar value in store, update expiresAt
    const item = this.store.get(key);
    if (item) item.expiresAt = now + ttlSeconds * 1000;
    return 1;
  }

  keys(pattern: string): string[] {
    // Simple glob matching: convert * to .* and escape other chars
    // Note: this is a basic implementation for fallback purposes
    const regex = new RegExp(
      "^" +
        pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*") +
        "$"
    );
    const keys: string[] = [];
    for (const k of this.store.keys()) {
      if (regex.test(k)) keys.push(k);
    }
    for (const k of this.setStore.keys()) {
      if (regex.test(k) && !this.store.has(k)) keys.push(k);
    }
    return keys;
  }
}
