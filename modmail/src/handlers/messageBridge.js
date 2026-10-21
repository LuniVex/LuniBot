/**
 * Modmail — src/handlers/messageBridge.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// ── Config helpers ───────────────────────────────────────────

function getEmbedColor() {
  const row = db
    .prepare("SELECT value FROM config WHERE key = 'embed_color'")
    .get();
  return parseInt(row?.value || '5865F2', 16);
}

function getReactionEmoji() {
  const row = db
    .prepare("SELECT value FROM config WHERE key = 'reaction_emoji'")
    .get();
  return row?.value || '📬';
}

// ── DM → Channel ────────────────────────────────────────────

async function forwardToChannel(dmMessage, ticket, client, formattedContent = null) {
  const appConfig = require('../config');
  const guild = client.guilds.cache.get(appConfig.guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(ticket.channel_id);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setAuthor({
      name: dmMessage.author.tag,
      iconURL: dmMessage.author.displayAvatarURL({ dynamic: true }),
    })
    .setColor(getEmbedColor())
    .setTimestamp(dmMessage.createdAt);

  if (formattedContent) {
    embed.setDescription(formattedContent);
  } else if (dmMessage.content) {
    embed.setDescription(dmMessage.content);
  }

  // Separate images from other attachments
  const files = [];
  const imageUrls = [];

  for (const [, att] of dmMessage.attachments) {
    if (att.contentType?.startsWith('image/')) {
      imageUrls.push(att.url);
    } else {
      files.push({ attachment: att.url, name: att.name });
    }
  }

  if (imageUrls.length > 0) {
    embed.setImage(imageUrls[0]);
    for (let i = 1; i < imageUrls.length; i++) {
      files.push({ attachment: imageUrls[i] });
    }
  }

  // Sticker info
  if (dmMessage.stickers.size > 0) {
    embed.addFields({
      name: 'Stickers',
      value: dmMessage.stickers.map((s) => s.name).join(', '),
    });
  }

  const sent = await channel.send({ embeds: [embed], files });

  // Confirm receipt in DM
  await dmMessage.react(getReactionEmoji()).catch(() => {});

  // Persist mapping
  const attachmentData =
    dmMessage.attachments.size > 0
      ? JSON.stringify(
          [...dmMessage.attachments.values()].map((a) => ({
            url: a.url,
            name: a.name,
          }))
        )
      : null;

  db.prepare(
    'INSERT INTO messages (ticket_id, author_id, dm_message_id, channel_message_id, content, attachments) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    ticket.id,
    dmMessage.author.id,
    dmMessage.id,
    sent.id,
    dmMessage.content,
    attachmentData
  );

  return sent;
}

// ── Channel → DM ────────────────────────────────────────────

async function forwardToUser(channelMessage, ticket, client) {
  const user = await client.users.fetch(ticket.user_id).catch(() => null);
  if (!user) return;

  const embedColor = getEmbedColor();
  const embed = new EmbedBuilder()
    .setAuthor({
      name: channelMessage.author.tag,
      iconURL: channelMessage.author.displayAvatarURL({ dynamic: true }),
    })
    .setColor(embedColor)
    .setTimestamp(channelMessage.createdAt);

  if (channelMessage.content) embed.setDescription(channelMessage.content);

  const files = [];
  const imageUrls = [];

  for (const [, att] of channelMessage.attachments) {
    if (att.contentType?.startsWith('image/')) {
      imageUrls.push(att.url);
    } else {
      files.push({ attachment: att.url, name: att.name });
    }
  }

  if (imageUrls.length > 0) {
    embed.setImage(imageUrls[0]);
    for (let i = 1; i < imageUrls.length; i++) {
      files.push({ attachment: imageUrls[i] });
    }
  }

  const sent = await user.send({ embeds: [embed], files }).catch(() => null);
  if (!sent) return;

  // Confirm forwarding in the channel with an embed showing formatting
  const confirmationEmbed = new EmbedBuilder()
    .setColor(embedColor)
    .setDescription(`**Message sent:**\n\n${channelMessage.content || '*[no text]*'}`);
  await channelMessage.reply({ embeds: [confirmationEmbed] }).catch(() => {});

  const attachmentData =
    channelMessage.attachments.size > 0
      ? JSON.stringify(
          [...channelMessage.attachments.values()].map((a) => ({
            url: a.url,
            name: a.name,
          }))
        )
      : null;

  db.prepare(
    'INSERT INTO messages (ticket_id, author_id, dm_message_id, channel_message_id, content, attachments) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    ticket.id,
    channelMessage.author.id,
    sent.id,
    channelMessage.id,
    channelMessage.content,
    attachmentData
  );

  return sent;
}

// ── Edit syncing ─────────────────────────────────────────────

async function syncEdit(messageId, newContent, side, client) {
  // side: 'dm'      → the DM was edited, update the channel copy
  // side: 'channel' → the channel msg was edited, update the DM copy
  const column = side === 'dm' ? 'dm_message_id' : 'channel_message_id';
  const row = db
    .prepare(`SELECT * FROM messages WHERE ${column} = ?`)
    .get(messageId);
  if (!row) return;

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(row.ticket_id);
  if (!ticket || ticket.status !== 'open') return;

  try {
    if (side === 'dm') {
      const appConfig = require('../config');
      const guild = client.guilds.cache.get(appConfig.guildId);
      const channel = guild?.channels.cache.get(ticket.channel_id);
      if (!channel) return;

      const msg = await channel.messages.fetch(row.channel_message_id).catch(() => null);
      if (!msg || !msg.embeds[0]) return;

      const embed = EmbedBuilder.from(msg.embeds[0])
        .setDescription(newContent || '*[empty message]*')
        .setFooter({ text: '(edited)' });
      await msg.edit({ embeds: [embed] });
    } else {
      const user = await client.users.fetch(ticket.user_id).catch(() => null);
      if (!user) return;

      const dm = await user.createDM();
      const msg = await dm.messages.fetch(row.dm_message_id).catch(() => null);
      if (!msg || !msg.embeds[0]) return;

      const embed = EmbedBuilder.from(msg.embeds[0])
        .setDescription(newContent || '*[empty message]*')
        .setFooter({ text: '(edited)' });
      await msg.edit({ embeds: [embed] });
    }

    db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(newContent, row.id);
  } catch (err) {
    console.error('[Bridge] Edit sync error:', err);
  }
}

// ── Delete syncing ───────────────────────────────────────────

async function syncDelete(messageId, side, client) {
  const column = side === 'dm' ? 'dm_message_id' : 'channel_message_id';
  const row = db
    .prepare(`SELECT * FROM messages WHERE ${column} = ?`)
    .get(messageId);
  if (!row) return;

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(row.ticket_id);
  if (!ticket || ticket.status !== 'open') return;

  try {
    if (side === 'dm') {
      const appConfig = require('../config');
      const guild = client.guilds.cache.get(appConfig.guildId);
      const channel = guild?.channels.cache.get(ticket.channel_id);
      if (!channel) return;

      const msg = await channel.messages.fetch(row.channel_message_id).catch(() => null);
      if (msg) await msg.delete().catch(() => {});
    } else {
      const user = await client.users.fetch(ticket.user_id).catch(() => null);
      if (!user) return;

      const dm = await user.createDM();
      const msg = await dm.messages.fetch(row.dm_message_id).catch(() => null);
      if (msg) await msg.delete().catch(() => {});
    }

    db.prepare('DELETE FROM messages WHERE id = ?').run(row.id);
  } catch (err) {
    console.error('[Bridge] Delete sync error:', err);
  }
}

module.exports = { forwardToChannel, forwardToUser, syncEdit, syncDelete };
