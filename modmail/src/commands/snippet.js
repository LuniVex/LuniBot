const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../handlers/permissions');
const { getTicketByChannelId } = require('../handlers/ticketManager');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snippet')
    .setDescription('Manage and use canned responses')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Save a new snippet')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Snippet name').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('content')
            .setDescription('Snippet content')
            .setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('anonymous')
            .setDescription('Hide your name when using this snippet?')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Delete an existing snippet')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Snippet name').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all saved snippets')
    )
    .addSubcommand((sub) =>
      sub
        .setName('use')
        .setDescription('Send a snippet in the current ticket')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Snippet name').setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member, 'snippet')) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();
    const embedColor = parseInt(
      db.prepare("SELECT value FROM config WHERE key = 'embed_color'").get()
        ?.value || '5865F2',
      16
    );

    // ── /snippet add ──
    if (sub === 'add') {
      const name = interaction.options.getString('name').toLowerCase();
      const content = interaction.options.getString('content');

      const exists = db
        .prepare('SELECT name FROM snippets WHERE name = ?')
        .get(name);

      if (exists) {
        return interaction.reply({
          content: `❌ A snippet named **${name}** already exists.`,
          ephemeral: true,
        });
      }

      const anonymous = interaction.options.getBoolean('anonymous') ? 1 : 0;

      db.prepare(
        'INSERT INTO snippets (name, content, anonymous, created_by) VALUES (?, ?, ?, ?)'
      ).run(name, content, anonymous, interaction.user.id);

      return interaction.reply({
        content: `✅ Snippet **${name}** saved.`,
        ephemeral: true,
      });
    }

    // ── /snippet remove ──
    if (sub === 'remove') {
      const name = interaction.options.getString('name').toLowerCase();

      const exists = db
        .prepare('SELECT name FROM snippets WHERE name = ?')
        .get(name);

      if (!exists) {
        return interaction.reply({
          content: `❌ No snippet named **${name}** found.`,
          ephemeral: true,
        });
      }

      db.prepare('DELETE FROM snippets WHERE name = ?').run(name);

      return interaction.reply({
        content: `✅ Snippet **${name}** removed.`,
        ephemeral: true,
      });
    }

    // ── /snippet list ──
    if (sub === 'list') {
      const snippets = db
        .prepare('SELECT name, content FROM snippets ORDER BY name ASC')
        .all();

      if (snippets.length === 0) {
        return interaction.reply({
          content: '📭 No snippets have been created yet.',
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('📋 Available Snippets')
        .setColor(embedColor)
        .setDescription(
          snippets
            .map(
              (s) =>
                `**\`${s.name}\`** - ${
                  s.content.length > 80
                    ? s.content.slice(0, 80) + '...'
                    : s.content
                }`
            )
            .join('\n')
        )
        .setFooter({ text: `${snippets.length} snippet(s)` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── /snippet use ──
    if (sub === 'use') {
      const name = interaction.options.getString('name').toLowerCase();

      const snippet = db
        .prepare('SELECT * FROM snippets WHERE name = ?')
        .get(name);

      if (!snippet) {
        return interaction.reply({
          content: `❌ No snippet named **${name}** found.`,
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

      // Defer ephemerally - the real content goes as a channel message
      await interaction.deferReply({ ephemeral: true });

      const authorName = snippet.anonymous
        ? 'Staff Team'
        : interaction.user.tag;
      const authorAvatar = snippet.anonymous
        ? interaction.client.user.displayAvatarURL()
        : interaction.user.displayAvatarURL({ dynamic: true });

      // Send snippet as an embed in the ticket channel
      const channelEmbed = new EmbedBuilder()
        .setAuthor({
          name: authorName,
          iconURL: authorAvatar,
        })
        .setDescription(snippet.content)
        .setColor(embedColor)
        .setFooter({ text: `Snippet: ${name}${snippet.anonymous ? ' (Anonymous)' : ''}` })
        .setTimestamp();

      const channelMsg = await interaction.channel.send({
        embeds: [channelEmbed],
      });

      // Forward to user DM
      const user = await interaction.client.users
        .fetch(ticket.user_id)
        .catch(() => null);

      if (user) {
        const userEmbed = new EmbedBuilder()
          .setAuthor({
            name: authorName,
            iconURL: authorAvatar,
          })
          .setDescription(snippet.content)
          .setColor(embedColor)
          .setTimestamp();

        const dmMsg = await user.send({ embeds: [userEmbed] }).catch(() => null);

        if (dmMsg) {
          db.prepare(
            'INSERT INTO messages (ticket_id, author_id, dm_message_id, channel_message_id, content, attachments) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(
            ticket.id,
            interaction.user.id,
            dmMsg.id,
            channelMsg.id,
            snippet.content,
            null
          );
        }
      }

      await interaction.editReply({ content: `✅ Snippet **${name}** sent.` });
    }
  },
};
