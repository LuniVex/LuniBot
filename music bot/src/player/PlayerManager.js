/**
 * Music Bot — src/player/PlayerManager.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { joinVoiceChannel } from '@discordjs/voice';
import { logger } from '../logger.js';
import { GuildPlayer } from './GuildPlayer.js';

const log = logger.child({ mod: 'players' });

/** Owns one GuildPlayer per guild. Guilds never share queue, voice or stream state. */
export class PlayerManager {
  players = new Map();

  constructor({ client, store, ui, joinVoice }) {
    this.client = client;
    this.store = store;
    this.ui = ui;
    this.joinVoice = joinVoice ?? (({ guildId, channelId }) => {
      const guild = this.client.guilds.cache.get(guildId);
      return joinVoiceChannel({ guildId, channelId, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true });
    });
  }

  get(guildId) {
    return this.players.get(guildId) ?? null;
  }

  obtain(guildId) {
    let player = this.players.get(guildId);
    if (!player) {
      player = new GuildPlayer({ guildId, manager: this });
      this.players.set(guildId, player);
    }
    return player;
  }

  remove(guildId, player) {
    if (this.players.get(guildId) === player) this.players.delete(guildId);
  }

  /** Called for every voiceStateUpdate; only the affected guild's player is touched. */
  handleVoiceStateUpdate(oldState, newState) {
    const player = this.players.get(newState.guild.id);
    if (!player) return;
    const botId = this.client.user?.id;
    if (newState.id === botId && newState.channelId && newState.channelId !== player.voiceChannelId) {
      player.voiceChannelId = newState.channelId; // moved by a moderator
    }
    const touched = [oldState.channelId, newState.channelId];
    if (touched.includes(player.voiceChannelId)) player.checkAlone();
  }

  /** Rejoin the last voice channel of guilds that have 24/7 mode on. */
  async restoreAlwaysOn() {
    for (const row of this.store.alwaysOnGuilds()) {
      const guild = this.client.guilds.cache.get(row.guild_id);
      const channel = guild?.channels.cache.get(row.last_voice_channel_id);
      if (!channel?.isVoiceBased()) continue;
      const player = this.obtain(guild.id);
      player.setTextChannel(row.last_text_channel_id);
      try {
        await player.connect(channel);
        log.info({ guild: guild.id, channel: channel.id }, 'restored 24/7 connection');
      } catch (err) {
        log.warn({ guild: guild.id, err: err.message }, 'could not restore 24/7 connection');
      }
    }
  }

  stats() {
    const states = {};
    for (const p of this.players.values()) states[p.state] = (states[p.state] ?? 0) + 1;
    return { players: this.players.size, states };
  }

  async shutdown() {
    await Promise.allSettled([...this.players.values()].map((p) => p.destroy({ final: 'Bot restarting — use /play again in a moment' })));
  }
}
