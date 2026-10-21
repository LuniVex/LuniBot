/**
 * DiscMeet — src/commands/leave.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * /leave — Leave the voice channel.
 * Warns if segments exist; use force:true to discard recordings.
 *
 * Side-effects on leave:
 *   - Clears voice channel status
 *   - Resets bot presence to idle
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { leave } = require('../voice/connection');
const { setIdlePresence, clearVoiceChannelStatus } = require('../utils/presence');
const fs = require('node:fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel (discards any unsaved recordings)')
    .addBooleanOption((option) =>
      option
        .setName('force')
        .setDescription('Force leave without confirmation, discarding recordings')
        .setRequired(false)
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {{ activeSessions: Map, client: import('discord.js').Client }} context
   */
  async execute(interaction, { activeSessions, client }) {
    const sessionData = activeSessions.get(interaction.guildId);
    const force = interaction.options.getBoolean('force') ?? false;

    if (!sessionData) {
      const left = leave(interaction.guildId);
      if (left) {
        return interaction.reply('👋 Left the voice channel (no session was active).');
      }
      return interaction.reply({
        content: "❌ I'm not in a voice channel.",
        ephemeral: true,
      });
    }

    const { session, recorder } = sessionData;
    const summary = session.getSummary();

    // If there are recorded segments and not forcing, warn
    if (summary.segmentCount > 0 && !force) {
      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('⚠️ Recording in Progress')
        .setDescription(
          `There are **${summary.segmentCount}** recorded segment(s) from **${summary.speakerCount}** speaker(s).\n\n` +
            'Use `/summarize` to generate meeting notes first.\n' +
            'Or use `/leave force:True` to leave and discard recordings.'
        );

      return interaction.reply({ embeds: [embed] });
    }

    // ── Clear voice status & reset presence ──
    await clearVoiceChannelStatus(client, session.channelId);
    setIdlePresence(client);

    // Clean up and leave
    session.end();
    recorder.destroy();
    activeSessions.delete(interaction.guildId);
    leave(interaction.guildId);
    cleanupRecordings(session);

    if (summary.segmentCount > 0) {
      await interaction.reply('👋 Left the voice channel. Recordings discarded.');
    } else {
      await interaction.reply('👋 Left the voice channel. No audio was recorded.');
    }
  },
};

/**
 * Delete temporary recording WAV files for a session.
 */
function cleanupRecordings(session) {
  const segments = session.getAllSegmentsSorted();
  for (const seg of segments) {
    try {
      if (fs.existsSync(seg.filePath)) {
        fs.unlinkSync(seg.filePath);
      }
    } catch {
      // Non-critical
    }
  }
}
