/**
 * Music Bot — scripts/lyrics-smoke.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
/**
 * End-to-end lyrics check (no Discord connection; live LRCLIB, yt-dlp and FFmpeg).
 * Covers: synced well-known track, obscure plain track, instrumental, wrong-artist manual
 * override + picker, live card advancing / stopping on pause, offsets, cache hits, and a
 * stalled provider not affecting playback.
 *
 *   npm run smoke:lyrics
 */
import { setTimeout as sleep } from 'node:timers/promises';

process.env.LOG_LEVEL ??= 'warn';

const { prepareBinaries } = await import('../src/sources/binaries.js');
const { Store } = await import('../src/db.js');
const { PlayerManager } = await import('../src/player/PlayerManager.js');
const { createInteractionHandler } = await import('../src/bot/interactions.js');
const { configureLyrics, getLyricsForTrack } = await import('../src/lyrics/service.js');
const { lineAt } = await import('../src/lyrics/lrc.js');
const { config } = await import('../src/config.js');
const { logger } = await import('../src/logger.js');
const ui = await import('../src/ui/nowPlaying.js');
const { LID } = await import('../src/ui/lyrics.js');
const { FakeConnection, fakeGuild, fakeClient, slash, button, select, replyText, step, waitFor, assert, results } = await import('./lib/harness.js');

const WELL_KNOWN = 'imagine dragons believer official music video';
const INSTRUMENTAL = 'debussy clair de lune piano';
const ANOTHER_SYNCED = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const g1 = fakeGuild('g1');
const client = fakeClient(g1);
await prepareBinaries();
const store = new Store(':memory:');
configureLyrics({ store });
const manager = new PlayerManager({ client, store, ui, joinVoice: ({ channelId }) => new FakeConnection(channelId) });
const handle = createInteractionHandler({ client, manager, store, log: logger, messageTrigger: true });
const player = () => manager.get('g1');
const card = () => g1.text.messages.filter((m) => m.payload.embeds?.length && !m.deleted).at(-1);
const cardJson = () => card().payload.embeds[0].toJSON();
const boldLine = (desc) => desc.match(/\*\*▸ (.*)\*\*/)?.[1] ?? null;
const lastReply = (i) => i.log.at(-1)?.[1] ?? {};

console.log('\nRunning lyrics checks:');

await step('well-known track: /play lyrics:true → synced lyrics from LRCLIB on the card', async () => {
  const i = slash(g1, 'play', { query: WELL_KNOWN, lyrics: true });
  await handle(i);
  assert(/Live lyrics are on/.test(replyText(i)), replyText(i));
  await waitFor('playing', () => player()?.state === 'playing', 40_000);
  await waitFor('lyrics loaded', () => player().current.lyrics?.status && player().current.lyrics.status !== 'loading', 15_000);
  const ly = player().current.lyrics;
  assert(ly.status === 'found' && ly.hasTiming, `got ${ly.status} timing=${ly.hasTiming}`);
  await sleep(2000);
  const embed = cardJson();
  const attr = embed.fields.find((f) => /Lyrics from/.test(f.value))?.value;
  assert(attr && /LRCLIB/.test(attr) && /synced/.test(attr), `attribution: ${attr}`);
  assert(card().payload.components.length === 5, 'lyrics control row missing');
  return `${player().current.title} → ${ly.matched.artist} — ${ly.matched.title} (${ly.synced.length} timed lines) · "${attr}"`;
});

await step('live card advances with the song, rate-limited', async () => {
  const msg = card();
  const from = msg.editLog.length;
  await sleep(14_000);
  const edits = msg.editLog.slice(from);
  const lines = edits.map((e) => boldLine(e.payload.embeds[0].toJSON().description)).filter(Boolean);
  const distinct = [...new Set(lines)];
  const gaps = edits.slice(1).map((e, k) => e.at - edits[k].at);
  assert(distinct.length >= 3, `only ${distinct.length} distinct highlighted lines: ${distinct.join(' / ')}`);
  assert(Math.min(...gaps) >= config.lyrics.liveMinEditMs - 50, `edits too close: ${Math.min(...gaps)}ms`);
  // The highlighted line should be the one that's actually playing (±1 line for edit latency).
  const ly = player().current.lyrics;
  const expected = lineAt(ly.synced, player().position * 1000 + config.lyrics.lookaheadMs);
  const shown = ly.synced.findIndex((l, idx) => l.text && boldLine(cardJson().description) === l.text.trim() && Math.abs(idx - expected) <= 1);
  assert(shown !== -1, `card shows "${boldLine(cardJson().description)}", expected "${ly.synced[expected]?.text}"`);
  return `${edits.length} edits in 14s (min gap ${Math.min(...gaps)}ms), lines: ${distinct.slice(0, 4).map((l) => `"${l}"`).join(' → ')}…`;
});

await step('pause stops lyric updates; resume restarts them', async () => {
  await handle(button(g1, ui.ID.toggle));
  assert(player().state === 'paused', player().state);
  // The one "⏸️ Paused" edit respects the 1.5s edit gap; after it, nothing should change.
  await sleep(config.lyrics.liveMinEditMs + 700);
  assert(/Paused/.test(cardJson().author.name), `card says ${cardJson().author.name}`);
  const before = card().editLog.length;
  await sleep(4000);
  const during = card().editLog.length - before;
  await handle(button(g1, ui.ID.toggle));
  await sleep(4000);
  const after = card().editLog.length - before - during;
  assert(during === 0, `${during} edits while paused`);
  assert(after >= 1, 'no edits after resume');
  return `edits while paused: ${during}, after resume (4s): ${after}`;
});

await step('offset buttons nudge sync and are saved per user', async () => {
  const user = g1.member.id;
  await handle(button(g1, `${LID.offset}2000`));
  await handle(button(g1, `${LID.offset}2000`));
  assert(store.getLyricsOffset(user) === 4000, `saved ${store.getLyricsOffset(user)}`);
  await sleep(1800);
  assert(/offset \+4\.0s/.test(cardJson().fields.map((f) => f.value).join()), 'card does not show the offset');
  await handle(button(g1, `${LID.offset}-2000`));
  assert(store.getLyricsOffset(user) === 2000, 'minus did not apply');
  await handle(button(g1, `${LID.offset}0`));
  assert(store.getLyricsOffset(user) === 0 && player().lyricsLive.offsetMs === 0, 'reset failed');
  return '+2s +2s → +4.0s saved, −2s → +2.0s, reset → 0';
});

await step('/lyrics for the current song: paginated, badge + source', async () => {
  const i = slash(g1, 'lyrics', {});
  await handle(i);
  const embed = lastReply(i).embeds?.[0]?.toJSON();
  assert(embed, `no embed: ${replyText(i)}`);
  assert(/Source: LRCLIB/.test(embed.footer.text) && /synced/.test(embed.footer.text), embed.footer.text);
  assert(/Lyrics from \*\*LRCLIB\*\*/.test(embed.description), 'attribution line missing');
  return `"${embed.title}" · ${embed.footer.text}`;
});

await step('repeat play loads lyrics instantly from cache', async () => {
  const i = slash(g1, 'play', { query: WELL_KNOWN, next: true });
  await handle(i);
  await handle(button(g1, ui.ID.skip));
  await waitFor('replayed', () => player().state === 'playing', 40_000);
  const ly = player().current.lyrics;
  const t0 = Date.now();
  const again = await getLyricsForTrack(player().current);
  const ms = Date.now() - t0;
  assert(ly?.cached === true || again.cached === true, 'not served from cache');
  assert(ms < 20, `cache lookup took ${ms}ms`);
  return `cached=${again.cached}, lookup ${ms}ms`;
});

await step('obscure track → plain (unsynced) lyrics', async () => {
  const auto = await getLyricsForTrack({ title: 'Bedroom', artist: 'Frizzy P & Mr Cole', durationSec: 153 });
  assert(auto.status === 'found' && !auto.hasTiming, `auto: ${auto.status} timing=${auto.hasTiming}`);
  const i = slash(g1, 'lyrics', { query: 'Frizzy P Bedroom' });
  await handle(i);
  const embed = lastReply(i).embeds?.[0]?.toJSON();
  assert(embed && /unsynced/.test(embed.footer.text), `reply: ${replyText(i) || embed?.footer?.text}`);
  return `${auto.plain.split('\n').length} lines · ${embed.footer.text}`;
});

await step('instrumental → clean message, never an empty embed', async () => {
  const i = slash(g1, 'play', { query: INSTRUMENTAL, next: true });
  await handle(i);
  await handle(button(g1, ui.ID.skip));
  await waitFor('instrumental playing', () => player().state === 'playing' && /clair/i.test(player().current?.title ?? ''), 40_000);
  await waitFor('lookup done', () => player().current.lyrics && player().current.lyrics.status !== 'loading', 15_000);
  const status = player().current.lyrics.status;
  const l = slash(g1, 'lyrics', {});
  await handle(l);
  const reply = lastReply(l);
  assert(!reply.embeds?.length, 'rendered an embed for an instrumental');
  assert(/instrumental|Couldn't find lyrics/i.test(reply.content), reply.content);
  await sleep(1600);
  assert(/Instrumental|No lyrics found/.test(cardJson().description), 'card has no lyrics status');
  return `${player().current.title}: ${status} → "${reply.content.split('\n')[0]}"`;
});

await step('wrong artist → no auto match → /lyrics query picker → pin to current song', async () => {
  const wrong = await getLyricsForTrack({ title: 'Believer', artist: 'Totally Wrong Band', durationSec: 999 });
  assert(wrong.status === 'none', `auto-match should fail, got ${wrong.status}`);
  const i = slash(g1, 'lyrics', { query: 'believer' });
  await handle(i);
  const picker = lastReply(i);
  const options = picker.components?.[0]?.toJSON().components[0].options ?? [];
  assert(options.length >= 2, `expected a picker, got: ${picker.content}`);
  const pickIdx = options.findIndex((o) => /imagine ?dragons/i.test(o.description));
  assert(pickIdx !== -1, 'Imagine Dragons not among choices');
  const customId = picker.components[0].toJSON().components[0].custom_id;
  const sel = select(g1, customId, [String(pickIdx)]);
  await handle(sel);
  const page = lastReply(sel).embeds?.[0]?.toJSON();
  assert(page && /Believer/i.test(page.title), `picked view: ${JSON.stringify(lastReply(sel)).slice(0, 200)}`);
  const applyId = lastReply(sel).components[0].toJSON().components.find((c) => c.custom_id?.startsWith(LID.apply))?.custom_id;
  const apply = button(g1, applyId);
  await handle(apply);
  assert(/Using these lyrics/.test(replyText(apply)), replyText(apply));
  assert(player().current.lyrics.matched.title.toLowerCase().includes('believer'), 'override not applied');
  const cachedNow = await getLyricsForTrack(player().current);
  assert(cachedNow.cached && /believer/i.test(cachedNow.matched.title), 'override not persisted to cache');
  return `${options.length} choices → picked "${options[pickIdx].label} · ${options[pickIdx].description}" → pinned`;
});

await step('stalled provider never stalls playback; degrades to a plain message', async () => {
  const realFetch = globalThis.fetch;
  // LRCLIB hangs until our per-request timeout aborts it.
  globalThis.fetch = (url, opts) => (String(url).includes('lrclib.net')
    ? new Promise((_, reject) => opts?.signal?.addEventListener('abort', () => reject(opts.signal.reason)))
    : realFetch(url, opts));
  try {
    const i = slash(g1, 'play', { query: ANOTHER_SYNCED, next: true });
    await handle(i);
    await handle(button(g1, ui.ID.skip));
    await waitFor('playing despite lyrics lookup', () => player().state === 'playing' && /rick/i.test(player().current?.title ?? ''), 40_000);
    const lyricsWhenPlaying = player().current.lyrics?.status;
    await waitFor('lookup gave up', () => player().current.lyrics?.status === 'unavailable', 20_000);
    await sleep(1600);
    assert(/unreachable/.test(cardJson().description), 'card does not explain');
    return `audio started while lyrics were "${lyricsWhenPlaying}"; lookup ended "unavailable" and the card says so`;
  } finally {
    globalThis.fetch = realFetch;
  }
});

await handle(button(g1, ui.ID.stop));
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} passed`);
store.close();
process.exit(passed === results.length ? 0 : 1);
