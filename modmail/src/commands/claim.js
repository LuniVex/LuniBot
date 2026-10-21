const { SlashCommandBuilder } = require('discord.js');
const { getTicketByChannelId, claimTicket } = require('../handlers/ticketManager');
const { hasPermission } = require('../handlers/permissions');
const { getModHelpChannelId } = require('../utils/configHelper');
const db = require('../database/db');

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

    if (ticket.claimed_by) {
      return interaction.reply({
        content: `❌ This ticket is already claimed by <@${ticket.claimed_by}>.`,
        ephemeral: true,
      });
    }

    try {
      // Claim in the database (no rename)
      claimTicket(ticket.id, interaction.user.id);

      // Delete the #mod-help alert if one exists
      if (ticket.help_alert_message_id) {
        try {
          const modHelpChannelId = getModHelpChannelId();
          if (modHelpChannelId) {
            const modHelpChannel = interaction.client.channels.cache.get(modHelpChannelId);
            if (modHelpChannel) {
              const alertMsg = await modHelpChannel.messages.fetch(ticket.help_alert_message_id).catch(() => null);
              if (alertMsg) await alertMsg.delete().catch(() => {});
            }
          }
        } catch (_) {
          // Silent - alert may already be deleted
        }

        // Clear the stored alert ID
        db.prepare('UPDATE tickets SET help_alert_message_id = NULL WHERE id = ?')
          .run(ticket.id);
      }

      await interaction.reply({
        content: `✅ Ticket claimed by ${interaction.user.toString()}.`,
      });
    } catch (err) {
      console.error('[Claim] Error:', err);
      await interaction.reply({
        content: '❌ Failed to claim ticket. Please try again.',
        ephemeral: true,
      });
    }
  },
};
