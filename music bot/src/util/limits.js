/**
 * Music Bot — src/util/limits.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
/** Counting semaphore so we never run more than N extractor processes at once. */
export class Semaphore {
  constructor(max) {
    this.max = max;
    this.active = 0;
    this.waiters = [];
  }

  async run(fn) {
    if (this.active >= this.max) {
      await new Promise((resolve) => this.waiters.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiters.shift()?.();
    }
  }
}

/** Per-key token bucket. `take(key)` returns 0 when allowed, else seconds to wait. */
export class RateLimiter {
  constructor({ capacity, perSeconds }) {
    this.capacity = capacity;
    this.refillPerMs = capacity / (perSeconds * 1000);
    this.buckets = new Map();
  }

  take(key, cost = 1, now = Date.now()) {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, at: now };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + (now - bucket.at) * this.refillPerMs);
    bucket.at = now;
    if (bucket.tokens < cost) {
      this.buckets.set(key, bucket);
      return Math.ceil((cost - bucket.tokens) / this.refillPerMs / 1000);
    }
    bucket.tokens -= cost;
    this.buckets.set(key, bucket);
    if (this.buckets.size > 10_000) this.#prune(now);
    return 0;
  }

  #prune(now) {
    const full = this.capacity / this.refillPerMs;
    for (const [key, b] of this.buckets) if (now - b.at > full) this.buckets.delete(key);
  }
}

/** Small TTL cache with a size cap (oldest entries evicted first). */
export class TtlCache {
  constructor({ ttlMs, max = 500 }) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  delete(key) {
    return this.map.delete(key);
  }

  set(key, value) {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
  }
}
