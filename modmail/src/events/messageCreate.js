const { ChannelType } = require('discord.js');
const {
  pendingTickets,
  findActiveTicket,
  createTicket,
  getTicketByChannelId,
} = require('../handlers/ticketManager');
const { forwardToChannel, forwardToUser } = require('../handlers/messageBridge');
const config = require('../config');

module.exports = {
  name: 'messageCreate',

  async execute(message) {
    // Ignore all bot messages
    if (message.author.bot) return;

    // ── Direct Messages ──
    if (message.channel.type === ChannelType.DM) {
      await handleDM(message);
      return;
    }

    // ── Staff ticket channel messages ──
    if (message.channel.isThread() && message.channel.parentId === config.ticketsChannelId) {
      await handleTicketChannel(message);
    }
  },
};

// ── DM handling ──────────────────────────────────────────────

async function handleDM(message) {
  const userId = message.author.id;

  // 1. Already has an open ticket → forward the message
  const activeTicket = findActiveTicket(userId);
  if (activeTicket) {
    await forwardToChannel(message, activeTicket, message.client);
    return;
  }

  // 2. Awaiting subject → use this message to create the ticket
  if (pendingTickets.has(userId)) {
      const lines = message.content.split('\n');
      const subject = lines[0].slice(0, 100) || 'No subject provided';
      const description = lines.slice(1).join('\n').trim();

      const formattedContent = `**${subject}**\n\n${description || '*No description provided.*'}`;
    
      try {
        pendingTickets.delete(userId);

        const ticket = await createTicket(message.client, message.author, subject);

        await message.reply(
          `✅ Your ticket has been created! Our staff will respond shortly.\n**Subject:** ${subject}`
        );

        // Forward the initial message into the new channel
        await forwardToChannel(message, ticket, message.client, formattedContent);
    } catch (err) {
      console.error('[Ticket] Error creating ticket:', err);
      await message
        .reply(
          '❌ An error occurred while creating your ticket. Please try again later.'
        )
        .catch(() => {});
    }
    return;
  }

  // 3. No ticket, not pending → prompt for subject
  pendingTickets.set(userId, { timestamp: Date.now() });

  await message.reply(
    '📬 **Welcome to Modmail!**\n\nPlease provide a title for your issue (one line) and a detailed description (you may use line breaks for clarity).'
  );

  // Auto-expire pending state after 10 minutes
  setTimeout(() => {
    if (pendingTickets.has(userId)) {
      pendingTickets.delete(userId);
    }
  }, 600_000);
}

// ── Ticket channel handling ──────────────────────────────────

async function handleTicketChannel(message) {
  const ticket = getTicketByChannelId(message.channel.id);
  if (!ticket) return;

  // Only forward if the message contains an attachment
  if (message.attachments.size > 0) {
    await forwardToUser(message, ticket, message.client);
  }
}
