/**
 * Music Bot — src/bot/commands.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { serializeTrack } from '../player/track.js';
import { suggest } from '../sources/suggest.js';
import { formatUserError, UserError } from '../util/errors.js';
import { escapeMd, truncate } from '../util/format.js';
import { isUrl } from '../util/text.js';
import { emptyQueueView, queueView } from '../ui/views.js';
import { providerStatus } from '../lyrics/service.js';
import { searchStatus } from '../sources/search.js';
import { lyrics, lyricsCommand } from './lyrics.js';
import { checkRate, enqueueResolved, playRequest, tracksFromSaved } from './play.js';
import { checkTextChannel, requireVoice } from './permissions.js';

const EPHEMERAL = MessageFlags.Ephemeral;

export const commandData = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song, playlist, album or live stream — search text or any link')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('query')
      .setDescription('Song name, or a YouTube / Spotify / SoundCloud / Bandcamp / Twitch / … link')
      .setRequired(true).setAutocomplete(true).setMaxLength(500))
    .addBooleanOption((o) => o.setName('next').setDescription('Put it at the front of the queue'))
    .addBooleanOption((o) => o.setName('choose').setDescription('Always let me pick from the search results'))
    .addBooleanOption((o) => o.setName('lyrics').setDescription('Show live, synced lyrics on the now-playing card')),

  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show what\'s queued')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1)),

  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Music settings for this server')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('view').setDescription('Show the current settings'))
    .addSubcommand((s) => s.setName('volume').setDescription('Default volume for new sessions')
      .addIntegerOption((o) => o.setName('percent').setDescription('1–150').setRequired(true).setMinValue(1).setMaxValue(config.maxVolume)))
    .addSubcommand((s) => s.setName('dj-role').setDescription('Limit controls to a DJ role (leave empty to clear)')
      .addRoleOption((o) => o.setName('role').setDescription('The DJ role')))
    .addSubcommand((s) => s.setName('always-on').setDescription('24/7 mode: stay in voice even when idle or alone')
      .addBooleanOption((o) => o.setName('enabled').setDescription('On or off').setRequired(true)))
    .addSubcommand((s) => s.setName('music-channel').setDescription('Text channel where any message is played as a request (empty to clear)')
      .addChannelOption((o) => o.setName('channel').setDescription('Text channel').addChannelTypes(ChannelType.GuildText))),

  new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Your personal saved playlists')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('save').setDescription('Save the current track + queue as a playlist')
      .addStringOption((o) => o.setName('name').setDescription('Playlist name').setRequired(true).setMaxLength(50).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('load').setDescription('Queue one of your playlists')
      .addStringOption((o) => o.setName('name').setDescription('Playlist name').setRequired(true).setAutocomplete(true))
      .addBooleanOption((o) => o.setName('shuffle').setDescription('Shuffle it while loading')))
    .addSubcommand((s) => s.setName('list').setDescription('List your playlists'))
    .addSubcommand((s) => s.setName('delete').setDescription('Delete one of your playlists')
      .addStringOption((o) => o.setName('name').setDescription('Playlist name').setRequired(true).setAutocomplete(true))),
  lyricsCommand,
].map((c) => c.toJSON());

/**
 * Shared by /play and the ➕ modal. The reply is public on success; failures and pickers
 * replace it with an ephemeral message so only the requester sees them.
 */
export async function runPlay(interaction, ctx, { query, next = false, forcePicker = false, lyrics = false }) {
  await interaction.deferReply();
  try {
    const result = await playRequest({
      manager: ctx.manager,
      guild: interaction.guild,
      member: interaction.member,
      textChannelId: interaction.channelId,
      query,
      next,
      forcePicker,
      lyrics,
    });
    if (result.picker) {
      await interaction.deleteReply().catch(() => {});
      await interaction.followUp({ ...result.picker, flags: EPHEMERAL });
      return;
    }
    await interaction.editReply({ content: result.content, allowedMentions: { parse: [] } });
  } catch (err) {
    await interaction.deleteReply().catch(() => {});
    await interaction.followUp({ content: formatUserError(err), flags: EPHEMERAL });
    if (!(err instanceof UserError)) ctx.log.error({ err }, 'play failed');
  }
}

async function play(interaction, ctx) {
  await runPlay(interaction, ctx, {
    query: interaction.options.getString('query', true),
    next: interaction.options.getBoolean('next') ?? false,
    forcePicker: interaction.options.getBoolean('choose') ?? false,
    lyrics: interaction.options.getBoolean('lyrics') ?? false,
  });
}

async function queue(interaction, ctx) {
  const player = ctx.manager.get(interaction.guildId);
  if (!player || (!player.current && player.queue.length === 0)) {
    await interaction.reply({ ...emptyQueueView(), flags: EPHEMERAL });
    return;
  }
  const page = (interaction.options.getInteger('page') ?? 1) - 1;
  await interaction.reply({ ...queueView(player, page), flags: EPHEMERAL, allowedMentions: { parse: [] } });
}

function settingsEmbed(s, ctx) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('⚙️ Music settings')
    .addFields(
      { name: 'Default volume', value: `${s.volume}%`, inline: true },
      { name: 'DJ role', value: s.djRoleId ? `<@&${s.djRoleId}>` : 'none (everyone can use controls)', inline: true },
      { name: '24/7 mode', value: s.alwaysOn ? 'on' : 'off', inline: true },
      {
        name: 'Music channel',
        value: s.musicChannelId
          ? `<#${s.musicChannelId}>${ctx.messageTrigger ? '' : ' ⚠️ inactive: Message Content intent is not enabled'}`
          : 'none',
        inline: true,
      },
      { name: 'Queue limit', value: String(config.maxQueueSize), inline: true },
      { name: 'Playlist import cap', value: String(config.maxPlaylistItems), inline: true },
      {
        name: 'Search order',
        value: searchStatus().map((p, i) => `${i + 1}. ${p.name}${p.blockedMinutes ? ` — ⛔ skipped for ${p.blockedMinutes} min (blocked this server)` : ''}`).join('\n'),
      },
      {
        name: 'Lyrics providers (in order)',
        value: providerStatus().map((p) => `${p.enabled ? '✅' : '⛔'} ${p.name}${p.enabled ? '' : ' — no key set'}`).join('\n'),
      },
    );
}

async function settings(interaction, ctx) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new UserError('You need **Manage Server** to change music settings.', { code: 'NO_MANAGE_GUILD' });
  }
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;
  let note = '';
  if (sub === 'volume') {
    ctx.store.updateSettings(guildId, { volume: interaction.options.getInteger('percent', true) });
    note = 'Applies to new sessions; use the volume menu on the player to change the current one.';
  } else if (sub === 'dj-role') {
    const role = interaction.options.getRole('role');
    ctx.store.updateSettings(guildId, { djRoleId: role?.id ?? null });
  } else if (sub === 'always-on') {
    const enabled = interaction.options.getBoolean('enabled', true);
    ctx.store.updateSettings(guildId, { alwaysOn: enabled });
    if (enabled) note = 'I\'ll stay in voice when idle or alone, and rejoin after restarts.';
  } else if (sub === 'music-channel') {
    const channel = interaction.options.getChannel('channel');
    ctx.store.updateSettings(guildId, { musicChannelId: channel?.id ?? null });
    if (channel) {
      note = ctx.messageTrigger
        ? `Any message in <#${channel.id}> will be played as a request.`
        : '⚠️ This needs the **Message Content** privileged intent, which is not enabled for the bot (see README).';
    }
  }
  const s = ctx.store.getSettings(guildId);
  await interaction.reply({ content: note || undefined, embeds: [settingsEmbed(s, ctx)], flags: EPHEMERAL, allowedMentions: { parse: [] } });
}

async function playlist(interaction, ctx) {
  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  if (sub === 'list') {
    const rows = ctx.store.listPlaylists(userId);
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('🎶 Your playlists').setDescription(
      rows.length
        ? rows.map((r) => `• **${escapeMd(r.name)}** — ${r.track_count} tracks`).join('\n').slice(0, 4000)
        : 'You have no saved playlists yet. Play something, then `/playlist save`.',
    );
    await interaction.reply({ embeds: [embed], flags: EPHEMERAL });
    return;
  }

  const name = interaction.options.getString('name', true).trim();
  if (!name) throw new UserError('Give the playlist a name.', { code: 'BAD_NAME' });

  if (sub === 'save') {
    const player = ctx.manager.get(interaction.guildId);
    const tracks = player ? [player.current, ...player.queue].filter(Boolean) : [];
    if (tracks.length === 0) {
      throw new UserError('There\'s nothing playing or queued to save.', { hint: 'Queue some songs, then run `/playlist save` again.', code: 'NOTHING_TO_SAVE' });
    }
    const saved = ctx.store.savePlaylist(userId, name, tracks.slice(0, config.maxQueueSize).map(serializeTrack));
    await interaction.reply({ content: `💾 Saved **${saved}** tracks as **${escapeMd(name)}**.`, flags: EPHEMERAL });
    return;
  }

  if (sub === 'delete') {
    const ok = ctx.store.deletePlaylist(userId, name);
    if (!ok) throw new UserError(`You don't have a playlist called "${truncate(name, 50)}".`, { hint: 'See `/playlist list`.', code: 'NO_PLAYLIST' });
    await interaction.reply({ content: `🗑️ Deleted **${escapeMd(name)}**.`, flags: EPHEMERAL });
    return;
  }

  if (sub === 'load') {
    checkTextChannel(interaction.channelId);
    const saved = ctx.store.getPlaylist(userId, name);
    if (!saved || saved.tracks.length === 0) {
      throw new UserError(`You don't have a playlist called "${truncate(name, 50)}".`, { hint: 'See `/playlist list`.', code: 'NO_PLAYLIST' });
    }
    const voiceChannel = requireVoice(interaction.member, ctx.manager.get(interaction.guildId));
    checkRate(userId);
    await interaction.deferReply();
    const requester = { id: userId, name: interaction.member.displayName };
    const tracks = tracksFromSaved(saved.tracks, requester);
    if (interaction.options.getBoolean('shuffle')) {
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      }
    }
    try {
      const content = await enqueueResolved({
        manager: ctx.manager,
        guild: interaction.guild,
        voiceChannel,
        textChannelId: interaction.channelId,
        tracks,
        playlist: { title: saved.name, capped: false },
      });
      await interaction.editReply({ content, allowedMentions: { parse: [] } });
    } catch (err) {
      await interaction.deleteReply().catch(() => {});
      await interaction.followUp({ content: formatUserError(err), flags: EPHEMERAL });
    }
  }
}

export const commandHandlers = { play, queue, settings, playlist, lyrics };

// ---------------------------------------------------------------- autocomplete

export async function autocomplete(interaction, ctx) {
  const focused = interaction.options.getFocused(true);
  const value = String(focused.value ?? '').trim();

  if (interaction.commandName === 'playlist') {
    const names = ctx.store.searchPlaylistNames(interaction.user.id, value);
    await interaction.respond(names.map((n) => ({ name: n, value: n })));
    return;
  }

  if (interaction.commandName === 'play') {
    if (!value) {
      const recent = ctx.store.recentForUser(interaction.user.id, 10).filter((r) => r.url.length <= 100);
      await interaction.respond(recent.map((r) => ({ name: truncate(`🕘 ${r.title}`, 100), value: r.url })));
      return;
    }
    // Links are played as typed; Discord allows submitting text that matches no choice.
    if (isUrl(value) || value.startsWith('spotify:')) {
      await interaction.respond(value.length <= 100 ? [{ name: truncate(`🔗 ${value}`, 100), value }] : []);
      return;
    }
    const suggestions = await suggest(value);
    const choices = [value, ...suggestions.filter((s) => s.toLowerCase() !== value.toLowerCase())]
      .slice(0, 10)
      .map((s) => ({ name: truncate(s, 100), value: truncate(s, 100) }));
    await interaction.respond(choices);
  }
}
