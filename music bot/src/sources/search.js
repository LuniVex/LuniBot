/**
 * Music Bot — src/sources/search.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';
import { makeHttp } from '../lyrics/providers/http.js';
import { cleanTitle } from '../lyrics/match.js';
import { coverage, normalize, tokens } from '../util/text.js';
import { search as ytdlpSearch } from './ytdlp.js';

const log = logger.child({ mod: 'search' });

/*
 * Every music site that can be both searched and streamed for free. YouTube and SoundCloud
 * are searched through yt-dlp; the others through their public search APIs. Playback always
 * goes through yt-dlp. Spotify, Apple Music, Deezer and Tidal are DRM-only, so they can only
 * supply metadata (see spotify.js), never audio.
 *
 * A provider returns entries shaped like yt-dlp flat results: { url, title, channel, duration }.
 */

const bandcampHttp = makeHttp('Bandcamp', { capacity: 10, perSeconds: 10 });
const audiusHttp = makeHttp('Audius', { capacity: 10, perSeconds: 10 });
const mixcloudHttp = makeHttp('Mixcloud', { capacity: 10, perSeconds: 10 });
const archiveHttp = makeHttp('Internet Archive', { capacity: 10, perSeconds: 10 });

export function parseBandcamp(body) {
  return (body?.auto?.results ?? [])
    .filter((r) => r.type === 't' && r.item_url_path)
    .map((r) => ({ url: r.item_url_path, title: r.name, channel: r.band_name, duration: null }));
}

export function parseAudius(body) {
  return (body?.data ?? [])
    .filter((t) => t.permalink && t.is_streamable !== false)
    .map((t) => ({ url: `https://audius.co${t.permalink}`, title: t.title, channel: t.user?.name, duration: t.duration ?? null }));
}

export function parseMixcloud(body) {
  return (body?.data ?? []).map((c) => ({ url: c.url, title: c.name, channel: c.user?.name, duration: c.audio_length ?? null }));
}

export function parseArchive(body) {
  return (body?.response?.docs ?? []).map((d) => ({
    url: `https://archive.org/details/${d.identifier}`,
    title: d.title,
    channel: Array.isArray(d.creator) ? d.creator[0] : d.creator,
    duration: null,
  }));
}

const PROVIDERS = {
  youtube: {
    name: 'YouTube',
    hosts: /(^|\.)(youtube\.com|youtu\.be)$/,
    search: (q, n) => ytdlpSearch(q, { limit: n, provider: 'ytsearch' }),
  },
  soundcloud: {
    name: 'SoundCloud',
    hosts: /(^|\.)soundcloud\.com$/,
    search: (q, n) => ytdlpSearch(q, { limit: n, provider: 'scsearch' }),
  },
  bandcamp: {
    name: 'Bandcamp',
    hosts: /(^|\.)bandcamp\.com$/,
    // The endpoint behind bandcamp.com's own search box (public, undocumented).
    search: async (q, n) => parseBandcamp(await bandcampHttp('https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic', {
      method: 'POST',
      json: { search_text: q, search_filter: 't', full_page: false, fan_id: null },
    })).slice(0, n),
  },
  audius: {
    name: 'Audius',
    hosts: /(^|\.)audius\.co$/,
    search: async (q, n) => parseAudius(await audiusHttp(`https://api.audius.co/v1/tracks/search?${new URLSearchParams({ query: q, app_name: 'LuniBotMusic' })}`)).slice(0, n),
  },
  mixcloud: {
    name: 'Mixcloud',
    hosts: /(^|\.)mixcloud\.com$/,
    search: async (q, n) => parseMixcloud(await mixcloudHttp(`https://api.mixcloud.com/search/?${new URLSearchParams({ q, type: 'cloudcast', limit: String(n) })}`)),
  },
  archive: {
    name: 'Internet Archive',
    hosts: /(^|\.)archive\.org$/,
    search: async (q, n) => parseArchive(await archiveHttp(`https://archive.org/advancedsearch.php?${new URLSearchParams([
      ['q', `(${q}) AND mediatype:(audio)`], ['fl[]', 'identifier'], ['fl[]', 'title'], ['fl[]', 'creator'], ['rows', String(n)], ['output', 'json'],
    ])}`)),
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

export function providerName(id) {
  return PROVIDERS[id]?.name ?? id;
}

/** Which provider a playable URL belongs to (null for sites without search). */
export function providerIdForUrl(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return PROVIDER_IDS.find((id) => PROVIDERS[id].hosts.test(host)) ?? null;
}

// ---------------------------------------------------------------- blocked providers

const blocked = new Map();

/**
 * Take a provider out of rotation for a while after it refused to play (e.g. YouTube's bot
 * check on a server IP), so later searches go straight to providers that work.
 */
export function markBlocked(id, reason) {
  if (!PROVIDERS[id]) return;
  const until = Date.now() + config.search.blockMinutes * 60_000;
  if (!isBlocked(id)) log.warn({ provider: id, reason, minutes: config.search.blockMinutes }, 'provider blocked, skipping it for now');
  blocked.set(id, { until, reason });
}

export function isBlocked(id) {
  const b = blocked.get(id);
  if (!b) return false;
  if (Date.now() < b.until) return true;
  blocked.delete(id);
  return false;
}

export function clearBlocked() {
  blocked.clear();
}

function activeProviders(exclude = new Set()) {
  return config.search.providers.filter((id) => PROVIDERS[id] && !exclude.has(id) && !isBlocked(id));
}

/** For /settings view: the search order and which providers are currently skipped. */
export function searchStatus() {
  return config.search.providers.filter((id) => PROVIDERS[id]).map((id) => {
    const b = isBlocked(id) ? blocked.get(id) : null;
    return { id, name: providerName(id), blockedMinutes: b ? Math.ceil((b.until - Date.now()) / 60_000) : 0 };
  });
}

async function runSearch(id, query, limit) {
  const entries = await PROVIDERS[id].search(query, limit);
  return entries.filter((e) => e.url && e.live_status !== 'is_upcoming').map((e) => ({ ...e, provider: id }));
}

const relevance = (query, e) => coverage(query, `${e.title ?? ''} ${e.channel ?? e.uploader ?? ''}`);

const NOISE = ['live', 'cover', 'karaoke', 'instrumental', 'remix', 'sped up', 'slowed', 'nightcore', '8d', 'reverb', 'acoustic', 'reaction', 'lyrics video'];

/** How many "other version" words (cover, karaoke, …) a title has that the request didn't ask for. */
function variantCount(wanted, title) {
  const w = normalize(wanted);
  const t = normalize(title);
  return NOISE.filter((word) => t.includes(word) && !w.includes(word)).length;
}

/** Put originals before covers/karaoke/sped-up versions unless the query asks for them. */
function preferOriginals(query, entries) {
  return entries
    .map((e, i) => ({ e, i, v: variantCount(query, e.title ?? '') }))
    .sort((a, b) => a.v - b.v || a.i - b.i)
    .map((x) => x.e);
}

/**
 * Typed search: walk the providers in order and use the first one whose results actually
 * contain the query. If none does, the best partial match wins. Blocked providers are skipped.
 * @returns {Promise<{provider: string, entries: object[]} | null>}
 */
export async function searchAll(query, { limit = config.searchResults, exclude } = {}) {
  let best = null;
  let lastError = null;
  for (const id of activeProviders(exclude)) {
    let entries;
    try {
      entries = await runSearch(id, query, limit);
    } catch (err) {
      lastError = err;
      log.info({ provider: id, err: err.message }, 'search provider failed, trying the next one');
      continue;
    }
    if (entries.length === 0) continue;
    entries = preferOriginals(query, entries);
    const score = Math.max(...entries.slice(0, 3).map((e) => relevance(query, e)));
    if (score >= 0.6) return { provider: id, entries };
    if (!best || score > best.score) best = { provider: id, entries, score };
  }
  if (!best && lastError) throw lastError;
  return best;
}

// ---------------------------------------------------------------- matching a known song

/** Score a search hit against known song metadata; higher is better, < 0.45 is treated as no match. */
export function scoreCandidate(meta, entry) {
  const title = entry.title ?? '';
  const channel = entry.channel ?? entry.uploader ?? '';
  const haystack = `${title} ${channel}`;
  const primaryArtist = (meta.artist ?? '').split(',')[0];

  let score = 0.55 * coverage(meta.title, title) + 0.3 * coverage(primaryArtist, haystack);

  // Words in the candidate's title that aren't the song or the artist ("(FILM MagnEDIT)").
  const artistWords = new Set(tokens(primaryArtist));
  const own = tokens(cleanTitle(title)).filter((t) => !artistWords.has(t));
  if (own.length) score -= 0.2 * (1 - coverage(own.join(' '), meta.title));
  // Uploaded by the artist themselves.
  if (primaryArtist && coverage(primaryArtist, channel) === 1) score += 0.1;

  // 30-second previews (SoundCloud Go+, store samples) are never the song.
  if (meta.durationSec > 90 && entry.duration && entry.duration < 45) return -1;
  if (meta.durationSec && entry.duration) {
    const diff = Math.abs(meta.durationSec - entry.duration);
    if (diff <= 3) score += 0.2;
    else if (diff <= 10) score += 0.1;
    else if (diff > 30) score -= 0.35;
  }
  // YouTube "Artist - Topic" channels carry the official studio audio.
  if (/ - topic$/i.test(channel)) score += 0.15;
  if (/official (audio|music video|video)/i.test(title)) score += 0.05;

  score -= 0.25 * variantCount(meta.title, title);
  return score;
}

/**
 * Find a specific song ({title, artist, durationSec}) on the first provider that has it.
 * Used for Spotify tracks and to replace a song a provider refused to play.
 * @returns {Promise<{entry: object, provider: string} | null>}
 */
export async function findOnProviders(meta, { exclude, skipUrls = new Set() } = {}) {
  const artist = (meta.artist ?? '').split(',')[0].trim();
  const query = `${artist} ${meta.title}`.trim();
  let lastError = null;
  let attempted = 0;
  for (const id of activeProviders(exclude)) {
    attempted++;
    let entries;
    try {
      entries = await runSearch(id, query, 5);
    } catch (err) {
      lastError = err;
      continue;
    }
    const ranked = entries
      .filter((e) => e.live_status !== 'is_live' && !skipUrls.has(e.url) && !skipUrls.has(e.webpage_url))
      .map((e) => ({ e, score: scoreCandidate(meta, e) }))
      .sort((a, b) => b.score - a.score);
    log.debug({ query, provider: id, top: ranked.slice(0, 3).map((r) => [r.e.title, r.score.toFixed(2)]) }, 'match candidates');
    if (ranked[0] && ranked[0].score >= 0.45) return { entry: ranked[0].e, provider: id };
  }
  if (lastError && attempted === 1) throw lastError;
  return null;
}
