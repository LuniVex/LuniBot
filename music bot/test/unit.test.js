/**
 * Music Bot — test/unit.test.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Store } from '../src/db.js';
import { TRANSITIONS, PlayerState } from '../src/player/GuildPlayer.js';
import { buildAudioFilter, buildFfmpegArgs, describeStreamFailure, playbackSpeed } from '../src/player/stream.js';
import { serializeTrack, sourceFromInfo, titleFromUrl, trackFromInfo } from '../src/player/track.js';
import { isAmbiguous } from '../src/sources/resolver.js';
import { parseEmbedHtml, parseSpotify, scoreCandidate } from '../src/sources/spotify.js';
import { mapYtdlpError } from '../src/sources/ytdlp.js';
import { formatDuration, progressBar } from '../src/util/format.js';
import { RateLimiter, Semaphore } from '../src/util/limits.js';
import { coverage } from '../src/util/text.js';

describe('format', () => {
  it('formats durations', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(65), '1:05');
    assert.equal(formatDuration(3725), '1:02:05');
    assert.equal(formatDuration(null), '?:??');
  });
  it('draws a progress bar and a live marker', () => {
    assert.match(progressBar(30, 120), /🔘/);
    assert.match(progressBar(30, 120), /0:30 \/ 2:00/);
    assert.equal(progressBar(5, null), '🔴 LIVE');
  });
});

describe('search ambiguity', () => {
  const e = (title, channel = 'x') => ({ title, channel });
  it('auto-plays a clear match', () => {
    assert.equal(isAmbiguous('never gonna give you up', [e('Rick Astley - Never Gonna Give You Up'), e('Never Gonna Give You Up (Lyrics)')]), false);
  });
  it('asks when the top hit does not contain the query', () => {
    assert.equal(isAmbiguous('that one song from the car advert', [e('Top 10 car adverts'), e('Funny ads compilation')]), true);
  });
  it('asks when a short query matches different songs', () => {
    assert.equal(isAmbiguous('hello', [e('Adele - Hello'), e('Lionel Richie - Hello'), e('Hello - Evanescence')]), true);
  });
  it('does not ask when duplicates of one song lead', () => {
    assert.equal(isAmbiguous('hello', [e('Adele - Hello'), e('Adele - Hello (Official Video)'), e('Adele - Hello (Lyrics)')]), false);
  });
});

describe('spotify', () => {
  it('parses links and URIs', () => {
    assert.deepEqual(parseSpotify('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc'), { type: 'track', id: '4uLU6hMCjMI75M1A2tKUQC' });
    assert.deepEqual(parseSpotify('https://open.spotify.com/intl-de/album/1DFixLWuPkv3KT3TnV35m3'), { type: 'album', id: '1DFixLWuPkv3KT3TnV35m3' });
    assert.deepEqual(parseSpotify('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'), { type: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' });
    assert.equal(parseSpotify('https://example.com/track/123'), null);
  });

  it('reads tracks from the embed page', () => {
    const data = { props: { pageProps: { state: { data: { entity: {
      type: 'playlist', name: 'Mix',
      trackList: [
        { title: 'Song A', subtitle: 'Artist 1,\u00a0Artist 2', duration: 200000, uri: 'spotify:track:aaaaaaaaaaaaaaaaaaaaaa', entityType: 'track' },
        { title: 'Podcast', subtitle: 'Show', duration: 1, uri: 'spotify:episode:x', entityType: 'episode' },
      ],
    } } } } } };
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
    const parsed = parseEmbedHtml(html);
    assert.equal(parsed.title, 'Mix');
    assert.equal(parsed.tracks.length, 1);
    assert.deepEqual(
      { title: parsed.tracks[0].title, artist: parsed.tracks[0].artist, durationSec: parsed.tracks[0].durationSec },
      { title: 'Song A', artist: 'Artist 1, Artist 2', durationSec: 200 },
    );
  });

  it('prefers the official audio over covers and wrong lengths', () => {
    const meta = { title: 'Blinding Lights', artist: 'The Weeknd', durationSec: 200 };
    const topic = scoreCandidate(meta, { title: 'Blinding Lights', channel: 'The Weeknd - Topic', duration: 201 });
    const cover = scoreCandidate(meta, { title: 'Blinding Lights (Piano Cover)', channel: 'Some Pianist', duration: 199 });
    const extended = scoreCandidate(meta, { title: 'The Weeknd - Blinding Lights (1 hour loop)', channel: 'Loops', duration: 3600 });
    assert.ok(topic > cover, `${topic} > ${cover}`);
    assert.ok(topic > extended);
    assert.ok(topic >= 0.45);
    assert.ok(scoreCandidate(meta, { title: 'Totally different thing', channel: 'Nobody', duration: 500 }) < 0.45);
  });
});

describe('yt-dlp error mapping', () => {
  const cases = [
    ['ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser', 'YT_BOT_CHECK'],
    ['ERROR: [youtube] abc: Sign in to confirm your age. This video may be inappropriate for some users.', 'AGE_RESTRICTED'],
    ['ERROR: [youtube] abc: Private video. Sign in if you\'ve been granted access', 'PRIVATE'],
    ['ERROR: Unsupported URL: https://example.com/', 'UNSUPPORTED'],
    ['ERROR: [youtube] abc: Video unavailable. This video has been removed', 'UNAVAILABLE'],
    ['ERROR: [youtube] xxxxxxxxxxx: This video is unavailable', 'UNAVAILABLE'],
    ['ERROR: [generic] HTTP Error 429: Too Many Requests', 'RATE_LIMITED'],
    ['ERROR: [youtube] abc: The uploader has not made this video available in your country', 'GEO'],
    ['ERROR: [twitch:stream] monstercat: The channel is not currently live', 'OFFLINE'],
    ['ERROR: [foo] something very odd happened', 'EXTRACT_FAILED'],
  ];
  for (const [stderr, code] of cases) {
    it(`maps ${code}`, () => {
      const err = mapYtdlpError(`WARNING: noise\n${stderr}\n`);
      assert.equal(err.code, code);
      assert.ok(err.message.length > 5);
      assert.ok(err.hint, 'every mapped error carries a fix hint');
    });
  }
});

describe('ffmpeg pipeline', () => {
  const streamInfo = { url: 'https://media.example/a.webm', protocol: 'https', headers: { 'User-Agent': 'UA' } };
  it('reads direct URLs with reconnect + headers and seeks on input', () => {
    const args = buildFfmpegArgs({ streamInfo, seekSec: 42, volume: 80, filters: [] });
    assert.ok(args.includes('-reconnect'));
    assert.equal(args[args.indexOf('-headers') + 1], 'User-Agent: UA\r\n');
    assert.ok(args.indexOf('-ss') < args.indexOf('-i'), 'input seeking');
    assert.equal(args.at(-1), 'pipe:1');
    assert.ok(args.includes('libopus') && args.includes('ogg'), 'ffmpeg encodes opus itself');
  });
  it('seeks on the output for piped input and never seeks live streams', () => {
    const piped = buildFfmpegArgs({ streamInfo, seekSec: 10, volume: 100, filters: [], piped: true });
    assert.ok(piped.indexOf('-ss') > piped.indexOf('-i'));
    const live = buildFfmpegArgs({ streamInfo, seekSec: 10, volume: 100, filters: [], isLive: true });
    assert.ok(!live.includes('-ss'));
  });
  it('builds filter chains and speed', () => {
    assert.equal(buildAudioFilter({ volume: 50, filters: [] }), 'aresample=48000,volume=0.50');
    assert.match(buildAudioFilter({ volume: 100, filters: ['bassboost', 'nightcore'] }), /bass=.*asetrate/);
    assert.equal(playbackSpeed(['nightcore']), 1.25);
    assert.equal(playbackSpeed(['bassboost']), 1);
  });
  it('explains stream failures', () => {
    assert.match(describeStreamFailure('Server returned 403 Forbidden'), /403/);
  });
});

describe('tracks', () => {
  it('badges sources', () => {
    assert.equal(sourceFromInfo({ url: 'https://music.youtube.com/watch?v=x' }).name, 'YouTube Music');
    assert.equal(sourceFromInfo({ extractor: 'Bandcamp', url: 'https://x.bandcamp.com/track/y' }).name, 'Bandcamp');
    assert.equal(sourceFromInfo({ url: 'https://www.nicovideo.jp/watch/sm9' }).name, 'nicovideo.jp');
  });
  it('makes readable placeholder titles for untitled flat entries', () => {
    assert.equal(titleFromUrl('https://soundcloud.com/forss/city-ports'), 'City Ports');
    assert.equal(trackFromInfo({ url: 'https://soundcloud.com/forss/city-ports' }, { id: '1' }).title, 'City Ports');
  });
  it('builds from yt-dlp info and serialises', () => {
    const t = trackFromInfo({ webpage_url: 'https://www.youtube.com/watch?v=x', title: 'T', uploader: 'U', duration: 61.4, extractor_key: 'Youtube' }, { id: '1' });
    assert.equal(t.durationSec, 61);
    assert.deepEqual(serializeTrack(t), { url: 'https://www.youtube.com/watch?v=x', title: 'T', artist: 'U', durationSec: 61, source: 'YouTube' });
  });
});

describe('state machine', () => {
  it('every state is reachable and disconnect is always possible from an active state', () => {
    for (const state of Object.values(PlayerState)) {
      assert.ok(TRANSITIONS[state], `${state} has transitions`);
      if (state !== PlayerState.DISCONNECTED) assert.ok(TRANSITIONS[state].includes(PlayerState.DISCONNECTED), `${state} -> disconnected`);
    }
    assert.deepEqual(TRANSITIONS[PlayerState.DISCONNECTED], [PlayerState.CONNECTING]);
  });
});

describe('limits', () => {
  it('rate-limits per key and refills', () => {
    const rl = new RateLimiter({ capacity: 2, perSeconds: 10 });
    assert.equal(rl.take('a', 1, 0), 0);
    assert.equal(rl.take('a', 1, 0), 0);
    assert.ok(rl.take('a', 1, 0) > 0);
    assert.equal(rl.take('b', 1, 0), 0, 'other users unaffected');
    assert.equal(rl.take('a', 1, 6_000), 0, 'refilled');
  });
  it('caps concurrency', async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    await Promise.all(Array.from({ length: 6 }, () => sem.run(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    })));
    assert.equal(peak, 2);
  });
  it('text coverage', () => {
    assert.equal(coverage('Daft Punk', 'daft punk - one more time'), 1);
    assert.equal(coverage('Café del Mar', 'cafe del mar'), 1);
  });
});

describe('store', () => {
  it('keeps settings, playlists and history per guild/user', () => {
    const s = new Store(':memory:');
    assert.equal(s.getSettings('g1').alwaysOn, false);
    s.updateSettings('g1', { volume: 55, alwaysOn: true, djRoleId: 'r1' });
    assert.deepEqual([s.getSettings('g1').volume, s.getSettings('g1').alwaysOn, s.getSettings('g2').volume !== 55], [55, true, true]);

    const tracks = [
      { url: 'https://a', title: 'A', artist: 'x', durationSec: 10, source: 'YouTube' },
      { url: 'https://b', title: 'B', artist: null, durationSec: null, source: null },
    ];
    assert.equal(s.savePlaylist('u1', 'Road Trip', tracks), 2);
    assert.equal(s.savePlaylist('u1', 'road trip', tracks.slice(0, 1)), 1, 'case-insensitive overwrite');
    assert.equal(s.getPlaylist('u1', 'ROAD TRIP').tracks.length, 1);
    assert.equal(s.getPlaylist('u2', 'Road Trip'), null, 'playlists are per user');
    assert.deepEqual(s.searchPlaylistNames('u1', 'road'), ['Road Trip']);
    assert.equal(s.listPlaylists('u1')[0].track_count, 1);
    assert.equal(s.deletePlaylist('u1', 'Road Trip'), true);
    assert.equal(s.listPlaylists('u1').length, 0);

    s.addHistory('g1', 'u1', { url: 'https://a', title: 'A', source: { name: 'YouTube' } });
    s.addHistory('g1', 'u1', { url: 'https://a', title: 'A', source: { name: 'YouTube' } });
    assert.equal(s.recentForUser('u1').length, 1, 'recent list is de-duplicated');
    s.close();
  });
});

describe('search providers', async () => {
  const S = await import('../src/sources/search.js');
  it('maps URLs to providers', () => {
    assert.equal(S.providerIdForUrl('https://www.youtube.com/watch?v=x'), 'youtube');
    assert.equal(S.providerIdForUrl('https://youtu.be/x'), 'youtube');
    assert.equal(S.providerIdForUrl('https://music.youtube.com/watch?v=x'), 'youtube');
    assert.equal(S.providerIdForUrl('https://bonobomusic.bandcamp.com/track/kerala'), 'bandcamp');
    assert.equal(S.providerIdForUrl('https://audius.co/a/b'), 'audius');
    assert.equal(S.providerIdForUrl('https://archive.org/details/x'), 'archive');
    assert.equal(S.providerIdForUrl('https://notyoutube.com/x'), null);
  });
  it('parses each public search API', () => {
    assert.deepEqual(S.parseBandcamp({ auto: { results: [{ type: 't', name: 'Kerala', band_name: 'Bonobo', item_url_path: 'https://b.bandcamp.com/track/k' }, { type: 'a', name: 'Album' }] } }),
      [{ url: 'https://b.bandcamp.com/track/k', title: 'Kerala', channel: 'Bonobo', duration: null }]);
    assert.equal(S.parseAudius({ data: [{ permalink: '/a/b', title: 'T', user: { name: 'U' }, duration: 9 }] })[0].url, 'https://audius.co/a/b');
    assert.equal(S.parseMixcloud({ data: [{ url: 'https://www.mixcloud.com/u/m/', name: 'M', user: { name: 'U' }, audio_length: 60 }] })[0].duration, 60);
    assert.equal(S.parseArchive({ response: { docs: [{ identifier: 'id', title: 'T', creator: ['C', 'D'] }] } })[0].channel, 'C');
  });
  it('takes blocked providers out of rotation', () => {
    S.clearBlocked();
    assert.equal(S.isBlocked('youtube'), false);
    S.markBlocked('youtube', 'YT_BOT_CHECK');
    assert.equal(S.isBlocked('youtube'), true);
    assert.ok(S.searchStatus().find((p) => p.id === 'youtube').blockedMinutes > 0);
    S.clearBlocked();
  });
});
