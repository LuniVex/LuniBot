const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActivityType,
  ChannelType,
} = require('discord.js');
const { hasPermission } = require('../handlers/permissions');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings')
    .addSubcommand((sub) =>
      sub
        .setName('color')
        .setDescription('Set the embed color')
        .addStringOption((opt) =>
          opt
            .setName('hex')
            .setDescription('Hex color code (e.g., 5865F2)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('activity')
        .setDescription('Set the bot activity status')
        .addStringOption((opt) =>
          opt
            .setName('text')
            .setDescription('Activity text')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('emoji')
        .setDescription('Set the default reaction emoji')
        .addStringOption((opt) =>
          opt
            .setName('emoji')
            .setDescription('The emoji to use for confirmations')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('helpchannel')
        .setDescription('Set the #mod-help channel for unclaim alerts')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to post unclaim alerts in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('staffrole')
        .setDescription('Set the staff role that grants modmail access')
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('The role to use as the staff role')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View current bot configuration')
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member, 'config')) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    // ── /config color ──
    if (sub === 'color') {
      const hex = interaction.options.getString('hex').replace('#', '');

      if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        return interaction.reply({
          content: '❌ Invalid hex color. Use format: `5865F2` or `#5865F2`.',
          ephemeral: true,
        });
      }

      db.prepare("UPDATE config SET value = ? WHERE key = 'embed_color'").run(
        hex.toUpperCase()
      );

      const embed = new EmbedBuilder()
        .setDescription(`✅ Embed color updated to **#${hex.toUpperCase()}**`)
        .setColor(parseInt(hex, 16));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── /config activity ──
    if (sub === 'activity') {
      const text = interaction.options.getString('text');

      db.prepare(
        "UPDATE config SET value = ? WHERE key = 'activity_status'"
      ).run(text);

      interaction.client.user.setActivity(text, {
        type: ActivityType.Watching,
      });

      return interaction.reply({
        content: `✅ Bot activity updated to: **${text}**`,
        ephemeral: true,
      });
    }

    // ── /config emoji ──
    if (sub === 'emoji') {
      const emoji = interaction.options.getString('emoji');

      db.prepare(
        "UPDATE config SET value = ? WHERE key = 'reaction_emoji'"
      ).run(emoji);

      return interaction.reply({
        content: `✅ Default reaction emoji updated to: ${emoji}`,
        ephemeral: true,
      });
    }

    // ── /config helpchannel ──
    if (sub === 'helpchannel') {
      const channel = interaction.options.getChannel('channel');

      db.prepare(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('mod_help_channel_id', ?)"
      ).run(channel.id);

      return interaction.reply({
        content: `✅ Mod-help channel set to ${channel.toString()}.`,
        ephemeral: true,
      });
    }

    // ── /config staffrole ──
    if (sub === 'staffrole') {
      const role = interaction.options.getRole('role');

      db.prepare(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('staff_role_id', ?)"
      ).run(role.id);

      return interaction.reply({
        content: `✅ Staff role set to ${role.toString()}.`,
        ephemeral: true,
      });
    }

    // ── /config view ──
    if (sub === 'view') {
      const configs = db.prepare('SELECT * FROM config').all();

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Bot Configuration')
        .setColor(0x5865f2);

      for (const cfg of configs) {
        const displayName = cfg.key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        let displayValue = cfg.value || 'Not set';

        // Show channel/role mentions for ID-based values
        if (cfg.key === 'mod_help_channel_id' && cfg.value) {
          displayValue = `<#${cfg.value}>`;
        } else if (cfg.key === 'staff_role_id' && cfg.value) {
          displayValue = `<@&${cfg.value}>`;
        }

        embed.addFields({
          name: displayName,
          value: displayValue,
          inline: true,
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
