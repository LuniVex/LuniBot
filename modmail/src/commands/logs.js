/**
 * Modmail — src/commands/logs.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../handlers/permissions');
const { getUserTickets, searchTranscripts } = require('../handlers/ticketManager');
const { paginate } = require('../utils/paginator');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('View ticket logs and transcripts')
    .addSubcommand((sub) =>
      sub
        .setName('user')
        .setDescription('View past tickets for a specific user')
        .addUserOption((opt) =>
          opt.setName('target').setDescription('The user to look up').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setDescription('Search all past transcripts for a text match')
        .addStringOption((opt) =>
          opt
            .setName('query')
            .setDescription('The text to search for')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member, 'logs')) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const embedColor = parseInt(
      db.prepare("SELECT value FROM config WHERE key = 'embed_color'").get()
        ?.value || '5865F2',
      16
    );

    // ── /logs user ──
    if (subcommand === 'user') {
      const target = interaction.options.getUser('target');
      const tickets = getUserTickets(target.id);

      if (tickets.length === 0) {
        return interaction.reply({
          content: `📭 No tickets found for **${target.tag}**.`,
          ephemeral: true,
        });
      }

      const perPage = 5;
      const pages = [];

      for (let i = 0; i < tickets.length; i += perPage) {
        const slice = tickets.slice(i, i + perPage);
        const embed = new EmbedBuilder()
          .setTitle(`📋 Tickets for ${target.tag}`)
          .setColor(embedColor)
          .setThumbnail(target.displayAvatarURL({ dynamic: true }));

          const description = slice
          .map((t) => {
            const status = t.status === 'open' ? '🟢 Open' : '🔴 Closed';
            const created = new Date(t.created_at + 'Z');
            return [
              `**Ticket #${t.id}** — ${status}`,
              `> **Subject:** ${t.subject || 'N/A'}`,
              `> **Created:** <t:${Math.floor(created.getTime() / 1000)}:f>`,
              t.closed_at
                ? `> **Closed:** <t:${Math.floor(
                    new Date(t.closed_at + 'Z').getTime() / 1000
                  )}:f>\n> **Transcript:** ${t.transcript_url ? `[View HTML](${t.transcript_url})` : '*Not available*'}`
                : '',
            ]
              .filter(Boolean)
              .join('\n');
          })
          .join('\n\n');

        embed.setDescription(description);
        pages.push(embed);
      }

      await paginate(interaction, pages);
      return;
    }

    // ── /logs search ──
    if (subcommand === 'search') {
      const query = interaction.options.getString('query');
      const results = searchTranscripts(query);

      if (results.length === 0) {
        return interaction.reply({
          content: `🔍 No results found for **"${query}"**.`,
          ephemeral: true,
        });
      }

      const perPage = 5;
      const pages = [];

      for (let i = 0; i < results.length; i += perPage) {
        const slice = results.slice(i, i + perPage);
        const embed = new EmbedBuilder()
          .setTitle(`🔍 Search Results — "${query}"`)
          .setColor(embedColor);

        const description = slice
          .map((r) => {
            return [
              `**Ticket #${r.tid}** — ${r.subject || 'N/A'}`,
              `> ${r.search_snippet || ''}`,
              `> *User: <@${r.ticket_user_id}>*`,
              `> **Transcript:** ${r.transcript_url ? `[View HTML](${r.transcript_url})` : '*Not available*'}`,
            ].join('\n');
          })
          .join('\n\n');

        embed.setDescription(description);
        pages.push(embed);
      }

      await paginate(interaction, pages);
    }
  },
};
