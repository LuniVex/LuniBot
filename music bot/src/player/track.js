/**
 * Music Bot — src/player/track.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
let seq = 0;

const BADGES = [
  { test: /music\.youtube\.com/i, name: 'YouTube Music', emoji: '🎵', color: 0xff0033 },
  { test: /youtube|youtu\.be/i, name: 'YouTube', emoji: '🟥', color: 0xff0033 },
  { test: /soundcloud/i, name: 'SoundCloud', emoji: '🟧', color: 0xff5500 },
  { test: /bandcamp/i, name: 'Bandcamp', emoji: '🟦', color: 0x1da0c3 },
  { test: /twitch/i, name: 'Twitch', emoji: '🟪', color: 0x9146ff },
  { test: /vimeo/i, name: 'Vimeo', emoji: '🔷', color: 0x1ab7ea },
  { test: /mixcloud/i, name: 'Mixcloud', emoji: '🟫', color: 0x5000ff },
  { test: /audius/i, name: 'Audius', emoji: '🟣', color: 0xcc0fe0 },
  { test: /archive\.org|archiveorg/i, name: 'Internet Archive', emoji: '🏛️', color: 0x428bca },
  { test: /spotify/i, name: 'Spotify', emoji: '🟩', color: 0x1db954 },
];

/** Work out a display badge from the extractor key and/or URL. */
export function sourceFromInfo({ extractor, url }) {
  const probe = `${url ?? ''} ${extractor ?? ''}`;
  const badge = BADGES.find((b) => b.test.test(probe));
  if (badge) return { name: badge.name, emoji: badge.emoji, color: badge.color };
  let host = extractor || 'Web';
  try {
    if (url) host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // keep extractor name
  }
  return { name: host, emoji: '🌐', color: 0x5865f2 };
}

export function createTrack({
  url = null, title, artist = null, durationSec = null, isLive = false, thumbnail = null,
  source = null, requester, spotify = null,
}) {
  return {
    id: `${Date.now().toString(36)}${(seq++).toString(36)}`,
    url,
    title: title || url || 'Unknown title',
    artist,
    durationSec: Number.isFinite(durationSec) ? Math.round(durationSec) : null,
    isLive: Boolean(isLive),
    thumbnail,
    source: source ?? sourceFromInfo({ url }),
    requester,
    // Spotify metadata for tracks that still need matching on a playable source.
    spotify,
    // Cached direct stream info ({url, headers, protocol, resolvedAt, ...}).
    stream: null,
  };
}

function bestThumbnail(info) {
  if (info.thumbnail) return info.thumbnail;
  const list = info.thumbnails ?? [];
  return list.at(-1)?.url ?? null;
}

/** Readable placeholder for flat entries that have no title yet ("city-ports" → "City Ports"). */
export function titleFromUrl(url) {
  try {
    const slug = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
    const words = slug.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[-_]+/g, ' ').trim();
    return words ? words.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : null;
  } catch {
    return null;
  }
}

/** Build a track from a yt-dlp info dict or flat playlist entry. */
export function trackFromInfo(info, requester) {
  const url = info.webpage_url ?? (/^https?:/.test(info.url ?? '') ? info.url : info.original_url) ?? info.url;
  return createTrack({
    url,
    title: info.track ?? info.title ?? titleFromUrl(url),
    artist: info.artist ?? info.creator ?? info.uploader ?? info.channel ?? null,
    durationSec: info.duration ?? null,
    isLive: info.is_live || info.live_status === 'is_live',
    thumbnail: bestThumbnail(info),
    source: sourceFromInfo({ extractor: info.extractor_key ?? info.ie_key, url }),
    requester,
  });
}

/** Copy richer metadata from a full yt-dlp info dict onto a (possibly flat) track. */
export function enrichTrack(track, info) {
  if (!track.spotify) {
    track.title = info.track ?? info.title ?? track.title;
    track.artist = info.artist ?? info.creator ?? info.uploader ?? info.channel ?? track.artist;
    track.thumbnail = bestThumbnail(info) ?? track.thumbnail;
  }
  track.durationSec ??= Number.isFinite(info.duration) ? Math.round(info.duration) : null;
  if (info.is_live || info.live_status === 'is_live') {
    track.isLive = true;
    track.durationSec = null;
  }
}

/** Shape stored in saved playlists. */
export function serializeTrack(t) {
  return {
    url: t.url ?? t.spotify?.spotifyUrl ?? null,
    title: t.spotify?.title ?? t.title,
    artist: t.spotify?.artist ?? t.artist,
    durationSec: t.durationSec,
    source: t.spotify ? 'spotify' : t.source?.name ?? null,
  };
}
