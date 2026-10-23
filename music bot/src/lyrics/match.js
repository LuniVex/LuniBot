/**
 * Music Bot — src/lyrics/match.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { createHash } from 'node:crypto';
import { coverage, normalize, tokens } from '../util/text.js';

// Bracketed/dashed decorations that never change the lyrics.
const DECORATION = /\b(official|video|audio|lyrics?|lyric video|visuali[sz]er|remaster(ed)?|hd|hq|4k|mv|m\/v|explicit|clean|radio edit|single version|album version|mono|stereo|live|feat\.?|ft\.?|featuring|with|prod\.?|from|version|edit|color coded|vevo)\b/i;

/** Title without "(Official Video)", "- 2011 Remaster", "feat. X" — case kept, for queries. */
export function cleanTitle(title) {
  let t = String(title ?? '');
  // (...) and [...] blocks that only hold decorations
  t = t.replace(/[([{【]([^)\]}】]*)[)\]}】]/g, (m, inner) => (DECORATION.test(inner) ? ' ' : m));
  // " - Remastered 2009", " - Live at X", " - Radio Edit"
  t = t.replace(/\s[-–—]\s(?=[^-–—]*$)([^-–—]*)$/, (m, tail) => (DECORATION.test(tail) || /\b(19|20)\d{2}\b/.test(tail) ? '' : m));
  // trailing "feat. X" / "ft. X" outside brackets
  t = t.replace(/\s(feat\.?|ft\.?|featuring)\s.*$/i, '');
  return t.replace(/\s{2,}/g, ' ').trim();
}

/** Normalised title for comparison: cleaned, lower-case, no accents or punctuation. */
export function normTitle(title) {
  return normalize(cleanTitle(title).replace(/[“”"']/g, ''));
}

/** Clean an uploader/artist string: "ArtistVEVO", "Artist - Topic", "Artist Official". */
export function cleanArtist(artist) {
  return String(artist ?? '')
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\b(official|music|channel|records)\s*$/i, '')
    .trim();
}

export function primaryArtist(artist) {
  return cleanArtist(artist).split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?|\band\b|\/)\s*/i)[0]?.trim() ?? '';
}

/**
 * Candidate {title, artist, durationSec} queries for a playing track, best first.
 * Spotify metadata is clean; YouTube titles are often "Artist - Title (Official Video)".
 */
export function metasForTrack(track) {
  const out = [];
  const add = (title, artist) => {
    const t = String(title ?? '').trim();
    if (!t) return;
    const key = `${normTitle(t)}|${normalize(primaryArtist(artist))}`;
    if (!out.some((m) => m.key === key)) out.push({ key, title: t, artist: cleanArtist(artist), durationSec: track.durationSec ?? null });
  };
  if (track.spotify) add(track.spotify.title, track.spotify.artist);
  const split = String(track.title ?? '').match(/^(.{1,60}?)\s+[-–—|]\s+(.+)$/);
  if (split) add(split[2], split[1]);
  add(track.title, track.artist);
  return out.slice(0, 3);
}

/** Strip the artist's words from a title ("Imagine Dragons - Believer" → "believer"). */
function titleWithoutArtist(title, artist) {
  const at = new Set(tokens(primaryArtist(artist)));
  const rest = tokens(normTitle(title)).filter((t) => !at.has(t));
  return rest.length ? rest.join(' ') : normTitle(title);
}

/**
 * Match quality 0..~1.05 between what's playing (`meta`) and a provider result.
 * Title words both ways, primary artist, and duration (within 3s is a strong signal).
 */
export function scoreMatch(meta, cand) {
  const a = titleWithoutArtist(meta.title, meta.artist);
  const b = titleWithoutArtist(cand.title, cand.artist || meta.artist);
  const titleSim = (coverage(a, b) + coverage(b, a)) / 2;

  const metaArtist = primaryArtist(meta.artist);
  const artistSim = metaArtist
    ? Math.max(coverage(metaArtist, cand.artist ?? ''), coverage(metaArtist, `${cand.artist ?? ''} ${cand.title ?? ''}`) * 0.8)
    : 0.5;

  let score = 0.55 * titleSim + 0.3 * artistSim;
  if (meta.durationSec && cand.durationSec) {
    const diff = Math.abs(meta.durationSec - cand.durationSec);
    if (diff <= 3) score += 0.2;
    else if (diff <= 8) score += 0.05;
    else if (diff > 15) score -= 0.3;
  }
  return score;
}

/**
 * Crowd-sourced entries are often titled "Artist - Song (Lyrics)" and uploaded under a
 * channel name; split them back into artist + song.
 */
export function canonical(cand) {
  const split = String(cand.title ?? '').match(/^(.{1,60}?)\s+[-–—]\s+(.+)$/);
  if (split && coverage(cand.artist ?? '', split[1]) < 1) {
    // "7clouds" uploaded "Imagine Dragons - Believer": trust the title's artist.
    return { title: split[2], artist: split[1] };
  }
  if (split) return { title: split[2], artist: cand.artist };
  return { title: cand.title, artist: cand.artist };
}

const VARIANT = /\b(cover|karaoke|instrumental|remix|sped up|slowed|nightcore|8d|piano version|acoustic version|reverb)\b/i;

/** Relevance of a candidate to a free-text manual query. */
export function scoreQuery(query, cand) {
  const c = canonical(cand);
  const label = `${c.artist ?? ''} ${c.title ?? ''}`;
  let score = 0.7 * coverage(query, label) + 0.3 * coverage(normTitle(c.title), query);
  // Covers/remixes only when asked for.
  if (VARIANT.test(c.title ?? '') && !VARIANT.test(query)) score -= 0.25;
  return score;
}

export function songKey(cand) {
  const c = canonical(cand);
  return `${titleWithoutArtist(c.title, c.artist)}|${normalize(primaryArtist(c.artist))}`;
}

/** Cache key: normalised title + primary artist + duration bucket. */
export function cacheKey(meta) {
  const bucket = meta.durationSec ? Math.round(meta.durationSec / 3) : 'x';
  const raw = `${titleWithoutArtist(meta.title, meta.artist)}|${normalize(primaryArtist(meta.artist))}|${bucket}`;
  return createHash('sha1').update(raw).digest('hex');
}
