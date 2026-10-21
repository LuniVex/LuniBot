import "server-only";
import { Redis } from "@upstash/redis";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Persistence for download counts and votes.
 *
 * Production: Upstash Redis (Vercel Marketplace). Vercel KV and Vercel Postgres are no longer sold
 * directly; the Upstash integration injects KV_REST_API_URL / KV_REST_API_TOKEN.
 * Local dev / self-hosting: a JSON file at .data/store.json, written by the server, so numbers
 * still persist across restarts. On Vercel the filesystem is ephemeral, so without Redis the
 * store refuses to run instead of silently losing data.
 */
export interface Store {
  /** Increment a counter, optionally setting its expiry in seconds the first time. */
  incr(key: string, ttlSeconds?: number): Promise<number>;
  getNumbers(keys: string[]): Promise<number[]>;
  /** True if the key was created now; false if it already existed. */
  setIfAbsent(key: string, ttlSeconds: number): Promise<boolean>;
  hasMember(key: string, member: string): Promise<boolean>;
  addMember(key: string, member: string): Promise<void>;
  removeMember(key: string, member: string): Promise<void>;
  countMembers(key: string): Promise<number>;
}

export class StoreUnavailable extends Error {}

// ---------- Redis ----------
function redisStore(redis: Redis): Store {
  return {
    async incr(key, ttl) {
      const n = await redis.incr(key);
      if (ttl && n === 1) await redis.expire(key, ttl);
      return n;
    },
    async getNumbers(keys) {
      if (!keys.length) return [];
      const vals = await redis.mget<(number | null)[]>(...keys);
      return vals.map((v) => Number(v ?? 0));
    },
    async setIfAbsent(key, ttl) {
      return (await redis.set(key, 1, { nx: true, ex: ttl })) === "OK";
    },
    async hasMember(key, m) { return (await redis.sismember(key, m)) === 1; },
    async addMember(key, m) { await redis.sadd(key, m); },
    async removeMember(key, m) { await redis.srem(key, m); },
    async countMembers(key) { return redis.scard(key); },
  };
}

// ---------- File (dev / single-server) ----------
interface FileData { counters: Record<string, number>; sets: Record<string, string[]>; expires: Record<string, number> }

function fileStore(path: string): Store {
  let data: FileData | null = null;
  let chain: Promise<unknown> = Promise.resolve(); // serialises read-modify-write within this process

  const load = (): FileData => {
    if (data) return data;
    try { data = JSON.parse(readFileSync(path, "utf8")); } catch { data = { counters: {}, sets: {}, expires: {} }; }
    return data!;
  };
  const save = () => {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, path);
  };
  const live = (d: FileData, key: string) => {
    const exp = d.expires[key];
    if (exp && exp < Date.now()) { delete d.counters[key]; delete d.expires[key]; }
  };
  const run = <T,>(fn: (d: FileData) => T): Promise<T> => {
    const next = chain.then(() => { const d = load(); const out = fn(d); save(); return out; });
    chain = next.catch(() => undefined);
    return next;
  };

  return {
    incr: (key, ttl) => run((d) => {
      live(d, key);
      d.counters[key] = (d.counters[key] ?? 0) + 1;
      if (ttl && d.counters[key] === 1) d.expires[key] = Date.now() + ttl * 1000;
      return d.counters[key];
    }),
    getNumbers: (keys) => run((d) => keys.map((k) => { live(d, k); return d.counters[k] ?? 0; })),
    setIfAbsent: (key, ttl) => run((d) => {
      live(d, key);
      if (key in d.counters) return false;
      d.counters[key] = 1; d.expires[key] = Date.now() + ttl * 1000;
      return true;
    }),
    hasMember: (key, m) => run((d) => (d.sets[key] ?? []).includes(m)),
    addMember: (key, m) => run((d) => { const s = new Set(d.sets[key] ?? []); s.add(m); d.sets[key] = [...s]; }),
    removeMember: (key, m) => run((d) => { d.sets[key] = (d.sets[key] ?? []).filter((x) => x !== m); }),
    countMembers: (key) => run((d) => (d.sets[key] ?? []).length),
  };
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return (cached = redisStore(new Redis({ url, token })));
  if (process.env.VERCEL) {
    throw new StoreUnavailable("No Redis connected. Add the Upstash Redis integration in Vercel > Storage.");
  }
  return (cached = fileStore(join(process.cwd(), ".data", "store.json")));
}
