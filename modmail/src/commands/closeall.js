/**
 * Modmail — src/commands/closeall.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const { SlashCommandBuilder } = require('discord.js');
const { hasPermission } = require('../handlers/permissions');
const db = require('../database/db');
const { closeTicket } = require('../handlers/ticketManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('closeall')
    .setDescription('Forcefully close all open tickets in the database (emergency command)'),

  async execute(interaction) {
    if (!hasPermission(interaction.member, 'close')) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const openTickets = db.prepare("SELECT * FROM tickets WHERE status = 'open'").all();
      
      if (openTickets.length === 0) {
        return interaction.editReply({ content: '✅ There are no open tickets in the database.' });
      }

      let closedCount = 0;
      for (const ticket of openTickets) {
        closeTicket(ticket.id, interaction.user.id);
        closedCount++;
        
        // Try to lock/archive the thread if it still exists
        try {
          const guild = interaction.client.guilds.cache.get(interaction.guildId);
          if (guild) {
            const channel = guild.channels.cache.get(ticket.channel_id);
            if (channel && channel.isThread()) {
              await channel.edit({ locked: true, archived: true }).catch(() => {});
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }

      await interaction.editReply({
        content: `✅ Force closed **${closedCount}** ticket(s). The database is now clean.`,
      });
    } catch (err) {
      console.error('[CloseAll] Error:', err);
      await interaction.editReply({
        content: '❌ An error occurred while closing the tickets.',
      });
    }
  },
};
