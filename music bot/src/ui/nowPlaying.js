/**
 * Music Bot — src/ui/nowPlaying.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { PlayerState } from '../player/GuildPlayer.js';
import { FILTERS } from '../player/stream.js';
import { escapeMd, formatDuration, progressBar, trackLabel, truncate } from '../util/format.js';
import { attribution, LID, liveLyrics, lyricsControls } from './lyrics.js';

export const ID = Object.freeze({
  previous: 'mb:prev',
  toggle: 'mb:toggle',
  skip: 'mb:skip',
  stop: 'mb:stop',
  shuffle: 'mb:shuffle',
  loop: 'mb:loop',
  add: 'mb:add',
  queue: 'mb:queue',
  volume: 'mb:volume',
  filters: 'mb:filters',
  addModal: 'mb:addmodal',
});

const VOLUME_STEPS = [10, 25, 50, 75, 100, 125, 150];
const LOOP_LABEL = { off: 'Loop: off', track: 'Loop: track', queue: 'Loop: queue' };
const LOOP_EMOJI = { off: '🔁', track: '🔂', queue: '🔁' };
const STATE_HEADER = {
  [PlayerState.LOADING]: '⏳ Loading…',
  [PlayerState.PLAYING]: '▶️ Now playing',
  [PlayerState.PAUSED]: '⏸️ Paused',
  [PlayerState.RECONNECTING]: '⚠️ Reconnecting to voice…',
};

function controls(player) {
  const hasTrack = Boolean(player.current);
  const paused = player.state === PlayerState.PAUSED;
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(ID.previous).setEmoji('⏮️').setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasTrack && player.history.length === 0),
    new ButtonBuilder().setCustomId(ID.toggle).setEmoji(paused ? '▶️' : '⏸️').setLabel(paused ? 'Resume' : 'Pause')
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary).setDisabled(!hasTrack),
    new ButtonBuilder().setCustomId(ID.skip).setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(!hasTrack),
    new ButtonBuilder().setCustomId(ID.stop).setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(LID.toggle).setEmoji('🎤').setLabel(player.lyricsLive.enabled ? 'Lyrics on' : 'Lyrics')
      .setStyle(player.lyricsLive.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(ID.shuffle).setEmoji('🔀').setStyle(ButtonStyle.Secondary).setDisabled(player.queue.length < 2),
    new ButtonBuilder().setCustomId(ID.loop).setEmoji(LOOP_EMOJI[player.loop]).setLabel(LOOP_LABEL[player.loop])
      .setStyle(player.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder().setCustomId(ID.add).setEmoji('➕').setLabel('Add').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(ID.queue).setEmoji('📜').setLabel(`Queue (${player.queue.length})`).setStyle(ButtonStyle.Secondary),
  );
  const volumeOptions = [...new Set([...VOLUME_STEPS.filter((v) => v <= config.maxVolume)])].map((v) => ({
    label: `${v}%`,
    value: String(v),
    emoji: v === 0 ? '🔇' : v < 50 ? '🔈' : v <= 100 ? '🔉' : '🔊',
    default: v === player.volume,
  }));
  const row3 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(ID.volume).setPlaceholder(`🔊 Volume: ${player.volume}%`).addOptions(volumeOptions),
  );
  const row4 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(ID.filters)
      .setPlaceholder('🎛️ Filters: none')
      .setMinValues(0)
      .setMaxValues(Object.keys(FILTERS).length)
      .addOptions(Object.entries(FILTERS).map(([value, f]) => ({
        label: f.label, value, emoji: f.emoji, default: player.filters.includes(value),
      }))),
  );
  const rows = [row1, row2, row3, row4];
  if (player.lyricsLive.enabled && hasTrack) rows.push(lyricsControls(player));
  return rows;
}

/** Changes whenever the visible live-lyrics window changes. */
export function liveLyricsKey(player) {
  return liveLyrics(player).key;
}

/** The persistent now-playing card. `final` renders a closed card without controls. */
export function nowPlaying(player, { final = null } = {}) {
  const track = player.current;
  const embed = new EmbedBuilder();

  if (final) {
    embed.setColor(0x4f545c).setDescription(`⏹️ ${final}.`);
    return { embeds: [embed], components: [] };
  }

  if (!track) {
    embed.setColor(0x4f545c)
      .setAuthor({ name: '💤 Nothing playing' })
      .setDescription('Use `/play` or the ➕ button to add music.');
    if (player.history.length) embed.addFields({ name: 'Last played', value: escapeMd(trackLabel(player.history.at(-1), 90)) });
    return { embeds: [embed], components: controls(player) };
  }

  const header = STATE_HEADER[player.state] ?? '▶️ Now playing';
  const title = truncate(track.title, 250);
  embed.setColor(track.source?.color ?? 0x5865f2).setAuthor({ name: header }).setTitle(title);
  if (track.url && /^https?:/.test(track.url)) embed.setURL(track.url);
  if (track.thumbnail) embed.setThumbnail(track.thumbnail);

  const lines = [];
  if (track.artist) lines.push(`by **${escapeMd(truncate(track.artist, 100))}**`);
  lines.push('');
  if (player.lyricsLive.enabled) lines.push(liveLyrics(player).text, '');
  lines.push(track.isLive ? '🔴 **LIVE**' : progressBar(player.position, track.durationSec));
  embed.setDescription(lines.join('\n').slice(0, 4096));

  const next = player.loop === 'track' ? track : player.queue[0];
  embed.addFields(
    { name: 'Requested by', value: track.requester?.id ? `<@${track.requester.id}>` : 'Unknown', inline: true },
    { name: 'Source', value: `${track.source?.emoji ?? '🌐'} ${track.source?.name ?? 'Web'}`, inline: true },
    { name: 'Up next', value: next ? escapeMd(trackLabel(next, 60)) : '—', inline: true },
  );

  if (player.lyricsLive.enabled && track.lyrics?.status === 'found') {
    embed.addFields({ name: '\u200b', value: attribution(track.lyrics, player.lyricsLive.offsetMs) });
  }

  const filters = player.filters.map((f) => FILTERS[f]?.label).filter(Boolean).join(', ') || 'none';
  const queueLength = player.queue.reduce((s, t) => s + (t.durationSec ?? 0), 0);
  embed.setFooter({
    text: `Queue: ${player.queue.length} (${formatDuration(queueLength)}) · ${LOOP_LABEL[player.loop]} · Volume ${player.volume}% · Filters: ${filters}`,
  });
  return { embeds: [embed], components: controls(player) };
}
