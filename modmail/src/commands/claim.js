/**
 * Modmail — src/commands/claim.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const { SlashCommandBuilder } = require('discord.js');
const { getTicketByChannelId, claimTicket } = require('../handlers/ticketManager');
const { hasPermission } = require('../handlers/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim this ticket thread'),

  async execute(interaction) {
    if (!hasPermission(interaction.member, 'claim')) {
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

    const newName = interaction.channel.name.replace(/\[OPEN - UNCLAIMED\]/, '[OPEN - CLAIMED]');
    if (newName === interaction.channel.name) {
      return interaction.reply({
        content: '❌ This ticket is already claimed or has a custom status.',
        ephemeral: true,
      });
    }

    try {
      await interaction.channel.setName(newName);
      claimTicket(ticket.id, interaction.user.id);
      
      await interaction.reply({
        content: `✅ Ticket claimed by ${interaction.user.toString()}.`
      });
    } catch (err) {
      console.error('[Claim] Error:', err);
      await interaction.reply({
        content: '❌ Failed to claim ticket. The bot might be rate-limited on renaming channels.',
        ephemeral: true,
      });
    }
  },
};
