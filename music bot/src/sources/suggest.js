/**
 * Music Bot — src/sources/suggest.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { TtlCache } from '../util/limits.js';

const cache = new TtlCache({ ttlMs: 10 * 60_000, max: 2_000 });

/**
 * Search-as-you-type suggestions for /play autocomplete. Discord gives autocomplete 3s,
 * so this uses YouTube's lightweight suggest endpoint (not a full search) with a 1.5s cap.
 */
export async function suggest(query) {
  const key = query.toLowerCase().trim();
  if (!key) return [];
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(1_500) });
    if (!res.ok) return [];
    const body = JSON.parse(await res.text());
    const list = Array.isArray(body?.[1]) ? body[1].filter((s) => typeof s === 'string').slice(0, 10) : [];
    cache.set(key, list);
    return list;
  } catch {
    return [];
  }
}
