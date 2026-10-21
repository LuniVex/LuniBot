/**
 * Modmail — src/commands/close.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require('discord.js');
const { hasPermission } = require('../handlers/permissions');
const {
  getTicketByChannelId,
  closeTicket,
  getTicketMessages,
} = require('../handlers/ticketManager');
const { generateTranscript } = require('../handlers/transcriptGenerator');
const { getModHelpChannelId } = require('../utils/configHelper');
const { safeSetName } = require('../utils/safeRename');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current modmail ticket')
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason for closing the ticket')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member, 'close')) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const ticket = getTicketByChannelId(interaction.channel.id);
    if (!ticket) {
      return interaction.reply({
        content: '❌ This command can only be used in a ticket channel.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      // Mark ticket as closed in the DB first (so the transcript shows a close date)
      closeTicket(ticket.id, interaction.user.id);

      // Re-fetch to get the updated closed_at timestamp
      const db = require('../database/db');
      const closedTicket = db
        .prepare('SELECT * FROM tickets WHERE id = ?')
        .get(ticket.id);

      // Generate the HTML transcript
      const transcriptPath = await generateTranscript(
        closedTicket,
        interaction.client
      );

      // Send to the archive channel
      const archiveChannel = interaction.client.channels.cache.get(
        config.archiveChannelId
      );

      if (archiveChannel) {
        const user = await interaction.client.users
          .fetch(ticket.user_id)
          .catch(() => null);

        const archiveEmbed = new EmbedBuilder()
          .setTitle(`📁 Ticket Closed - #${ticket.id}`)
          .setColor(0xed4245)
          .addFields(
            {
              name: 'User',
              value: user
                ? `${user.tag} (${user.id})`
                : ticket.user_id,
              inline: true,
            },
            {
              name: 'Closed By',
              value: interaction.user.tag,
              inline: true,
            },
            { name: 'Reason', value: reason, inline: false },
            {
              name: 'Subject',
              value: ticket.subject || 'N/A',
              inline: false,
            },
            {
              name: 'Messages',
              value: `${getTicketMessages(ticket.id).length}`,
              inline: true,
            }
          )
          .setTimestamp();

        const file = new AttachmentBuilder(transcriptPath, {
          name: `transcript-${ticket.id}.html`,
        });
        const msg = await archiveChannel.send({ embeds: [archiveEmbed], files: [file] });
        
        // Save attachment URL to DB
        const attachmentUrl = msg.attachments.first()?.url;
        if (attachmentUrl) {
          db.prepare('UPDATE tickets SET transcript_url = ? WHERE id = ?').run(attachmentUrl, ticket.id);
          closedTicket.transcript_url = attachmentUrl;
        }
      }

      // ── Delete the #mod-help alert if one exists ──
      if (closedTicket.help_alert_message_id) {
        try {
          const modHelpChannelId = getModHelpChannelId();
          if (modHelpChannelId) {
            const modHelpChannel = interaction.client.channels.cache.get(modHelpChannelId);
            if (modHelpChannel) {
              const alertMsg = await modHelpChannel.messages.fetch(closedTicket.help_alert_message_id).catch(() => null);
              if (alertMsg) await alertMsg.delete().catch(() => {});
            }
          }
        } catch (_) {
          // Silent - alert may already be deleted
        }
      }

      // Notify the user via DM
      const user = await interaction.client.users
        .fetch(ticket.user_id)
        .catch(() => null);

      if (user) {
        const closeEmbed = new EmbedBuilder()
          .setTitle('📪 Ticket Closed')
          .setColor(0xed4245)
          .setDescription(
            `Your ticket regarding **${
              ticket.subject || 'your issue'
            }** has been closed.`
          )
          .addFields({ name: 'Reason', value: reason })
          .setTimestamp();

        await user.send({ embeds: [closeEmbed] }).catch(() => {});
      }

      const transcriptLink = closedTicket.transcript_url ? `[View Transcript](${closedTicket.transcript_url})` : 'Transcript saved.';

      await interaction.editReply({
        content:
          `✅ Ticket closed. ${transcriptLink}\nThis thread will be archived and locked in 5 seconds.`,
      });

      // Archive and lock the ticket thread after a short delay
      setTimeout(async () => {
        if (interaction.channel.isThread()) {
          const newName = interaction.channel.name.replace(/\[OPEN.*?\]/, '[CLOSED]');
          await safeSetName(interaction.channel, newName, { lock: true, archive: true });
        } else {
          await interaction.channel.delete().catch(() => {}); // Fallback for old channels
        }
      }, 5000);
    } catch (err) {
      console.error('[Close] Error:', err);
      await interaction.editReply({
        content: '❌ An error occurred while closing the ticket.',
      });
    }
  },
};
