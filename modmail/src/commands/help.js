/**
 * Modmail — src/commands/help.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available modmail commands'),

  async execute(interaction) {
    const embedColor = parseInt(
      db.prepare("SELECT value FROM config WHERE key = 'embed_color'").get()
        ?.value || '5865F2',
      16
    );

    const embed = new EmbedBuilder()
      .setTitle('📬 Modmail Bot - Commands')
      .setColor(embedColor)
      .setDescription('Here are all available commands:')
      .addFields(
        {
          name: '🔒 `/close [reason]`',
          value: 'Close the current ticket and generate a transcript.',
        },
        {
          name: '📋 `/logs user <@user>`',
          value: 'View past tickets for a specific user (paginated).',
        },
        {
          name: '🔍 `/logs search <query>`',
          value: 'Search all closed ticket transcripts for text matches.',
        },
        {
          name: '💬 `/reply <message> [anonymous]`',
          value: 'Send a reply in the current ticket (supports anonymous mode).',
        },
        {
          name: '📝 `/snippet add|remove|list|use`',
          value: 'Create, delete, list, or send canned responses.',
        },
        {
          name: '⚙️ `/config color|activity|emoji|view`',
          value: 'Change embed color, bot status, reaction emoji, or view current settings.',
        },
        {
          name: '❓ `/help`',
          value: 'Show this help message.',
        }
      )
      .setFooter({ text: 'Modmail Bot • DM the bot to create a ticket' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
