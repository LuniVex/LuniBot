/**
 * Music Bot — test/lyrics.test.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Store } from '../src/db.js';
import { lineAt, parseLrc } from '../src/lyrics/lrc.js';
import { cacheKey, canonical, cleanTitle, metasForTrack, normTitle, scoreMatch, scoreQuery, songKey } from '../src/lyrics/match.js';
import { extractGeniusLyrics } from '../src/lyrics/providers/genius.js';
import { finalize, looksReal } from '../src/lyrics/service.js';
import { liveLyrics, noLyricsMessage, paginate } from '../src/ui/lyrics.js';

describe('LRC parsing', () => {
  it('parses stamps, multi-stamps, offsets and enhanced word stamps', () => {
    const lines = parseLrc('[ar:Someone]\n[offset:+500]\n[00:01.50]First\n[00:03.00][00:10.000]Chorus\n[00:05.7]<00:05.70>Word <00:06.00>sync\n[00:08.00]');
    assert.deepEqual(lines.map((l) => [l.timeMs, l.text]), [
      [1000, 'First'], [2500, 'Chorus'], [5200, 'Word sync'], [7500, ''], [9500, 'Chorus'],
    ]);
  });
  it('finds the active line', () => {
    const synced = parseLrc('[00:01.00]a\n[00:02.00]b\n[00:03.00]c');
    assert.equal(lineAt(synced, 500), -1);
    assert.equal(lineAt(synced, 2000), 1);
    assert.equal(lineAt(synced, 99_000), 2);
  });
});

describe('matching', () => {
  it('normalises decorations, remasters, feat. and casing', () => {
    assert.equal(normTitle('Never Gonna Give You Up (Official Video) (4K Remaster)'), 'never gonna give you up');
    assert.equal(normTitle('Bohemian Rhapsody - Remastered 2011'), 'bohemian rhapsody');
    assert.equal(normTitle('expectations (feat. Chappell Roan)'), 'expectations');
    assert.equal(normTitle('Song ft. Someone Else'), 'song');
    assert.equal(cleanTitle('Believer [Official Lyric Video]'), 'Believer');
    assert.equal(normTitle('Hello (Remix)'), 'hello remix', 'remixes are kept');
  });
  it('derives queries from YouTube-style titles and Spotify metadata', () => {
    const metas = metasForTrack({ title: 'Imagine Dragons - Believer (Lyrics)', artist: '7clouds', durationSec: 205 });
    assert.equal(metas[0].artist, 'Imagine Dragons');
    assert.equal(metasForTrack({ title: 'x', artist: 'y', spotify: { title: 'Real', artist: 'Artist' } })[0].title, 'Real');
  });
  it('treats duration within 3s as a strong signal', () => {
    const meta = { title: 'Believer', artist: 'Imagine Dragons', durationSec: 204 };
    const exact = scoreMatch(meta, { title: 'Believer', artist: 'Imagine Dragons', durationSec: 205 });
    const longer = scoreMatch(meta, { title: 'Believer', artist: 'Imagine Dragons', durationSec: 260 });
    const other = scoreMatch(meta, { title: 'Believer', artist: 'Rhett Walker', durationSec: 230 });
    assert.ok(exact > 0.9 && exact > longer && longer > other, `${exact} ${longer} ${other}`);
    assert.ok(other < 0.65, 'a different song with the same name is rejected');
  });
  it('copes with "Artist - Song (Lyrics)" uploads', () => {
    assert.deepEqual(canonical({ title: 'Imagine Dragons - Believer (Lyrics)', artist: '7clouds' }), { title: 'Believer (Lyrics)', artist: 'Imagine Dragons' });
    assert.equal(songKey({ title: 'Imagine Dragons - Believer (Audio)', artist: 'Imagine Dragons' }), songKey({ title: 'Believer', artist: 'Imagine Dragons' }));
    assert.ok(scoreQuery('believer imagine dragons', { title: 'Believer (Imagine Dragons Cover)', artist: 'Solence' })
      < scoreQuery('believer imagine dragons', { title: 'Believer', artist: 'Imagine Dragons' }));
  });
  it('builds stable cache keys', () => {
    const a = cacheKey({ title: 'Believer (Official Video)', artist: 'Imagine Dragons', durationSec: 204 });
    const b = cacheKey({ title: 'believer', artist: 'IMAGINE DRAGONS', durationSec: 205 });
    assert.equal(a, b);
    assert.notEqual(a, cacheKey({ title: 'Believer', artist: 'Imagine Dragons', durationSec: 260 }));
  });
});

describe('results', () => {
  const provider = { name: 'Test' };
  it('normalises to one shape and prefers real content', () => {
    const synced = finalize({ title: 'T', artist: 'A', syncedLrc: '[00:01.00]one\n[00:02.00]two\n[00:03.00]three\n[00:04.00]four', plain: null }, provider);
    assert.equal(synced.hasTiming, true);
    assert.equal(synced.plain, 'one\ntwo\nthree\nfour');
    assert.equal(synced.source, 'Test');
    const junk = finalize({ title: 'T', artist: 'A', plain: 'probe', syncedLrc: '[00:00.00]probe' }, provider);
    assert.equal(junk.hasTiming, false);
    assert.equal(looksReal(junk), false, 'vandalised records are rejected');
    assert.equal(finalize({ title: 'T', instrumental: true }, provider).status, 'instrumental');
  });
  it('extracts Genius lyrics, skipping the header widget', () => {
    const html = '<div data-lyrics-container="true" class="x"><div data-exclude-from-selection="true"><div>477 Contributors</div><p>blurb</p></div>[Verse 1]<br/>Line &amp; one<br><i>Line two</i></div><div>other</div>';
    assert.equal(extractGeniusLyrics(html), '[Verse 1]\nLine & one\nLine two');
  });
});

describe('display', () => {
  it('paginates long lyrics between stanzas and splits huge blocks', () => {
    const stanza = Array.from({ length: 8 }, (_, i) => `line ${i} ${'x'.repeat(40)}`).join('\n');
    const pages = paginate(Array.from({ length: 12 }, () => stanza).join('\n\n'), 1000);
    assert.ok(pages.length > 3 && pages.every((p) => p.length <= 1000));
    assert.ok(paginate('y'.repeat(5000), 1800).every((p) => p.length <= 1800));
  });
  it('renders the live window with the current line in bold and 2 lines of context', () => {
    const synced = parseLrc([1, 2, 3, 4, 5, 6, 7].map((s) => `[00:0${s}.00]line ${s}`).join('\n'));
    const player = { position: 4.2, lyricsLive: { offsetMs: 0 }, current: { id: 't', lyrics: { status: 'found', hasTiming: true, synced } } };
    const { text } = liveLyrics(player);
    assert.deepEqual(text.split('\n'), ['-# line 2', '-# line 3', '**▸ line 4**', 'line 5', 'line 6']);
    player.lyricsLive.offsetMs = 2000;
    assert.match(liveLyrics(player).text, /\*\*▸ line 6\*\*/, 'offset shifts the highlight');
  });
  it('never renders an empty view', () => {
    for (const status of ['instrumental', 'none', 'unavailable']) assert.ok(noLyricsMessage(status, 'Song').length > 10);
    assert.match(liveLyrics({ current: { id: 'x', lyrics: { status: 'instrumental' } }, lyricsLive: {} }).text, /Instrumental/);
  });
});

describe('lyrics storage', () => {
  it('caches with TTL and stores per-user offsets', () => {
    const s = new Store(':memory:');
    s.putLyrics('k', { status: 'found', plain: 'x' }, 60_000);
    assert.equal(s.getLyrics('k').plain, 'x');
    s.putLyrics('old', { status: 'none' }, -1);
    assert.equal(s.getLyrics('old'), null, 'expired entries are not served');
    assert.equal(s.pruneLyrics(), 1);
    assert.equal(s.getLyricsOffset('u'), 0);
    s.setLyricsOffset('u', -2000);
    assert.equal(s.getLyricsOffset('u'), -2000);
    s.close();
  });
});
