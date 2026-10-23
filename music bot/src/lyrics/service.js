/**
 * Music Bot — src/lyrics/service.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';
import { parseLrc, syncedToPlain } from './lrc.js';
import { cacheKey, canonical, cleanTitle, metasForTrack, scoreMatch, scoreQuery, songKey } from './match.js';
import { genius } from './providers/genius.js';
import { ProviderSkip } from './providers/http.js';
import { lrclib } from './providers/lrclib.js';
import { musixmatch } from './providers/musixmatch.js';

/**
 * Lyrics shape used everywhere:
 * { status: 'found'|'instrumental'|'none'|'unavailable', plain, synced: [{timeMs, text}],
 *   hasTiming, source, matched: {title, artist, durationSec}, url, partial }
 */

const log = logger.child({ mod: 'lyrics' });
const ALL_PROVIDERS = { lrclib, musixmatch, genius };
const ACCEPT = 0.65; // minimum match quality for automatic matching
const STRONG = 0.85; // good enough to stop searching a provider early
const UNAVAILABLE_TTL_MS = 5 * 60_000;

let store = null;
const inflight = new Map();

export function configureLyrics({ store: s }) {
  store = s;
}

/** Providers in configured order; adding one means adding an adapter with find/search. */
export function providerList() {
  return config.lyrics.providers.map((id) => ALL_PROVIDERS[id]).filter(Boolean);
}

export function providerStatus() {
  return providerList().map((p) => ({ name: p.name, enabled: p.enabled(), needsKey: p.needsKey }));
}

function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/** Turn a provider candidate (with content loaded) into the shared shape. */
export function finalize(cand, provider) {
  const parsed = parseLrc(cand.syncedLrc);
  const hasTiming = parsed.filter((l) => l.text).length >= 4;
  const synced = hasTiming ? parsed : [];
  const plain = String(cand.plain ?? '').trim() || (hasTiming ? syncedToPlain(synced) : '');
  const names = canonical(cand);
  return {
    status: cand.instrumental ? 'instrumental' : 'found',
    plain,
    synced,
    hasTiming,
    source: provider.name,
    matched: { title: cleanTitle(names.title), artist: names.artist, durationSec: cand.durationSec ?? null },
    url: cand.url ?? null,
    partial: Boolean(cand.partial),
  };
}

/** Crowd-sourced records can be junk (LRCLIB had "probe" for a famous song). */
export function looksReal(result) {
  if (result.status === 'instrumental') return true;
  const lines = result.plain.split('\n').filter((l) => l.trim());
  return lines.length >= 4 && result.plain.length >= 60;
}

function quickQuality(c) {
  const text = c.syncedLrc || c.plain || '';
  return c.instrumental || (text.split('\n').filter((l) => l.trim()).length >= 4 && text.length >= 60);
}

/**
 * Waterfall: ask providers in order, stop at the first well-matched result *with timing*.
 * A plain-only hit is kept (from the highest-priority provider) while later providers
 * that can sync are tried; with no timing anywhere, that plain text is the answer.
 */
async function waterfall(metas) {
  let bestPlain = null;
  let failures = 0;
  const enabled = providerList().filter((p) => p.enabled());
  const scoreOf = (c) => Math.max(...metas.map((m) => scoreMatch(m, c)));
  const isGood = (c) => scoreOf(c) >= STRONG && quickQuality(c) && (c.syncedLrc || c.instrumental);

  for (const provider of enabled) {
    if (bestPlain && !provider.canSync) continue; // only worth asking if it can add timing
    let cands;
    try {
      cands = await withTimeout(provider.find(metas, { isGood }), config.lyrics.requestTimeoutMs * 3, provider.name);
    } catch (err) {
      failures++;
      log[err instanceof ProviderSkip ? 'info' : 'warn']({ provider: provider.name, err: err.message }, 'lyrics provider failed');
      continue;
    }
    const ranked = cands
      .map((c) => ({ c, score: scoreOf(c) }))
      // Lazily loaded candidates (Musixmatch, Genius) are quality-checked after loading.
      .filter((r) => r.score >= ACCEPT && (r.c.load || quickQuality(r.c)))
      .sort((a, b) => (b.score + (b.c.syncedLrc ? 0.08 : 0)) - (a.score + (a.c.syncedLrc ? 0.08 : 0)));

    for (const { c, score } of ranked.slice(0, 4)) {
      let full = c;
      if (c.load) {
        try {
          full = { ...c, ...await withTimeout(c.load(), config.lyrics.requestTimeoutMs * 2, `${provider.name} load`) };
        } catch (err) {
          log.info({ provider: provider.name, err: err.message }, 'lyrics load failed');
          continue;
        }
      }
      const result = finalize(full, provider);
      if (!looksReal(result)) continue;
      log.debug({ provider: provider.name, score: score.toFixed(2), title: c.title, artist: c.artist, timing: result.hasTiming }, 'lyrics candidate accepted');
      if (result.status === 'instrumental' || result.hasTiming) return result;
      bestPlain ??= result;
      break;
    }
  }
  if (bestPlain) return bestPlain;
  return { status: failures > 0 && failures === enabled.length ? 'unavailable' : 'none' };
}

function ttlFor(result) {
  if (result.status === 'unavailable') return UNAVAILABLE_TTL_MS;
  if (result.status === 'none') return config.lyrics.missTtlHours * 3_600_000;
  return config.lyrics.cacheTtlDays * 86_400_000;
}

export function trackCacheKey(track) {
  const metas = metasForTrack(track);
  return metas.length ? cacheKey(metas[0]) : null;
}

/**
 * Lyrics for a playing track. Cached in SQLite (hits and misses, with TTLs); concurrent
 * requests for the same track share one lookup. Never throws.
 */
export async function getLyricsForTrack(track) {
  const metas = metasForTrack(track);
  if (!metas.length) return { status: 'none' };
  const key = cacheKey(metas[0]);
  const cached = store?.getLyrics(key);
  if (cached) return { ...cached, cached: true };
  if (inflight.has(key)) return inflight.get(key);

  const started = Date.now();
  const job = withTimeout(waterfall(metas), config.lyrics.totalTimeoutMs, 'lyrics lookup')
    .catch((err) => {
      log.warn({ err: err.message }, 'lyrics lookup failed');
      return { status: 'unavailable' };
    })
    .then((result) => {
      try {
        store?.putLyrics(key, result, ttlFor(result));
      } catch (err) {
        log.warn({ err: err.message }, 'could not cache lyrics');
      }
      log.info({ title: metas[0].title, status: result.status, source: result.source, timing: result.hasTiming, ms: Date.now() - started }, 'lyrics lookup');
      return result;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** Pin a manually chosen result to a track (and its cache entry) — the manual override. */
export function overrideForTrack(track, result) {
  const key = trackCacheKey(track);
  if (key) store?.putLyrics(key, result, ttlFor(result));
}

/**
 * Manual search ("/lyrics query:…"). Returns one result, a list of plausible choices for
 * a picker, or nothing.
 */
export async function searchLyrics(query) {
  const enabled = providerList().filter((p) => p.enabled());
  const settled = await Promise.allSettled(enabled.map((p) => withTimeout(p.search(query), config.lyrics.requestTimeoutMs * 2, p.name)
    .then((cands) => cands.map((c) => ({ c, provider: p })))));
  const all = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  if (all.length === 0 && settled.every((s) => s.status === 'rejected') && enabled.length) return { kind: 'unavailable' };

  const ranked = all
    .filter(({ c }) => c.instrumental || c.load || quickQuality(c))
    .map((r) => ({ ...r, score: scoreQuery(query, r.c) + (r.c.syncedLrc ? 0.05 : 0) }))
    .filter((r) => r.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  // Collapse duplicate uploads of the same song; the best-ranked copy wins.
  const seen = new Set();
  const unique = ranked.filter(({ c }) => {
    const k = songKey(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length === 0) return { kind: 'none' };
  const plausible = unique.filter((r) => r.score >= unique[0].score - 0.15).slice(0, 10);
  if (plausible.length === 1) {
    const result = await loadChoice(plausible[0]);
    return result.status === 'none' ? { kind: 'none' } : { kind: 'result', result };
  }
  return { kind: 'choices', choices: plausible };
}

/** Load the full lyrics for a picker choice. */
export async function loadChoice({ c, provider }) {
  try {
    const full = c.load ? { ...c, ...await withTimeout(c.load(), config.lyrics.requestTimeoutMs * 2, provider.name) } : c;
    const result = finalize(full, provider);
    return looksReal(result) ? result : { status: 'none' };
  } catch (err) {
    log.warn({ provider: provider.name, err: err.message }, 'lyrics choice failed to load');
    return { status: 'unavailable' };
  }
}
