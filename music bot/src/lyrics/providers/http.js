/**
 * Music Bot — src/lyrics/providers/http.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { config } from '../../config.js';
import { RateLimiter } from '../../util/limits.js';

/** Thrown when a provider is deliberately skipped (rate limited, cooling down, misconfigured). */
export class ProviderSkip extends Error {}

/**
 * Per-provider HTTP helper: a request timeout, a local token bucket so we stay under
 * the provider's limits, and a cooldown after a 429 that honours Retry-After.
 * 404 resolves to null (a normal "not found").
 */
export function makeHttp(name, { capacity, perSeconds }) {
  const limiter = new RateLimiter({ capacity, perSeconds });
  let cooldownUntil = 0;

  return async function request(url, { headers = {}, as = 'json' } = {}) {
    if (Date.now() < cooldownUntil) throw new ProviderSkip(`${name} is cooling down after a rate limit`);
    if (limiter.take('all')) throw new ProviderSkip(`${name} local rate limit reached`);
    const res = await fetch(url, {
      headers: { 'User-Agent': config.lyrics.userAgent, Accept: as === 'json' ? 'application/json' : 'text/html', ...headers },
      signal: AbortSignal.timeout(config.lyrics.requestTimeoutMs),
      redirect: 'follow',
    });
    if (res.status === 429) {
      cooldownUntil = Date.now() + (Number(res.headers.get('retry-after')) || 30) * 1000;
      throw new ProviderSkip(`${name} returned 429`);
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${name} HTTP ${res.status}`);
    return as === 'json' ? res.json() : res.text();
  };
}
