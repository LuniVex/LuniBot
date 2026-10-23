/**
 * Music Bot — src/sources/resolver.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';
import { createTrack, sourceFromInfo, trackFromInfo } from '../player/track.js';
import { UserError } from '../util/errors.js';
import { coverage, isUrl, tokens } from '../util/text.js';
import { isSpotifyInput, matchTrack, resolveSpotify } from './spotify.js';
import { extractInfo, search } from './ytdlp.js';

const log = logger.child({ mod: 'resolver' });
const SPOTIFY_BADGE = sourceFromInfo({ url: 'spotify' });

function stripDecorations(title) {
  return String(title ?? '').replace(/[([{][^)\]}]*[)\]}]/g, ' ');
}

/**
 * A search is ambiguous when the top hit doesn't really contain the query, or when a
 * short query matches several different songs equally well ("hello", "believer").
 */
export function isAmbiguous(query, entries) {
  if (entries.length < 2) return false;
  const scores = entries.map((e) => coverage(query, `${e.title ?? ''} ${e.channel ?? e.uploader ?? ''}`));
  if (scores[0] < 0.6) return true;
  const queryTokens = tokens(query);
  if (queryTokens.length > 2) return false;
  // Compare what each title says *besides* the query ("Adele" vs "Lionel Richie").
  const rest = (title) => tokens(stripDecorations(title)).filter((t) => !queryTokens.includes(t)).join(' ');
  const top = rest(entries[0].title);
  return entries.slice(1, 3).some((e, i) => {
    const other = rest(e.title);
    return scores[i + 1] >= scores[0] && top && other && coverage(top, other) < 0.5;
  });
}

/** Attach Spotify metadata to a track and give it the "Spotify → <provider>" badge. */
function spotifyTrack(meta, requester, match = null) {
  const matched = match ? trackFromInfo(match.entry, requester) : null;
  return createTrack({
    url: matched?.url ?? null,
    title: meta.title,
    artist: meta.artist,
    durationSec: meta.durationSec ?? matched?.durationSec,
    thumbnail: meta.thumbnail ?? matched?.thumbnail,
    source: matched ? spotifyBadgeFor(matched.source) : SPOTIFY_BADGE,
    requester,
    spotify: meta,
  });
}

export function spotifyBadgeFor(target) {
  return { name: `Spotify → ${target.name}`, emoji: SPOTIFY_BADGE.emoji, color: SPOTIFY_BADGE.color };
}

/** Resolve the lazy Spotify track at play time. Throws a UserError on a no-match. */
export async function ensurePlayable(track) {
  if (track.url) return track;
  if (!track.spotify) throw new UserError('That track has no playable source.', { code: 'NO_SOURCE' });
  const match = await matchTrack(track.spotify);
  if (!match) {
    throw new UserError(`No playable match found for "${track.spotify.artist} — ${track.spotify.title}".`, {
      hint: 'Spotify audio can\'t be streamed directly. Try /play with a YouTube or SoundCloud link for it.',
      code: 'NO_MATCH',
    });
  }
  const matched = trackFromInfo(match.entry, track.requester);
  track.url = matched.url;
  track.source = spotifyBadgeFor(matched.source);
  track.durationSec ??= matched.durationSec;
  track.thumbnail ??= matched.thumbnail;
  return track;
}

async function resolveSearch(query, requester, { forcePicker }) {
  let entries;
  let provider = config.ytdlp.searchProvider;
  try {
    entries = await search(query, { provider });
  } catch (err) {
    const fallback = config.ytdlp.fallbackSearchProvider;
    if (!fallback) throw err;
    log.warn({ code: err.code, fallback }, 'primary search failed, using fallback provider');
    provider = fallback;
    entries = await search(query, { provider });
  }
  entries = entries.filter((e) => e.url && e.live_status !== 'is_upcoming');
  if (entries.length === 0) {
    throw new UserError(`No results for "${query}".`, { hint: 'Check the spelling, or paste a direct link.', code: 'NO_RESULTS' });
  }
  const tracks = entries.map((e) => trackFromInfo(e, requester));
  if (forcePicker || isAmbiguous(query, entries)) return { kind: 'choices', query, choices: tracks };
  return { kind: 'tracks', tracks: [tracks[0]], fromSearch: true };
}

async function resolveUrl(url, requester) {
  const info = await extractInfo(url);
  // yt-dlp normalises music.youtube.com to www.youtube.com; keep the YouTube Music badge.
  const badgeOverride = /music\.youtube\.com/i.test(url) ? sourceFromInfo({ url }) : null;
  if (info._type === 'playlist' || Array.isArray(info.entries)) {
    const entries = (info.entries ?? []).filter((e) => e && (e.url || e.webpage_url));
    if (entries.length === 0) {
      throw new UserError('That playlist is empty or private.', { hint: 'Make it public or unlisted, then try again.', code: 'EMPTY_PLAYLIST' });
    }
    let tracks = entries.map((e) => {
      const t = trackFromInfo(e, requester);
      // Flat entries of some sites only carry an id-ish title; it gets filled in at play time.
      if (t.source.emoji === '🌐') t.source = sourceFromInfo({ extractor: info.extractor_key, url });
      if (badgeOverride) t.source = badgeOverride;
      return t;
    });
    // "Play from here": a watch?v=X&list=Y link starts the list at X.
    const startId = url.match(/[?&]v=([\w-]{11})/)?.[1];
    const startAt = startId ? entries.findIndex((e) => e.id === startId) : -1;
    if (startAt > 0) tracks = tracks.slice(startAt);
    return {
      kind: 'tracks',
      tracks,
      playlist: { title: info.title ?? 'Playlist', url, capped: tracks.length >= config.maxPlaylistItems },
    };
  }
  const track = trackFromInfo(info, requester);
  if (badgeOverride) track.source = badgeOverride;
  return { kind: 'tracks', tracks: [track] };
}

async function resolveSpotifyInput(input, requester) {
  const result = await resolveSpotify(input);
  if (result.kind === 'track') {
    // Match single tracks immediately so a no-match is reported right away.
    const meta = result.tracks[0];
    const match = await matchTrack(meta);
    if (!match) {
      throw new UserError(`Couldn't find "${meta.artist} — ${meta.title}" on a playable source.`, {
        hint: 'Spotify itself can\'t be streamed. Try searching with different words, or paste a YouTube/SoundCloud link.',
        code: 'NO_MATCH',
      });
    }
    return { kind: 'tracks', tracks: [spotifyTrack(meta, requester, match)] };
  }
  // Albums/playlists are matched lazily, one track ahead of playback.
  return {
    kind: 'tracks',
    tracks: result.tracks.map((meta) => spotifyTrack(meta, requester)),
    playlist: { title: result.title, url: input, capped: result.tracks.length >= config.maxPlaylistItems },
  };
}

/**
 * Turn user input into tracks.
 * @returns {Promise<{kind:'tracks', tracks:object[], playlist?:object} | {kind:'choices', query:string, choices:object[]}>}
 */
export async function resolveQuery(input, requester, { forcePicker = false } = {}) {
  const query = String(input ?? '').trim();
  if (!query) throw new UserError('Tell me what to play.', { hint: 'Type a song name or paste a link.', code: 'EMPTY_QUERY' });
  if (query.length > 500) throw new UserError('That query is too long.', { hint: 'Keep it under 500 characters.', code: 'QUERY_TOO_LONG' });

  if (isSpotifyInput(query)) return resolveSpotifyInput(query, requester);
  if (isUrl(query)) return resolveUrl(query, requester);
  return resolveSearch(query, requester, { forcePicker });
}
