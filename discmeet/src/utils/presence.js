/**
 * Bot Presence & Voice Channel Status Manager.
 *
 * Manages the bot's rich presence (activity text) and voice channel status
 * indicators. Uses the Discord REST API directly for voice channel status
 * since discord.js does not yet expose a native method.
 *
 * Presence states:
 *   - Recording: "Listening to Listening & summarising"
 *   - Idle:      "Watching Watching over meetings" (or custom IDLE_STATUS)
 *
 * Voice channel status:
 *   - Recording: "🔴 Recording"
 *   - Cleared on stop/leave
 */

const { ActivityType } = require('discord.js');
const config = require('../config');
const logger = require('./logger');

// ── Bot Presence ──────────────────────────────────────────────────────

/**
 * Set the bot's presence to "Listening — Listening & summarising".
 * Called when a recording session starts.
 *
 * @param {import('discord.js').Client} client
 */
function setRecordingPresence(client) {
  try {
    client.user.setPresence({
      activities: [{
        name: 'Listening & summarising',
        type: ActivityType.Listening,
      }],
      status: 'dnd',
    });
    logger.info('Presence updated → Listening & summarising');
  } catch (err) {
    logger.warn('Failed to set recording presence:', err.message);
  }
}

/**
 * Reset the bot's presence to the idle/default state.
 * Called when a recording session ends or the bot starts up.
 *
 * @param {import('discord.js').Client} client
 */
function setIdlePresence(client) {
  try {
    client.user.setPresence({
      activities: [{
        name: config.idleStatus,
        type: ActivityType.Watching,
      }],
      status: 'online',
    });
    logger.info(`Presence updated → Watching: ${config.idleStatus}`);
  } catch (err) {
    logger.warn('Failed to set idle presence:', err.message);
  }
}

// ── Voice Channel Status ──────────────────────────────────────────────

/**
 * Set a status message on a voice channel (e.g. "🔴 Recording").
 *
 * Uses the Discord REST API directly:
 *   PUT /channels/{channel.id}/voice-status
 *
 * @param {import('discord.js').Client} client
 * @param {string} channelId - The voice channel ID
 * @param {string} status    - The status text to display
 */
async function setVoiceChannelStatus(client, channelId, status) {
  try {
    await client.rest.put(`/channels/${channelId}/voice-status`, {
      body: { status },
    });
    logger.info(`Voice channel status set → "${status}"`);
  } catch (err) {
    // Non-critical — the bot may lack the permission or the feature
    // may not be available in all guild tiers
    logger.warn(`Failed to set voice channel status: ${err.message}`);
  }
}

/**
 * Clear the voice channel status (remove any status text).
 *
 * @param {import('discord.js').Client} client
 * @param {string} channelId - The voice channel ID
 */
async function clearVoiceChannelStatus(client, channelId) {
  try {
    await client.rest.put(`/channels/${channelId}/voice-status`, {
      body: { status: null },
    });
    logger.info('Voice channel status cleared');
  } catch (err) {
    logger.warn(`Failed to clear voice channel status: ${err.message}`);
  }
}

module.exports = {
  setRecordingPresence,
  setIdlePresence,
  setVoiceChannelStatus,
  clearVoiceChannelStatus,
};
