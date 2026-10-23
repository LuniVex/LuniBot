/**
 * Music Bot — src/lyrics/providers/musixmatch.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { config } from '../../config.js';
import { cleanTitle, primaryArtist } from '../match.js';
import { makeHttp, ProviderSkip } from './http.js';

const BASE = 'https://api.musixmatch.com/ws/1.1/';
const request = makeHttp('Musixmatch', { capacity: 5, perSeconds: 10 });
const DISCLAIMER = /\*{3,}\s*This Lyrics is NOT for Commercial use\s*\*{3,}[\s\S]*$/i;

// Synced subtitles need a commercial plan; remember a refusal instead of asking every time.
let subtitlesAllowed = true;
let keyRejected = false;

async function call(method, params) {
  if (keyRejected) throw new ProviderSkip('Musixmatch key was rejected');
  const qs = new URLSearchParams({ ...params, apikey: config.lyrics.musixmatchKey, format: 'json' });
  const body = await request(`${BASE}${method}?${qs}`);
  const status = body?.message?.header?.status_code;
  if (status === 401) {
    keyRejected = true;
    throw new ProviderSkip('Musixmatch key was rejected (401)');
  }
  return { status, body: body?.message?.body };
}

function toCandidate(t) {
  return {
    title: t.track_name,
    artist: t.artist_name,
    durationSec: t.track_length || null,
    instrumental: Boolean(t.instrumental),
    url: t.track_share_url?.split('?')[0] ?? null,
    load: async () => {
      let syncedLrc = null;
      if (t.has_subtitles && subtitlesAllowed) {
        const sub = await call('track.subtitle.get', { track_id: t.track_id, subtitle_format: 'lrc' });
        if ([401, 402, 403].includes(sub.status)) subtitlesAllowed = false;
        else syncedLrc = sub.body?.subtitle?.subtitle_body ?? null;
      }
      const lyr = await call('track.lyrics.get', { track_id: t.track_id });
      const rawText = lyr.body?.lyrics?.lyrics_body ?? '';
      const partial = DISCLAIMER.test(rawText);
      return { syncedLrc, plain: rawText.replace(DISCLAIMER, '').trim() || null, partial };
    },
  };
}

/**
 * Musixmatch official API (MUSIXMATCH_API_KEY). The free plan returns a partial lyrics
 * preview and no synced subtitles; a commercial plan unlocks both.
 */
export const musixmatch = {
  id: 'musixmatch',
  name: 'Musixmatch',
  needsKey: true,
  get canSync() {
    return subtitlesAllowed;
  },
  enabled: () => Boolean(config.lyrics.musixmatchKey) && !keyRejected,

  async find(metas) {
    const m = metas[0];
    const params = { q_track: cleanTitle(m.title), q_artist: primaryArtist(m.artist) };
    if (m.durationSec) Object.assign(params, { f_subtitle_length: Math.round(m.durationSec), f_subtitle_length_max_deviation: 3 });
    const { body } = await call('matcher.track.get', params);
    return body?.track ? [toCandidate(body.track)] : [];
  },

  async search(query) {
    const { body } = await call('track.search', { q: query, f_has_lyrics: 1, s_track_rating: 'desc', page_size: 8 });
    return (body?.track_list ?? []).map((x) => toCandidate(x.track));
  },
};
