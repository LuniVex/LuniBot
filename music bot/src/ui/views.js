/**
 * Music Bot — src/ui/views.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { escapeMd, formatDuration, trackLabel, truncate } from '../util/format.js';
import { ID } from './nowPlaying.js';

export const QUEUE_PAGE_SIZE = 10;

export const QID = Object.freeze({
  page: 'mbq:page:', // + page number
  shuffle: 'mbq:shuffle',
  clear: 'mbq:clear',
});

export const PICK_PREFIX = 'mbp:';

function link(track, max) {
  const label = escapeMd(trackLabel(track, max));
  return track.url && /^https?:/.test(track.url) ? `[${label}](${track.url})` : label;
}

export function queueView(player, page = 0) {
  const pages = Math.max(1, Math.ceil(player.queue.length / QUEUE_PAGE_SIZE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const start = p * QUEUE_PAGE_SIZE;
  const slice = player.queue.slice(start, start + QUEUE_PAGE_SIZE);
  const total = player.queue.reduce((s, t) => s + (t.durationSec ?? 0), 0);

  const lines = slice.map((t, i) => {
    const dur = t.isLive ? 'LIVE' : formatDuration(t.durationSec);
    return `\`${String(start + i + 1).padStart(2, ' ')}.\` ${link(t, 60)} · \`${dur}\` · <@${t.requester?.id}>`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📜 Queue')
    .setDescription([
      player.current ? `**Now:** ${link(player.current, 70)}` : '**Now:** nothing',
      '',
      lines.length ? lines.join('\n') : '_The queue is empty. Add something with `/play`._',
    ].join('\n').slice(0, 4000))
    .setFooter({ text: `Page ${p + 1}/${pages} · ${player.queue.length} tracks · ${formatDuration(total)} total · loop: ${player.loop}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${QID.page}${p - 1}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
    new ButtonBuilder().setCustomId(`${QID.page}${p + 1}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(p >= pages - 1),
    new ButtonBuilder().setCustomId(QID.shuffle).setEmoji('🔀').setLabel('Shuffle').setStyle(ButtonStyle.Secondary).setDisabled(player.queue.length < 2),
    new ButtonBuilder().setCustomId(QID.clear).setEmoji('🗑️').setLabel('Clear').setStyle(ButtonStyle.Danger).setDisabled(player.queue.length === 0),
  );
  return { embeds: [embed], components: [row] };
}

export function emptyQueueView() {
  return {
    embeds: [new EmbedBuilder().setColor(0x4f545c).setTitle('📜 Queue').setDescription('Nothing is playing. Start with `/play`.')],
    components: [],
  };
}

export function pickerView(token, query, choices) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${PICK_PREFIX}${token}`)
    .setPlaceholder('Pick the one you meant…')
    .addOptions(choices.map((t, i) => ({
      label: truncate(t.title, 100),
      description: truncate(`${t.artist ?? 'Unknown'} · ${t.isLive ? 'LIVE' : formatDuration(t.durationSec)} · ${t.source?.name ?? ''}`, 100),
      value: String(i),
      emoji: t.source?.emoji ?? '🎵',
    })));
  return {
    content: `🔎 A few results match **${escapeMd(truncate(query, 80))}** — which one?`,
    components: [new ActionRowBuilder().addComponents(menu)],
  };
}

export function addModal() {
  return new ModalBuilder()
    .setCustomId(ID.addModal)
    .setTitle('Add to queue')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('query')
        .setLabel('Song name or link')
        .setPlaceholder('e.g. daft punk one more time, or any YouTube/Spotify/SoundCloud link')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(500),
    ));
}
