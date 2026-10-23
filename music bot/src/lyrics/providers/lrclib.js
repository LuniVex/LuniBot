/**
 * Music Bot — src/lyrics/providers/lrclib.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { cleanTitle, primaryArtist } from '../match.js';
import { makeHttp } from './http.js';

const BASE = 'https://lrclib.net/api';
// LRCLIB publishes no hard limit; stay polite.
const request = makeHttp('LRCLIB', { capacity: 30, perSeconds: 10 });

function toCandidate(r) {
  return {
    title: r.trackName ?? r.name,
    artist: r.artistName,
    durationSec: r.duration ?? null,
    instrumental: Boolean(r.instrumental),
    plain: r.plainLyrics ?? null,
    syncedLrc: r.syncedLyrics ?? null,
    url: r.id ? `https://lrclib.net/api/get/${r.id}` : null,
  };
}

async function searchParams(params) {
  const body = await request(`${BASE}/search?${new URLSearchParams(params)}`);
  return Array.isArray(body) ? body.map(toCandidate) : [];
}

/** LRCLIB answers some lookups with a transient 503; one bad sub-request shouldn't sink the rest. */
async function attempt(fn, errors) {
  try {
    return await fn();
  } catch (err) {
    errors.push(err);
    return [];
  }
}

/** LRCLIB: free, no key, plain + synced (LRC) lyrics. Primary source. */
export const lrclib = {
  id: 'lrclib',
  name: 'LRCLIB',
  needsKey: false,
  canSync: true,
  enabled: () => true,

  async find(metas, { isGood }) {
    const out = [];
    const errors = [];
    let calls = 0;
    // 1. Exact lookups (title + artist + duration; LRCLIB matches duration within ~2s).
    for (const m of metas) {
      if (!m.artist || !m.durationSec) continue;
      const params = { track_name: cleanTitle(m.title), artist_name: primaryArtist(m.artist), duration: String(Math.round(m.durationSec)) };
      calls++;
      const hit = await attempt(() => request(`${BASE}/get?${new URLSearchParams(params)}`), errors);
      if (hit?.id) {
        const c = toCandidate(hit);
        out.push(c);
        if (isGood(c)) return out;
      }
    }
    // 2. Field search, then free-text search (crowd-sourced records are often named
    //    "Artist - Title (Lyrics)", which the scorer copes with).
    for (const meta of metas.slice(0, 2)) {
      if (!meta.artist) continue;
      calls++;
      out.push(...await attempt(() => searchParams({ track_name: cleanTitle(meta.title), artist_name: primaryArtist(meta.artist) }), errors));
      if (out.some(isGood)) return out;
    }
    for (const meta of metas.slice(0, 2)) {
      calls++;
      out.push(...await attempt(() => searchParams({ q: `${primaryArtist(meta.artist)} ${cleanTitle(meta.title)}`.trim() }), errors));
      if (out.some(isGood)) break;
    }
    if (out.length === 0 && errors.length === calls && errors.length) throw errors[0];
    return out;
  },

  async search(query) {
    return searchParams({ q: query });
  },
};
