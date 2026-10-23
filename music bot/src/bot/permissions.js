/**
 * Music Bot — src/bot/permissions.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import { UserError } from '../util/errors.js';

export function checkTextChannel(channelId) {
  const allowed = config.allowedTextChannels;
  if (allowed.length && !allowed.includes(channelId)) {
    throw new UserError('Music commands aren\'t enabled in this channel.', {
      hint: `Use one of: ${allowed.map((id) => `<#${id}>`).join(', ')}`,
      code: 'CHANNEL_NOT_ALLOWED',
    });
  }
}

function humansIn(channel) {
  return channel ? channel.members.filter((m) => !m.user.bot).size : 0;
}

/** Validate that `member` can summon the bot to their voice channel; returns the channel. */
export function requireVoice(member, player) {
  const channel = member.voice?.channel;
  if (!channel) {
    throw new UserError('Join a voice channel first.', { hint: 'Then run the command again.', code: 'NO_VOICE' });
  }
  const allowed = config.allowedVoiceChannels;
  if (allowed.length && !allowed.includes(channel.id)) {
    throw new UserError(`I'm not allowed to play in <#${channel.id}>.`, {
      hint: `Join one of: ${allowed.map((id) => `<#${id}>`).join(', ')}`,
      code: 'VOICE_NOT_ALLOWED',
    });
  }
  const me = channel.guild.members.me;
  const perms = channel.permissionsFor(me);
  const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak];
  if (!perms?.has(needed)) {
    throw new UserError(`I can't join or speak in <#${channel.id}>.`, {
      hint: 'Give me **View Channel**, **Connect** and **Speak** in that channel (or my role).',
      code: 'MISSING_VOICE_PERMS',
    });
  }
  if (channel.full && channel.id !== player?.voiceChannelId && !perms.has(PermissionFlagsBits.MoveMembers)) {
    throw new UserError(`<#${channel.id}> is full.`, { hint: 'Free up a slot or raise the user limit.', code: 'VOICE_FULL' });
  }
  if (player?.voiceChannelId && player.voiceChannelId !== channel.id && player.isActive) {
    const current = channel.guild.channels.cache.get(player.voiceChannelId);
    if (humansIn(current) > 0) {
      throw new UserError(`I'm already playing in <#${player.voiceChannelId}>.`, {
        hint: 'Join that channel to add music, or wait until it\'s finished.',
        code: 'BUSY_ELSEWHERE',
      });
    }
  }
  return channel;
}

/** Controls only work for people listening in the same channel. */
export function requireSameVoice(member, player) {
  if (player.voiceChannelId && member.voice?.channelId !== player.voiceChannelId) {
    throw new UserError('Join my voice channel to use the controls.', { hint: `I'm in <#${player.voiceChannelId}>.`, code: 'NOT_IN_VOICE' });
  }
}

/**
 * With a DJ role configured, controls are limited to DJs, server managers, someone alone
 * with the bot, and (for pause/skip) whoever requested the current track.
 */
export function canControl(member, player, { allowRequester = false } = {}) {
  const djRoleId = player.settings.djRoleId;
  if (!djRoleId) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (member.roles.cache.has(djRoleId)) return true;
  if (allowRequester && player.current?.requester?.id === member.id) return true;
  const channel = member.guild.channels.cache.get(player.voiceChannelId);
  return humansIn(channel) === 1 && member.voice?.channelId === player.voiceChannelId;
}

export function requireControl(member, player, opts) {
  if (!canControl(member, player, opts)) {
    throw new UserError('Only DJs can use that control here.', {
      hint: `Ask someone with <@&${player.settings.djRoleId}> or a server manager.`,
      code: 'NOT_DJ',
    });
  }
}
