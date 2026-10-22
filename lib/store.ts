import "server-only";
import { Redis } from "@upstash/redis";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The datastore behind download counts and votes.
 *
 * Production: Upstash Redis, added on Vercel under Storage > Marketplace. It injects
 * KV_REST_API_URL and KV_REST_API_TOKEN (UPSTASH_REDIS_REST_* also work).
 * Local development: a JSON file at .data/store.json, so numbers survive restarts.
 * On Vercel the filesystem is thrown away between requests, so there the file store is refused
 * and the API answers 503 with a setup message instead of quietly losing data.
 */
export interface Store {
  /** Adds 1 and returns the new value. `ttl` (seconds) is set when the key is created. */
  incr(key: string, ttl?: number): Promise<number>;
  /** Numbers for many keys at once; missing keys read as 0. */
  read(keys: string[]): Promise<number[]>;
  /** Creates the key if it doesn't exist. True if it was created now. */
  claim(key: string, ttl: number): Promise<boolean>;
  setHas(key: string, member: string): Promise<boolean>;
  setAdd(key: string, member: string): Promise<void>;
  setRemove(key: string, member: string): Promise<void>;
  setSize(key: string): Promise<number>;
}

export class StoreNotConfigured extends Error {}

function redis(client: Redis): Store {
  return {
    async incr(key, ttl) {
      const n = await client.incr(key);
      if (ttl && n === 1) await client.expire(key, ttl);
      return n;
    },
    async read(keys) {
      if (keys.length === 0) return [];
      const values = await client.mget<(number | string | null)[]>(...keys);
      return values.map((v) => Number(v ?? 0));
    },
    async claim(key, ttl) { return (await client.set(key, 1, { nx: true, ex: ttl })) === "OK"; },
    async setHas(key, m) { return (await client.sismember(key, m)) === 1; },
    async setAdd(key, m) { await client.sadd(key, m); },
    async setRemove(key, m) { await client.srem(key, m); },
    async setSize(key) { return client.scard(key); },
  };
}

interface FileData { n: Record<string, number>; sets: Record<string, string[]>; exp: Record<string, number> }

function file(path: string): Store {
  let queue: Promise<unknown> = Promise.resolve();
  const load = (): FileData => {
    try { return JSON.parse(readFileSync(path, "utf8")) as FileData; } catch { return { n: {}, sets: {}, exp: {} }; }
  };
  const save = (d: FileData) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.tmp`, JSON.stringify(d));
    renameSync(`${path}.tmp`, path);
  };
  const expire = (d: FileData, key: string) => {
    if (d.exp[key] && d.exp[key] < Date.now()) { delete d.n[key]; delete d.exp[key]; }
  };
  // One operation at a time, so concurrent requests can't overwrite each other's writes.
  const run = <T,>(op: (d: FileData) => T): Promise<T> => {
    const next = queue.then(() => { const d = load(); const out = op(d); save(d); return out; });
    queue = next.catch(() => undefined);
    return next;
  };
  return {
    incr: (key, ttl) => run((d) => {
      expire(d, key);
      d.n[key] = (d.n[key] ?? 0) + 1;
      if (ttl && d.n[key] === 1) d.exp[key] = Date.now() + ttl * 1000;
      return d.n[key];
    }),
    read: (keys) => run((d) => keys.map((k) => { expire(d, k); return d.n[k] ?? 0; })),
    claim: (key, ttl) => run((d) => {
      expire(d, key);
      if (key in d.n) return false;
      d.n[key] = 1;
      d.exp[key] = Date.now() + ttl * 1000;
      return true;
    }),
    setHas: (key, m) => run((d) => (d.sets[key] ?? []).includes(m)),
    setAdd: (key, m) => run((d) => { d.sets[key] = [...new Set([...(d.sets[key] ?? []), m])]; }),
    setRemove: (key, m) => run((d) => { d.sets[key] = (d.sets[key] ?? []).filter((x) => x !== m); }),
    setSize: (key) => run((d) => (d.sets[key] ?? []).length),
  };
}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return (store = redis(new Redis({ url, token })));
  if (process.env.VERCEL) throw new StoreNotConfigured("No datastore connected. Add Upstash for Redis in Vercel > Storage.");
  return (store = file(join(process.cwd(), ".data", "store.json")));
}
