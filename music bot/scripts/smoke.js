/**
 * Music Bot — scripts/smoke.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
/**
 * End-to-end smoke test WITHOUT a Discord connection.
 *
 * Runs the real command handlers, button router, permission checks, GuildPlayer, yt-dlp,
 * ffmpeg and Spotify code against live sources. Only the Discord gateway is faked: a fake
 * voice connection counts the Opus packets the audio player actually dispatches, so
 * "playing" means real audio frames were produced.
 *
 *   npm run smoke
 */
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

process.env.LOG_LEVEL ??= 'warn';
process.env.DATABASE_PATH ??= ':memory:';

const { prepareBinaries } = await import('../src/sources/binaries.js');
const { Store } = await import('../src/db.js');
const { PlayerManager } = await import('../src/player/PlayerManager.js');
const { createTrack } = await import('../src/player/track.js');
const { createInteractionHandler } = await import('../src/bot/interactions.js');
const { config } = await import('../src/config.js');
const { extractInfo } = await import('../src/sources/ytdlp.js');
const { logger } = await import('../src/logger.js');
const ui = await import('../src/ui/nowPlaying.js');
const { FakeConnection, fakeGuild, fakeClient, slash, button, select, replyText, step, waitFor, assert, results } = await import('./lib/harness.js');
const { ID } = ui;

const URLS = {
  search: 'daft punk one more time',
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  spotifyPlaylist: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  bandcamp: 'https://youtube-dl.bandcamp.com/track/youtube-dl-test-song',
  archive: 'https://archive.org/details/MLKDream',
  archiveCollection: 'https://archive.org/details/OTRR_Gunsmoke_Singles',
  youtubePlaylist: 'https://www.youtube.com/playlist?list=PLxA687tYuMWic6QX51JRkgtJ28-1FGIES',
  liveSearch: 'https://www.youtube.com/results?search_query=lofi+radio&sp=EgJAAQ%253D%253D',
  twitch: 'https://www.twitch.tv/lofigirl',
  broken: 'https://www.youtube.com/watch?v=xxxxxxxxxxx',
  unsupported: 'https://example.com/definitely-not-media',
};

const g1 = fakeGuild('g1');
const g2 = fakeGuild('g2');
const client = fakeClient(g1, g2);

// ------------------------------------------------------------------ run

console.log('Preparing yt-dlp / ffmpeg…');
await prepareBinaries();
const store = new Store(':memory:');
const connections = new Map();
const manager = new PlayerManager({
  client, store, ui,
  joinVoice: ({ guildId, channelId }) => {
    const c = new FakeConnection(channelId);
    connections.set(guildId, c);
    return c;
  },
});
const handle = createInteractionHandler({ client, manager, store, log: logger, messageTrigger: true });
const lag = monitorEventLoopDelay({ resolution: 10 });
lag.enable();

const player = () => manager.get('g1');
const conn = () => connections.get('g1');
const packetsGrow = async (ms = 1500) => {
  const before = conn().packets;
  await sleep(ms);
  return conn().packets - before;
};

console.log('\nRunning smoke tests:');

await step('search query via /play plays the best match', async () => {
  const i = slash(g1, 'play', { query: URLS.search });
  await handle(i);
  const text = replyText(i);
  assert(text.startsWith('▶️ Playing'), `reply was: ${text}`);
  await waitFor('playing', () => player()?.state === 'playing');
  const grown = await packetsGrow();
  assert(grown > 40, `only ${grown} opus packets in 1.5s`);
  return `${player().current.title} · ${grown} opus packets/1.5s`;
});

await step('YouTube link queued mid-play', async () => {
  const before = player().current.id;
  const i = slash(g1, 'play', { query: URLS.youtube });
  await handle(i);
  assert(/Up next|Queued/.test(replyText(i)), replyText(i));
  assert(player().current.id === before, 'current track changed');
  assert(player().queue.length === 1, `queue ${player().queue.length}`);
  return replyText(i);
});

await step('Spotify playlist (no API credentials: embed fallback)', async () => {
  const i = slash(g1, 'play', { query: URLS.spotifyPlaylist });
  await handle(i);
  const text = replyText(i);
  assert(/Added \*\*\d+\*\* tracks/.test(text), text);
  assert(player().queue.some((t) => t.spotify), 'no spotify tracks queued');
  return text.slice(0, 90);
});

await step('YouTube playlist import (flat, capped)', async () => {
  const i = slash(g1, 'play', { query: URLS.youtubePlaylist });
  await handle(i);
  const text = replyText(i);
  assert(/Added \*\*\d+\*\* tracks/.test(text), text);
  return text.slice(0, 90);
});

await step(`huge collection is capped (archive.org, ${config.maxPlaylistItems} max)`, async () => {
  const before = player().queue.length;
  const i = slash(g1, 'play', { query: URLS.archiveCollection });
  await handle(i);
  const text = replyText(i);
  assert(/capped at/.test(text), text);
  const added = player().queue.length - before;
  assert(added === config.maxPlaylistItems, `added ${added}`);
  player().queue.splice(before); // keep the rest of the run short
  return text.slice(0, 90);
});

await step('niche links queued (Bandcamp, archive.org)', async () => {
  for (const q of [URLS.bandcamp, URLS.archive]) {
    const i = slash(g1, 'play', { query: q, next: true });
    await handle(i);
    assert(/Up next/.test(replyText(i)), `${q}: ${replyText(i)}`);
  }
  return `queue now ${player().queue.length}`;
});

await step('pause / resume buttons', async () => {
  await handle(button(g1, ID.toggle));
  assert(player().state === 'paused', player().state);
  const whilePaused = await packetsGrow(800);
  await handle(button(g1, ID.toggle));
  assert(player().state === 'playing', player().state);
  const afterResume = await packetsGrow(1000);
  assert(whilePaused <= 5 && afterResume > 20, `paused=${whilePaused} resumed=${afterResume}`);
  return `packets paused=${whilePaused}, resumed=${afterResume}`;
});

await step('volume select restarts seamlessly at position', async () => {
  const pos = player().position;
  await handle(select(g1, ID.volume, ['50']));
  await waitFor('playing after restart', () => player().state === 'playing' && player().stream);
  await sleep(1000);
  assert(player().volume === 50, `volume ${player().volume}`);
  assert(player().position >= pos, `position went back: ${pos} -> ${player().position}`);
  return `pos ${pos.toFixed(1)}s → ${player().position.toFixed(1)}s`;
});

await step('filter select (nightcore + bass boost)', async () => {
  await handle(select(g1, ID.filters, ['nightcore', 'bassboost']));
  await sleep(1500);
  assert(player().filters.join() === 'nightcore,bassboost', player().filters.join());
  assert(player().state === 'playing' && (await packetsGrow(800)) > 10, 'not playing after filter change');
  await handle(select(g1, ID.filters, []));
  return 'applied and cleared';
});

await step('skip button → archive.org (piped through yt-dlp)', async () => {
  await handle(button(g1, ID.skip));
  await waitFor('archive playing', () => player().state === 'playing' && /archive/i.test(player().current?.url ?? ''), 45_000);
  assert(player().current.stream?.needsPipe, 'expected pipe mode for cookie-bound format');
  return `${player().current.title} · ${await packetsGrow(1000)} packets/s`;
});

await step('skip → Bandcamp, then natural end auto-advances', async () => {
  await handle(button(g1, ID.skip));
  await waitFor('bandcamp playing', () => player().state === 'playing' && /bandcamp/.test(player().current?.url ?? ''), 30_000);
  const bandcampTitle = player().current.title;
  await waitFor('advanced past the 10s Bandcamp track', () => player().current && !/bandcamp/.test(player().current.url ?? '') && player().state === 'playing', 40_000);
  return `${bandcampTitle} → ${player().current.title}`;
});

await step('loop button cycles off → track → queue → off', async () => {
  const seen = [];
  for (let n = 0; n < 3; n++) {
    await handle(button(g1, ID.loop));
    seen.push(player().loop);
  }
  assert(seen.join() === 'track,queue,off', seen.join());
  return seen.join(' → ');
});

await step('skip → Spotify track matched on a real source', async () => {
  while (player().queue[0] && !player().queue[0].spotify) player().queue.shift();
  await handle(button(g1, ID.skip));
  await waitFor('spotify track playing', () => player().state === 'playing' && player().current?.spotify, 45_000);
  const t = player().current;
  assert(t.source.name.startsWith('Spotify →'), t.source.name);
  return `${t.artist} — ${t.title} → ${t.url}`;
});

await step('shuffle button', async () => {
  const before = player().queue.map((t) => t.id).join();
  await handle(button(g1, ID.shuffle));
  const after = player().queue.map((t) => t.id).join();
  assert(before !== after && before.split(',').sort().join() === after.split(',').sort().join(), 'queue not permuted');
  return `${player().queue.length} tracks reordered`;
});

await step('previous button returns to the last track', async () => {
  const lastPlayed = player().history.at(-1);
  await handle(button(g1, ID.previous));
  await waitFor('previous playing', () => player().state === 'playing' && player().current?.id === lastPlayed.id, 30_000);
  return player().current.title;
});

await step('source failures are reported and skipped', async () => {
  const i = slash(g1, 'play', { query: URLS.broken });
  await handle(i);
  const err1 = replyText(i);
  assert(err1.includes('❌') && /unavailable/i.test(err1), err1);

  const i2 = slash(g1, 'play', { query: URLS.unsupported });
  await handle(i2);
  const err2 = replyText(i2);
  assert(err2.includes('❌'), err2);

  // Failures discovered at play time: a dead video and a Spotify track with no match.
  const requester = { id: g1.member.id };
  player().enqueue([
    createTrack({ url: URLS.broken, title: 'Dead video', requester }),
    createTrack({ title: 'Zqxjv Nonexistent Wobble 9137', artist: 'Qqqqzz Fake Artist', durationSec: 123, requester, spotify: { title: 'Zqxjv Nonexistent Wobble 9137', artist: 'Qqqqzz Fake Artist', durationSec: 123 } }),
  ], { next: true });
  const msgsBefore = g1.text.messages.length;
  await handle(button(g1, ID.skip));
  await waitFor('recovered to a playing track', () => player().state === 'playing' && player().current?.title !== 'Dead video', 60_000);
  const notices = g1.text.messages.slice(msgsBefore).map((m) => m.payload.content ?? '').join('\n');
  assert(/Skipped \*\*Dead video\*\*/.test(notices), `no notice for dead video: ${notices}`);
  assert(/No playable match/.test(notices), `no notice for spotify no-match: ${notices}`);
  return `${err1.split('\n')[0]} / ${err2.split('\n')[0]} / ${notices.split('\n').filter((l) => l.startsWith('⚠️')).length} play-time skips announced`;
});

await step('voice drop → reconnect → resume at position', async () => {
  await sleep(3000);
  const pos = player().position;
  conn().setStatus('disconnected', { reason: 2, closeCode: 4006 });
  assert(player().state === 'reconnecting', player().state);
  await waitFor('playing again', () => player().state === 'playing', 15_000);
  await sleep(500);
  assert(player().position >= pos - 1, `position ${pos} -> ${player().position}`);
  const notices = g1.text.messages.filter((m) => /voice/i.test(m.payload.content ?? '')).length;
  return `resumed at ${player().position.toFixed(1)}s (was ${pos.toFixed(1)}s), ${notices} chat notices`;
});

await step('live stream plays', async () => {
  const found = await extractInfo(URLS.liveSearch, { playlistEnd: 1 });
  const liveUrl = found.entries?.[0]?.url;
  assert(liveUrl, 'no live stream found to test with');
  const i = slash(g1, 'play', { query: liveUrl, next: true });
  await handle(i);
  await handle(button(g1, ID.skip));
  await waitFor('live playing', () => player().state === 'playing' && player().current?.isLive, 45_000);
  assert((await packetsGrow(1500)) > 30, 'no live audio');
  return player().current.title;
});

await step('Twitch live channel plays (skipped if offline)', async () => {
  const i = slash(g1, 'play', { query: URLS.twitch, next: true });
  await handle(i);
  if (/isn't live right now/.test(replyText(i))) return 'SKIPPED: channel offline';
  await handle(button(g1, ID.skip));
  await waitFor('twitch playing', () => player().state === 'playing' && /twitch/.test(player().current?.url ?? ''), 45_000);
  assert((await packetsGrow(1500)) > 30, 'no twitch audio');
  return `${player().current.title} [${player().current.source.name}]`;
});

await step('per-guild isolation (second server)', async () => {
  const i = slash(g2, 'play', { query: URLS.youtube });
  await handle(i);
  await waitFor('g2 playing', () => manager.get('g2')?.state === 'playing', 30_000);
  assert(manager.players.size === 2, `players ${manager.players.size}`);
  assert(manager.get('g2').queue.length === 0 && player().queue.length > 0, 'queues leaked');
  await handle(button(g2, ID.stop));
  assert(!manager.get('g2') && player().state === 'playing', 'stopping g2 affected g1');
  return 'g2 stopped, g1 still playing';
});

await step('empty channel auto-pauses, returning listener resumes', async () => {
  g1.humans.delete(g1.member.id);
  manager.handleVoiceStateUpdate({ channelId: g1.voice.id, guild: g1.guild }, { id: g1.member.id, channelId: null, guild: g1.guild });
  assert(player().state === 'paused', player().state);
  g1.humans.set(g1.member.id, g1.member);
  manager.handleVoiceStateUpdate({ channelId: null, guild: g1.guild }, { id: g1.member.id, channelId: g1.voice.id, guild: g1.guild });
  assert(player().state === 'playing', player().state);
  return 'paused → resumed';
});

await step('/playlist save + /queue view', async () => {
  const save = slash(g1, 'playlist', { name: 'smoke' }, 'save');
  await handle(save);
  assert(/Saved \*\*\d+\*\*/.test(replyText(save)), replyText(save));
  const q = slash(g1, 'queue', {});
  await handle(q);
  const embed = q.log[0][1].embeds[0].toJSON();
  assert(/Page 1\//.test(embed.footer.text), embed.footer.text);
  return `${replyText(save)} · ${embed.footer.text}`;
});

await step('now-playing card content', async () => {
  await sleep(500);
  const card = g1.text.messages.filter((m) => m.payload.embeds?.length && !m.deleted).at(-1);
  const embed = card.payload.embeds[0].toJSON();
  const fields = embed.fields.map((f) => f.name).join(',');
  assert(fields === 'Requested by,Source,Up next', fields);
  assert(card.payload.components.length === 4, 'expected 4 control rows');
  return `"${embed.author.name}" · ${embed.title} · ${embed.description.split('\n').at(-1)} · edits=${card.edits}`;
});

await step('stop button leaves and closes the card', async () => {
  await handle(button(g1, ID.stop));
  assert(!manager.get('g1'), 'player still registered');
  assert(conn().state.status === 'destroyed', conn().state.status);
  await sleep(200);
  const closed = g1.text.messages.some((m) => /Stopped by/.test(m.payload.embeds?.[0]?.toJSON().description ?? ''));
  assert(closed, 'card not closed');
  return 'disconnected, card shows "Stopped by"';
});

lag.disable();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} passed · event-loop delay p50=${(lag.percentile(50) / 1e6).toFixed(1)}ms p99=${(lag.percentile(99) / 1e6).toFixed(1)}ms max=${(lag.max / 1e6).toFixed(1)}ms`);
store.close();
process.exit(passed === results.length ? 0 : 1);
