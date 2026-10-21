/**
 * Modmail — src/handlers/ticketManager.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const config = require('../config');
const { countToLetter } = require('../utils/letterMapper');

// ── In-memory map for users awaiting a subject line ──────────
const pendingTickets = new Map();

// ── Queries ──────────────────────────────────────────────────

function findActiveTicket(userId) {
  return db
    .prepare('SELECT * FROM tickets WHERE user_id = ? AND status = ?')
    .get(userId, 'open');
}

function getTicketByChannelId(channelId) {
  return db
    .prepare('SELECT * FROM tickets WHERE channel_id = ? AND status = ?')
    .get(channelId, 'open');
}

function getTicketMessages(ticketId) {
  return db
    .prepare('SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC')
    .all(ticketId);
}

function getUserTickets(userId) {
  return db
    .prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
}

function searchTranscripts(query) {
  return db
    .prepare(
      `SELECT m.*, t.user_id AS ticket_user_id, t.subject, t.id AS tid,
              snippet(messages_fts, 0, '**', '**', '...', 64) as search_snippet
       FROM messages_fts fts
       JOIN messages m ON fts.rowid = m.id
       JOIN tickets t ON m.ticket_id = t.id
       WHERE fts.content MATCH ? AND t.status = 'closed'
       ORDER BY m.created_at DESC
       LIMIT 50`
    )
    .all(query);
}

// ── Ticket lifecycle ─────────────────────────────────────────

async function createTicket(client, user, subject) {
  const guild = client.guilds.cache.get(config.guildId);
  if (!guild) throw new Error('Guild not found. Check GUILD_ID in .env.');

  // Increment the per-user ticket counter
  db.prepare(
    'INSERT INTO user_ticket_counts (user_id, count) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET count = count + 1'
  ).run(user.id);

  const { count } = db
    .prepare('SELECT count FROM user_ticket_counts WHERE user_id = ?')
    .get(user.id);

  const letter = countToLetter(count);
  const channelName = `[OPEN] ticket-${user.id}-${letter}`;

  const ticketsChannel = guild.channels.cache.get(config.ticketsChannelId);
  if (!ticketsChannel) throw new Error('Tickets channel not found. Check TICKETS_CHANNEL_ID in .env.');

  // Create the staff thread
  const channel = await ticketsChannel.threads.create({
    name: channelName,
    type: ChannelType.PublicThread,
    autoArchiveDuration: 10080, // One week
    reason: `Modmail ticket for ${user.tag}`
  });

  // Persist the ticket
  const result = db
    .prepare(
      'INSERT INTO tickets (user_id, channel_id, status, subject) VALUES (?, ?, ?, ?)'
    )
    .run(user.id, channel.id, 'open', subject);

  const ticket = {
    id: result.lastInsertRowid,
    user_id: user.id,
    channel_id: channel.id,
    status: 'open',
    subject,
  };

  // ── Opening embed in the ticket channel ──
  const embedColor = parseInt(
    db.prepare("SELECT value FROM config WHERE key = 'embed_color'").get()
      ?.value || '5865F2',
    16
  );

  const member = await guild.members.fetch(user.id).catch(() => null);

  const openEmbed = new EmbedBuilder()
    .setTitle(`📬 New Ticket - ${letter.toUpperCase()}`)
    .setColor(embedColor)
    .setDescription(`**Subject:** ${subject}`)
    .addFields(
      { name: 'User', value: `${user.tag} (<@${user.id}>)`, inline: true },
      { name: 'User ID', value: user.id, inline: true },
      {
        name: 'Account Created',
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
        inline: true,
      }
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  if (member) {
    openEmbed.addFields(
      {
        name: 'Joined Server',
        value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
        inline: true,
      },
      {
        name: 'Roles',
        value:
          member.roles.cache
            .filter((r) => r.id !== guild.id)
            .map((r) => r.toString())
            .join(', ') || 'None',
        inline: false,
      }
    );
  }

  await channel.send({ embeds: [openEmbed] });

  return ticket;
}

function closeTicket(ticketId, closedBy) {
  db.prepare(
    "UPDATE tickets SET status = 'closed', closed_at = datetime('now'), closed_by = ? WHERE id = ?"
  ).run(closedBy, ticketId);
}

function claimTicket(ticketId, claimedBy) {
  db.prepare(
    "UPDATE tickets SET claimed_by = ? WHERE id = ?"
  ).run(claimedBy, ticketId);
}

function unclaimTicket(ticketId) {
  db.prepare(
    "UPDATE tickets SET claimed_by = NULL WHERE id = ?"
  ).run(ticketId);
}

module.exports = {
  pendingTickets,
  findActiveTicket,
  getTicketByChannelId,
  createTicket,
  closeTicket,
  getTicketMessages,
  getUserTickets,
  searchTranscripts,
  claimTicket,
  unclaimTicket,
};
