/**
 * Music Bot — src/bot/lyrics.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { randomBytes } from 'node:crypto';
import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { loadChoice, overrideForTrack, searchLyrics } from '../lyrics/service.js';
import { UserError } from '../util/errors.js';
import { escapeMd, trackLabel, truncate } from '../util/format.js';
import { RateLimiter, TtlCache } from '../util/limits.js';
import { formatOffset, LID, lyricsPageView, lyricsPickerView, noLyricsMessage } from '../ui/lyrics.js';
import { requireSameVoice } from './permissions.js';

const EPHEMERAL = MessageFlags.Ephemeral;
const views = new TtlCache({ ttlMs: 15 * 60_000, max: 2_000 });
const limiter = new RateLimiter({ capacity: 8, perSeconds: 30 });

export const lyricsCommand = new SlashCommandBuilder()
  .setName('lyrics')
  .setDescription('Lyrics for the current song, or search for any song')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((o) => o.setName('query').setDescription('Search manually: song and artist (use when the auto-match is wrong)').setMaxLength(200))
  .addBooleanOption((o) => o.setName('live').setDescription('Turn live, synced lyrics on the now-playing card on or off'));

function token() {
  return randomBytes(9).toString('base64url');
}

function checkRate(userId) {
  const wait = limiter.take(userId);
  if (wait) throw new UserError('You\'re looking up lyrics a bit fast.', { hint: `Try again in ${wait}s.`, code: 'LYRICS_RATE_LIMIT' });
}

function showResult(ctx, interaction, result, label) {
  if (result.status !== 'found') return { content: noLyricsMessage(result.status, label), embeds: [], components: [] };
  const player = ctx.manager.get(interaction.guildId);
  const t = token();
  const entry = { result, label, userId: interaction.user.id, guildId: interaction.guildId, applicable: Boolean(player?.current) };
  views.set(t, entry);
  return lyricsPageView(t, entry, 0);
}

/** /lyrics [query] [live] */
export async function lyrics(interaction, ctx) {
  const query = interaction.options.getString('query')?.trim();
  const live = interaction.options.getBoolean('live');
  const player = ctx.manager.get(interaction.guildId);

  if (live !== null && !query) {
    if (!player?.current) throw new UserError('Nothing is playing right now.', { hint: 'Start something with `/play … lyrics:true`.', code: 'NOTHING_PLAYING' });
    requireSameVoice(interaction.member, player);
    player.setLyricsLive(live, interaction.user.id);
    await interaction.reply({
      content: live ? '🎤 Live lyrics are on — the now-playing card follows the song.' : '🎤 Live lyrics are off.',
      flags: EPHEMERAL,
    });
    return;
  }

  checkRate(interaction.user.id);
  await interaction.deferReply({ flags: EPHEMERAL });

  if (query) {
    const found = await searchLyrics(query);
    if (found.kind === 'choices') {
      const t = token();
      views.set(t, { query, choices: found.choices, userId: interaction.user.id, guildId: interaction.guildId });
      await interaction.editReply(lyricsPickerView(t, query, found.choices));
      return;
    }
    if (found.kind === 'result') {
      await interaction.editReply(showResult(ctx, interaction, found.result, query));
      return;
    }
    await interaction.editReply({ content: noLyricsMessage(found.kind === 'unavailable' ? 'unavailable' : 'none', query) });
    return;
  }

  if (!player?.current) {
    await interaction.editReply({ content: '💤 Nothing is playing.\n💡 Use `/lyrics query:<song> <artist>` to look up any song.' });
    return;
  }
  const track = player.current;
  const result = await player.lyricsForCurrent();
  await interaction.editReply(showResult(ctx, interaction, result, trackLabel(track, 90)));
}

/** Buttons on the now-playing card: 🎤 toggle, ±2s, reset, 📄 full lyrics. */
export async function handleLyricsCardButton(interaction, ctx, player) {
  const id = interaction.customId;
  if (id === LID.full) {
    await interaction.deferReply({ flags: EPHEMERAL });
    const result = (await player.lyricsForCurrent()) ?? { status: 'none' };
    await interaction.editReply(showResult(ctx, interaction, result, player.current ? trackLabel(player.current, 90) : null));
    return;
  }
  requireSameVoice(interaction.member, player);
  await interaction.deferUpdate();
  if (id === LID.toggle) {
    player.setLyricsLive(!player.lyricsLive.enabled, interaction.user.id);
    return;
  }
  const delta = Number(id.slice(LID.offset.length));
  const offset = player.nudgeLyrics(interaction.user.id, delta);
  await interaction.followUp({ content: `⏱️ Lyrics offset ${formatOffset(offset)} — saved for you.`, flags: EPHEMERAL });
}

/** Page buttons, the search picker and "use for current song" on ephemeral lyrics views. */
export async function handleLyricsView(interaction, ctx) {
  const id = interaction.customId;

  if (id.startsWith(LID.page)) {
    const [t, page] = id.slice(LID.page.length).split(':');
    const entry = views.get(t);
    if (!entry?.result) {
      await interaction.update({ content: '⌛ This lyrics view expired. Run `/lyrics` again.', embeds: [], components: [] });
      return;
    }
    await interaction.update(lyricsPageView(t, entry, Number(page) || 0));
    return;
  }

  if (id.startsWith(LID.pick)) {
    const t = id.slice(LID.pick.length);
    const entry = views.get(t);
    if (!entry?.choices) {
      await interaction.update({ content: '⌛ This picker expired. Run `/lyrics` again.', embeds: [], components: [] });
      return;
    }
    const chosen = entry.choices[Number(interaction.values[0])];
    await interaction.deferUpdate();
    const result = await loadChoice(chosen);
    await interaction.editReply(showResult(ctx, interaction, result, `${chosen.c.artist ?? ''} — ${chosen.c.title ?? ''}`));
    return;
  }

  if (id.startsWith(LID.apply)) {
    const entry = views.get(id.slice(LID.apply.length));
    const player = ctx.manager.get(interaction.guildId);
    if (!entry?.result || !player?.current) {
      throw new UserError('Nothing is playing to attach these lyrics to.', { code: 'NOTHING_PLAYING' });
    }
    requireSameVoice(interaction.member, player);
    const track = player.current;
    track.lyrics = entry.result;
    overrideForTrack(track, entry.result); // also used on future plays of this song
    player.refreshNowPlaying();
    await interaction.update({
      content: `📌 Using these lyrics for **${escapeMd(truncate(track.title, 80))}** (and future plays of it).`,
      components: [],
    });
  }
}
