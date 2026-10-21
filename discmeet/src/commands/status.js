/**
 * DiscMeet — src/commands/status.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * /status — Show current recording session info.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatTime } = require('../utils/formatTime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show current meeting recording session info'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {{ activeSessions: Map }} context
   */
  async execute(interaction, { activeSessions }) {
    const sessionData = activeSessions.get(interaction.guildId);

    if (!sessionData) {
      return interaction.reply({
        content: 'ℹ️ No active recording session in this server.',
        ephemeral: true,
      });
    }

    const { session } = sessionData;
    const summary = session.getSummary();
    const speakers = [...session.userNames.values()].join(', ') || 'None yet';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📊 Session Status')
      .addFields(
        { name: '⏱️ Duration', value: formatTime(summary.duration), inline: true },
        { name: '🗣️ Speakers', value: String(summary.speakerCount), inline: true },
        { name: '📼 Segments', value: String(summary.segmentCount), inline: true },
        { name: '👥 Active Speakers', value: speakers, inline: false }
      )
      .setFooter({ text: 'Use /summarize to end and generate notes' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
