const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../handlers/permissions');
const { getTicketByChannelId } = require('../handlers/ticketManager');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reply')
    .setDescription('Reply to the user in the current ticket')
    .addStringOption((opt) =>
      opt
        .setName('message')
        .setDescription('Your reply message')
        .setRequired(true)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('anonymous')
        .setDescription('Send as anonymous staff member')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member, 'reply')) {
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

    await interaction.deferReply({ ephemeral: true });

    const message = interaction.options.getString('message');
    const anonymous = interaction.options.getBoolean('anonymous') ?? false;

    const embedColor = parseInt(
      db.prepare("SELECT value FROM config WHERE key = 'embed_color'").get()
        ?.value || '5865F2',
      16
    );

    const authorName = anonymous ? 'Staff Team' : interaction.user.tag;
    const authorIcon = anonymous
      ? interaction.client.user.displayAvatarURL()
      : interaction.user.displayAvatarURL({ dynamic: true });

    // ── Channel embed ──
    const channelEmbed = new EmbedBuilder()
      .setAuthor({ name: authorName, iconURL: authorIcon })
      .setDescription(message)
      .setColor(embedColor)
      .setTimestamp();

    if (anonymous) {
      channelEmbed.setFooter({
        text: `Actually sent by ${interaction.user.tag}`,
      });
    }

    const channelMsg = await interaction.channel.send({
      embeds: [channelEmbed],
    });

    // ── User DM embed ──
    const user = await interaction.client.users
      .fetch(ticket.user_id)
      .catch(() => null);

    if (user) {
      const userEmbed = new EmbedBuilder()
        .setAuthor({ name: authorName, iconURL: authorIcon })
        .setDescription(message)
        .setColor(embedColor)
        .setTimestamp();

      const dmMsg = await user
        .send({ embeds: [userEmbed] })
        .catch(() => null);

      if (dmMsg) {
        db.prepare(
          'INSERT INTO messages (ticket_id, author_id, dm_message_id, channel_message_id, content, attachments) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          ticket.id,
          interaction.user.id,
          dmMsg.id,
          channelMsg.id,
          message,
          null
        );
      }
    }

    await interaction.editReply({ content: '✅ Reply sent.' });
  },
};
