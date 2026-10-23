/**
 * Music Bot — src/ui/lyrics.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { config } from '../config.js';
import { lineAt } from '../lyrics/lrc.js';
import { escapeMd, formatDuration, truncate } from '../util/format.js';

export const LID = Object.freeze({
  toggle: 'mb:lyrics',
  offset: 'mb:lyroff:', // + delta in ms ("0" resets)
  full: 'mb:lyrfull',
  page: 'mbl:page:', // + token:page
  pick: 'mbl:pick:', // + token
  apply: 'mbl:apply:', // + token
});

const PAGE_CHARS = 1800;
const LINE_CHARS = 140;

export function formatOffset(ms) {
  return `${ms >= 0 ? '+' : '−'}${(Math.abs(ms) / 1000).toFixed(1)}s`;
}

/** "Lyrics: LRCLIB · ⏱️ synced" — shown on every lyrics view. */
export function attribution(lyrics, offsetMs = 0) {
  const kind = lyrics.hasTiming ? '⏱️ synced' : '📝 unsynced';
  const partial = lyrics.partial ? ' (partial preview)' : '';
  const offset = lyrics.hasTiming && offsetMs ? ` · offset ${formatOffset(offsetMs)}` : '';
  return `🎤 Lyrics from **${lyrics.source}**${partial} · ${kind}${offset}`;
}

function line(text) {
  return escapeMd(truncate(text.trim(), LINE_CHARS)) || '♪';
}

/**
 * The live lyrics window for the now-playing card: two dimmed lines before, the current
 * line in bold, two after. `key` changes only when the visible window changes, so the
 * card is edited only when there is something new to show.
 */
export function liveLyrics(player) {
  const track = player.current;
  const lyrics = track?.lyrics;
  if (!lyrics || lyrics.status === 'loading') return { text: '🎤 *Looking up lyrics…*', key: 'loading' };
  if (lyrics.status === 'instrumental') return { text: '🎼 *Instrumental — no lyrics.*', key: 'instrumental' };
  if (lyrics.status === 'unavailable') return { text: '⚠️ *Lyrics providers are unreachable right now.*', key: 'unavailable' };
  if (lyrics.status !== 'found') return { text: '🔎 *No lyrics found for this track.* Try `/lyrics query:`', key: 'none' };

  if (lyrics.hasTiming) {
    const ms = player.position * 1000 + player.lyricsLive.offsetMs + config.lyrics.lookaheadMs;
    const i = lineAt(lyrics.synced, ms);
    const out = [];
    for (let k = i - 2; k <= i + 2; k++) {
      if (k < 0 || k >= lyrics.synced.length) continue;
      const text = line(lyrics.synced[k].text);
      if (k < i) out.push(`-# ${text}`);
      else if (k === i) out.push(`**▸ ${text}**`);
      else out.push(text);
    }
    if (i < 0) out.unshift('**▸ ♪**');
    return { text: out.join('\n'), key: `${track.id}:${i}` };
  }

  // Unsynced: no timing to follow, so scroll proportionally and say so.
  const lines = lyrics.plain.split('\n').filter((l) => l.trim());
  const ratio = track.durationSec ? Math.min(1, player.position / track.durationSec) : 0;
  const at = Math.min(lines.length - 1, Math.floor(ratio * lines.length));
  const window = lines.slice(Math.max(0, at - 2), at + 3).map(line);
  return { text: ['-# 📝 unsynced lyrics — approximate position', ...window].join('\n'), key: `${track.id}:u${at}` };
}

/** Extra row on the card while live lyrics are on: sync nudges + full text. */
export function lyricsControls(player) {
  const offset = player.lyricsLive.offsetMs;
  const synced = Boolean(player.current?.lyrics?.hasTiming);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${LID.offset}-2000`).setLabel('−2s').setEmoji('⏪').setStyle(ButtonStyle.Secondary).setDisabled(!synced),
    new ButtonBuilder().setCustomId(`${LID.offset}2000`).setLabel('+2s').setEmoji('⏩').setStyle(ButtonStyle.Secondary).setDisabled(!synced),
    new ButtonBuilder().setCustomId(`${LID.offset}0`).setLabel(offset ? `Sync ${formatOffset(offset)} · reset` : 'In sync')
      .setStyle(ButtonStyle.Secondary).setDisabled(!synced || offset === 0),
    new ButtonBuilder().setCustomId(LID.full).setEmoji('📄').setLabel('Full lyrics').setStyle(ButtonStyle.Secondary)
      .setDisabled(player.current?.lyrics?.status !== 'found'),
  );
}

/** Split long lyrics into embed-sized pages, breaking between stanzas where possible. */
export function paginate(text, size = PAGE_CHARS) {
  const pages = [];
  let current = '';
  const push = (chunk, sep) => {
    if (current && current.length + sep.length + chunk.length > size) {
      pages.push(current);
      current = '';
    }
    current = current ? current + sep + chunk : chunk;
  };
  for (const stanza of text.split(/\n\s*\n/)) {
    if (stanza.length <= size) {
      push(stanza, '\n\n');
      continue;
    }
    for (const l of stanza.split('\n')) {
      for (let i = 0; i < l.length; i += size) push(l.slice(i, i + size), '\n');
    }
  }
  if (current) pages.push(current);
  return pages.length ? pages : [''];
}

/** Paginated full-text view (ephemeral). `entry` = { result, label, applicable }. */
export function lyricsPageView(token, entry, page = 0) {
  const { result } = entry;
  const pages = entry.pages ?? (entry.pages = paginate(result.plain));
  const p = Math.min(Math.max(0, page), pages.length - 1);
  const title = result.matched?.title || entry.label || 'Lyrics';
  const embed = new EmbedBuilder()
    .setColor(result.hasTiming ? 0x1db954 : 0x5865f2)
    .setTitle(truncate(`🎤 ${title}`, 250))
    .setDescription(`${escapeMd(pages[p])}\n\n${attribution(result)}`.slice(0, 4096))
    .setFooter({ text: `Page ${p + 1}/${pages.length} · ${result.hasTiming ? 'synced' : 'unsynced'} · Source: ${result.source}` });
  if (result.matched?.artist) embed.setAuthor({ name: truncate(result.matched.artist, 250) });
  if (result.url && /^https?:/.test(result.url) && !result.url.includes('/api/')) embed.setURL(result.url);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${LID.page}${token}:${p - 1}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
    new ButtonBuilder().setCustomId(`${LID.page}${token}:${p + 1}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(p >= pages.length - 1),
  );
  if (entry.applicable) {
    row.addComponents(new ButtonBuilder().setCustomId(`${LID.apply}${token}`).setEmoji('📌').setLabel('Use for current song').setStyle(ButtonStyle.Primary));
  }
  return { content: '', embeds: [embed], components: [row] };
}

export function lyricsPickerView(token, query, choices) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${LID.pick}${token}`)
    .setPlaceholder('Pick the song you meant…')
    .addOptions(choices.map(({ c, provider }, i) => ({
      label: truncate(c.title || 'Unknown title', 100),
      description: truncate([
        c.artist || 'Unknown artist',
        c.durationSec ? formatDuration(c.durationSec) : null,
        c.instrumental ? 'instrumental' : c.syncedLrc ? 'synced' : 'lyrics',
        provider.name,
      ].filter(Boolean).join(' · '), 100),
      value: String(i),
    })));
  return {
    content: `🔎 Several songs match **${escapeMd(truncate(query, 80))}** — which one?`,
    embeds: [],
    components: [new ActionRowBuilder().addComponents(menu)],
  };
}

/** Plain-text answers for every "no lyrics" outcome. Never an empty embed. */
export function noLyricsMessage(status, label) {
  const what = label ? `**${escapeMd(truncate(label, 90))}**` : 'that';
  if (status === 'instrumental') return `🎼 ${what} is an instrumental — there are no lyrics to show.`;
  if (status === 'unavailable') return '⚠️ The lyrics providers are unreachable right now. Try again in a minute.';
  return `🔎 Couldn't find lyrics for ${what}.\n💡 Search manually with \`/lyrics query:<song> <artist>\`.`;
}
