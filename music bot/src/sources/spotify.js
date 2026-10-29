/**
 * Music Bot — src/sources/spotify.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';
import { UserError } from '../util/errors.js';
import { findOnProviders } from './search.js';

const log = logger.child({ mod: 'spotify' });
const API = 'https://api.spotify.com/v1';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const URL_RE = /^(?:https?:\/\/)?(?:open|play)\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|artist)\/([A-Za-z0-9]{22})/i;
const URI_RE = /^spotify:(track|album|playlist|artist):([A-Za-z0-9]{22})$/i;
const SHORT_RE = /^https?:\/\/(?:spotify\.link|spoti\.fi)\/\S+$/i;

export function parseSpotify(input) {
  const text = String(input ?? '').trim();
  const m = text.match(URL_RE) ?? text.match(URI_RE);
  return m ? { type: m[1].toLowerCase(), id: m[2] } : null;
}

export function isSpotifyInput(input) {
  return Boolean(parseSpotify(input)) || SHORT_RE.test(String(input ?? '').trim());
}

async function expandShortLink(url) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
  return res.url;
}

// ---------------------------------------------------------------- Web API (optional)

let token = null;
let tokenExpires = 0;

async function getToken() {
  if (token && Date.now() < tokenExpires - 60_000) return token;
  const basic = Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Spotify token request failed: HTTP ${res.status}`);
  const body = await res.json();
  token = body.access_token;
  tokenExpires = Date.now() + body.expires_in * 1000;
  return token;
}

async function api(pathname, attempt = 0) {
  const res = await fetch(`${API}${pathname}`, {
    headers: { Authorization: `Bearer ${await getToken()}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 429 && attempt < 2) {
    const wait = Math.min(10, Number(res.headers.get('retry-after')) || 2);
    log.warn({ wait }, 'spotify rate limited');
    await new Promise((r) => setTimeout(r, wait * 1000));
    return api(pathname, attempt + 1);
  }
  if (res.status === 401 && attempt === 0) {
    token = null;
    return api(pathname, attempt + 1);
  }
  if (!res.ok) {
    const err = new Error(`Spotify API ${pathname} -> HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function apiTrack(t, fallbackImage) {
  return {
    title: t.name,
    artist: (t.artists ?? []).map((a) => a.name).join(', '),
    durationSec: t.duration_ms ? Math.round(t.duration_ms / 1000) : null,
    spotifyUrl: t.external_urls?.spotify ?? (t.id ? `https://open.spotify.com/track/${t.id}` : null),
    thumbnail: t.album?.images?.[0]?.url ?? fallbackImage ?? null,
  };
}

async function paginate(firstPath, pick, max) {
  const out = [];
  let next = firstPath;
  while (next && out.length < max) {
    const page = await api(next);
    for (const item of page.items ?? []) {
      const t = pick(item);
      if (t?.name && t.type !== 'episode') out.push(t);
    }
    next = page.next ? page.next.replace(API, '') : null;
  }
  return out.slice(0, max);
}

async function viaApi({ type, id }, max) {
  if (type === 'track') {
    const t = await api(`/tracks/${id}`);
    return { title: t.name, tracks: [apiTrack(t)] };
  }
  if (type === 'album') {
    const album = await api(`/albums/${id}`);
    const image = album.images?.[0]?.url;
    const items = await paginate(`/albums/${id}/tracks?limit=50`, (t) => t, max);
    return { title: album.name, tracks: items.map((t) => apiTrack(t, image)) };
  }
  if (type === 'playlist') {
    const meta = await api(`/playlists/${id}`);
    // Since Feb 2026, Development Mode apps only get `items` for playlists the app owner
    // owns/collaborates on. Anything else falls through to the embed scraper.
    const contents = meta.items ?? meta.tracks;
    if (!contents?.items?.length) return null;
    const items = await paginate(`/playlists/${id}/items?limit=50`, (row) => row.item ?? row.track, max);
    return { title: meta.name, tracks: items.map((t) => apiTrack(t)) };
  }
  return null; // artist top-tracks was removed from the API; the embed still lists them
}

// ---------------------------------------------------------------- Public embed (no credentials)

export function parseEmbedHtml(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  const entity = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity;
  if (!entity) return null;
  const image = entity.coverArt?.sources?.at(-1)?.url ?? entity.visualIdentity?.image?.at(-1)?.url ?? null;
  if (entity.type === 'track') {
    return {
      title: entity.name ?? entity.title,
      tracks: [{
        title: entity.name ?? entity.title,
        artist: (entity.artists ?? []).map((a) => a.name).join(', '),
        durationSec: entity.duration ? Math.round(entity.duration / 1000) : null,
        spotifyUrl: entity.id ? `https://open.spotify.com/track/${entity.id}` : null,
        thumbnail: image,
      }],
    };
  }
  const tracks = (entity.trackList ?? [])
    .filter((t) => t.entityType !== 'episode' && t.isPlayable !== false)
    .map((t) => ({
      title: t.title,
      artist: String(t.subtitle ?? '').replace(/\u00a0/g, ' ').split(/,\s*/).join(', '),
      durationSec: t.duration ? Math.round(t.duration / 1000) : null,
      spotifyUrl: t.uri ? `https://open.spotify.com/track/${t.uri.split(':').pop()}` : null,
      thumbnail: image,
    }));
  return { title: entity.name ?? entity.title, tracks };
}

async function viaEmbed({ type, id }) {
  const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Spotify embed HTTP ${res.status}`);
  return parseEmbedHtml(await res.text());
}

/**
 * Resolve a Spotify link to plain track metadata ({title, artist, durationSec}).
 * Spotify audio is DRM-protected, so these are later matched on a real source.
 */
export async function resolveSpotify(input, { max = config.maxPlaylistItems } = {}) {
  let text = String(input).trim();
  if (SHORT_RE.test(text)) text = await expandShortLink(text).catch(() => text);
  const ref = parseSpotify(text);
  if (!ref) throw new UserError('That doesn\'t look like a Spotify track, album, playlist or artist link.', { hint: 'Copy the link via Share → Copy link in Spotify.', code: 'SPOTIFY_BAD_LINK' });

  let result = null;
  if (config.spotifyClientId && config.spotifyClientSecret) {
    try {
      result = await viaApi(ref, max);
    } catch (err) {
      log.warn({ err: err.message, ref }, 'spotify API lookup failed, trying embed');
      if (err.status === 404) result = null;
    }
  }
  // The embed shows at most ~100 tracks of a playlist; good enough without credentials.
  if (!result || result.tracks.length === 0) {
    try {
      result = await viaEmbed(ref);
    } catch (err) {
      log.warn({ err: err.message, ref }, 'spotify embed lookup failed');
    }
  }
  if (!result || result.tracks.length === 0) {
    throw new UserError('Couldn\'t read that Spotify link (it may be private, region-locked or removed).', {
      hint: 'Make the playlist public, or search for the songs by name.',
      code: 'SPOTIFY_UNAVAILABLE',
    });
  }
  return { ...result, kind: ref.type, tracks: result.tracks.slice(0, max) };
}

// ---------------------------------------------------------------- Matching on a real source

export { scoreCandidate } from './search.js';

/**
 * Find a playable copy of a Spotify track on the first search provider that has it
 * (YouTube, SoundCloud, Bandcamp, … in configured order). Null when nothing is close enough.
 */
export function matchTrack(meta) {
  return findOnProviders(meta);
}
