/**
 * Modmail — src/commands/unclaim.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getTicketByChannelId, unclaimTicket } = require('../handlers/ticketManager');
const { hasPermission } = require('../handlers/permissions');
const { getModHelpChannelId, getStaffRoleId } = require('../utils/configHelper');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unclaim')
    .setDescription('Unclaim this ticket thread')
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason for unclaiming the ticket')
        .setRequired(true)
    ),

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

    if (!ticket.claimed_by) {
      return interaction.reply({
        content: '❌ This ticket is not currently claimed.',
        ephemeral: true,
      });
    }

    const reason = interaction.options.getString('reason');

    // ── Post alert to #mod-help ──
    const modHelpChannelId = getModHelpChannelId();
    if (!modHelpChannelId) {
      return interaction.reply({
        content: '❌ No mod-help channel configured. Use `/config helpchannel` to set one.',
        ephemeral: true,
      });
    }

    const modHelpChannel = interaction.client.channels.cache.get(modHelpChannelId);
    if (!modHelpChannel) {
      return interaction.reply({
        content: '❌ Could not find the configured mod-help channel. It may have been deleted.',
        ephemeral: true,
      });
    }

    try {
      const staffRoleId = getStaffRoleId();
      const pingStr = staffRoleId ? `<@&${staffRoleId}>` : '@Support';

      const alertEmbed = new EmbedBuilder()
        .setTitle('🔔 Ticket Unclaimed')
        .setColor(0xffa500) // Orange for attention
        .setDescription(`Ticket has been unclaimed due to: **${reason}**`)
        .addFields(
          {
            name: 'Ticket',
            value: `<#${interaction.channelId}>`,
            inline: true,
          },
          {
            name: 'Subject',
            value: ticket.subject || 'N/A',
            inline: true,
          },
          {
            name: 'Unclaimed By',
            value: interaction.user.toString(),
            inline: true,
          }
        )
        .setTimestamp();

      const alertMsg = await modHelpChannel.send({
        content: `${pingStr} - A ticket needs attention!`,
        embeds: [alertEmbed],
      });

      // Store the alert message ID in the database
      db.prepare('UPDATE tickets SET help_alert_message_id = ? WHERE id = ?')
        .run(alertMsg.id, ticket.id);

      // Unclaim in the database
      unclaimTicket(ticket.id);

      await interaction.reply({
        content: `✅ Ticket unclaimed by ${interaction.user.toString()}. An alert has been posted in <#${modHelpChannelId}>.`,
      });
    } catch (err) {
      console.error('[Unclaim] Error:', err);
      await interaction.reply({
        content: '❌ Failed to unclaim ticket. Please try again.',
        ephemeral: true,
      });
    }
  },
};
