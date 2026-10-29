/**
 * Music Bot — src/bot/play.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { PlayerState } from '../player/GuildPlayer.js';
import { createTrack, sourceFromInfo } from '../player/track.js';
import { resolveQuery } from '../sources/resolver.js';
import { UserError } from '../util/errors.js';
import { escapeMd, trackLabel, truncate } from '../util/format.js';
import { RateLimiter, TtlCache } from '../util/limits.js';
import { pickerView } from '../ui/views.js';
import { checkTextChannel, requireVoice } from './permissions.js';

const log = logger.child({ mod: 'play' });

const lookupLimiter = new RateLimiter({ capacity: config.rateLimit.lookupsPerUser, perSeconds: config.rateLimit.perSeconds });

/** Search pickers waiting for a choice, by token. */
export const pendingPicks = new TtlCache({ ttlMs: 90_000, max: 2_000 });

export function checkRate(userId) {
  const wait = lookupLimiter.take(userId);
  if (wait) throw new UserError('You\'re adding things a bit fast.', { hint: `Try again in ${wait}s.`, code: 'USER_RATE_LIMIT' });
}

function describeEnqueue(res, tracks, playlist) {
  if (res.added === 0) {
    throw new UserError('The queue is full.', { hint: `The limit is ${config.maxQueueSize} tracks; skip or clear some first.`, code: 'QUEUE_FULL' });
  }
  const overflow = res.dropped ? ` ${res.dropped} didn't fit (queue limit ${config.maxQueueSize}).` : '';
  if (playlist) {
    const capped = playlist.capped ? ` (capped at ${config.maxPlaylistItems})` : '';
    const spotify = tracks[0]?.spotify ? ' Spotify tracks are matched to a playable source as they come up.' : '';
    return `📃 Added **${res.added}** tracks from **${escapeMd(truncate(playlist.title, 80))}**${capped}.${overflow}${spotify}`;
  }
  const t = tracks[0];
  const label = `**${escapeMd(trackLabel(t, 90))}**`;
  const live = t.isLive ? ' 🔴 LIVE' : '';
  if (res.startedPlaying) return `▶️ Playing ${label}${live}`;
  return res.position === 1 ? `⏭️ Up next: ${label}${live}` : `➕ Queued ${label}${live} at position **#${res.position}**`;
}

/** Connect (if needed) and add already-resolved tracks. Returns the reply text. */
export async function enqueueResolved({ manager, guild, voiceChannel, textChannelId, tracks, playlist = null, next = false }) {
  const player = manager.obtain(guild.id);
  player.setTextChannel(textChannelId);
  try {
    await player.connect(voiceChannel);
  } catch (err) {
    if (player.state === PlayerState.DISCONNECTED && !player.isActive) manager.remove(guild.id, player);
    throw err;
  }
  const res = player.enqueue(tracks, { next });
  return describeEnqueue(res, tracks, playlist);
}

/**
 * The single entry point behind /play, the ➕ modal and the music-channel trigger.
 * @returns {Promise<{content: string} | {picker: object}>}
 */
export async function playRequest({ manager, guild, member, textChannelId, query, next = false, forcePicker = false, lyrics = false }) {
  checkTextChannel(textChannelId);
  const voiceChannel = requireVoice(member, manager.get(guild.id));
  checkRate(member.id);

  const requester = { id: member.id, name: member.displayName };
  const started = Date.now();
  const result = await resolveQuery(query, requester, { forcePicker });
  log.info({ guild: guild.id, user: member.id, kind: result.kind, count: result.tracks?.length ?? result.choices?.length, ms: Date.now() - started }, 'resolved query');

  if (result.kind === 'choices') {
    const token = randomBytes(9).toString('base64url');
    pendingPicks.set(token, { userId: member.id, guildId: guild.id, textChannelId, next, lyrics, query, choices: result.choices });
    return { picker: pickerView(token, query, result.choices) };
  }
  const content = await enqueueResolved({
    manager, guild, voiceChannel, textChannelId, tracks: result.tracks, playlist: result.playlist, next,
  });
  if (lyrics) manager.get(guild.id)?.setLyricsLive(true, member.id);
  const extras = [result.note && `🔁 ${result.note}`, lyrics && '🎤 Live lyrics are on.'].filter(Boolean);
  return { content: [content, ...extras].join('\n') };
}

/** Rebuild playable tracks from a saved playlist. */
export function tracksFromSaved(saved, requester) {
  return saved.map((t) => {
    if (t.source === 'spotify' && /open\.spotify\.com\/track\//.test(t.url)) {
      return createTrack({
        title: t.title, artist: t.artist, durationSec: t.durationSec, requester,
        source: sourceFromInfo({ url: 'spotify' }),
        spotify: { title: t.title, artist: t.artist, durationSec: t.durationSec, spotifyUrl: t.url },
      });
    }
    return createTrack({ url: t.url, title: t.title, artist: t.artist, durationSec: t.durationSec, requester, source: sourceFromInfo({ url: t.url }) });
  });
}
