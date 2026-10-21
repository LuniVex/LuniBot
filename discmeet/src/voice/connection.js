/**
 * Voice channel connection manager.
 *
 * Handles joining/leaving voice channels and managing connection lifecycle.
 */

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} = require('@discordjs/voice');
const logger = require('../utils/logger');

/**
 * Join a voice channel and return the connection.
 *
 * @param {import('discord.js').VoiceChannel} channel - The voice channel to join
 * @returns {Promise<import('@discordjs/voice').VoiceConnection>}
 * @throws {Error} If connection fails or times out
 */
async function join(channel) {
  // Check if already connected to this guild
  const existing = getVoiceConnection(channel.guild.id);
  if (existing) {
    logger.warn('Already connected to a voice channel in this server. Disconnecting first.');
    existing.destroy();
  }

  logger.info(`Joining voice channel: ${channel.name} (${channel.id})`);

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false, // CRITICAL: must be false to receive audio
    selfMute: true,  // Bot doesn't need to speak
  });

  // Handle connection state changes
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      // Try to reconnect within 5 seconds
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      logger.info('Reconnecting to voice channel...');
    } catch {
      // If reconnection fails, destroy the connection
      logger.warn('Voice connection lost — could not reconnect');
      connection.destroy();
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    logger.info('Voice connection destroyed');
  });

  // Wait for the connection to be ready
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    logger.success(`Connected to ${channel.name}`);
    return connection;
  } catch (err) {
    connection.destroy();
    throw new Error(`Failed to connect to voice channel within 15 seconds: ${err.message}`);
  }
}

/**
 * Leave the voice channel for a given guild.
 *
 * @param {string} guildId - The guild to disconnect from
 * @returns {boolean} True if a connection was destroyed, false if none existed
 */
function leave(guildId) {
  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
    logger.info('Left voice channel');
    return true;
  }
  return false;
}

module.exports = { join, leave };
