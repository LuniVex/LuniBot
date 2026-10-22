/**
 * Modmail — src/commands/unclaim.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const { SlashCommandBuilder } = require('discord.js');
const { getTicketByChannelId, unclaimTicket } = require('../handlers/ticketManager');
const { hasPermission } = require('../handlers/permissions');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unclaim')
    .setDescription('Unclaim this ticket thread'),

  async execute(interaction) {
    if (!hasPermission(interaction.member, 'unclaim')) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    if (!interaction.channel.isThread()) {
      return interaction.reply({
        content: '❌ This command can only be used inside a ticket thread.',
        ephemeral: true,
      });
    }

    const ticket = getTicketByChannelId(interaction.channelId);
    if (!ticket) {
      return interaction.reply({
        content: '❌ This thread is not an active ticket.',
        ephemeral: true,
      });
    }

    const newName = interaction.channel.name.replace(/\[OPEN - CLAIMED\]/, '[OPEN - UNCLAIMED]');
    if (newName === interaction.channel.name) {
      return interaction.reply({
        content: '❌ This ticket is not claimed or has a custom status.',
        ephemeral: true,
      });
    }

    try {
      await interaction.channel.setName(newName);
      unclaimTicket(ticket.id);
      
      const pingMsg = config.staffRoleId ? `<@&${config.staffRoleId}>` : '@Support';
      await interaction.reply({
        content: `✅ Ticket unclaimed by ${interaction.user.toString()}.\n${pingMsg} ticket is back in the queue.`
      });
    } catch (err) {
      console.error('[Unclaim] Error:', err);
      await interaction.reply({
        content: '❌ Failed to unclaim ticket. The bot might be rate-limited on renaming channels.',
        ephemeral: true,
      });
    }
  },
};
