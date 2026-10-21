/**
 * /expense — Integrated expense tracker with 5 subcommands:
 *   add, list, edit, remove, total
 *
 * All expenses are per-user, per-guild and stored in a local JSON file.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const store = require('../expense/store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('expense')
    .setDescription('Track and manage your expenses')

    // ── /expense add ──
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Record a new expense')
        .addNumberOption((opt) =>
          opt.setName('amount').setDescription('Amount spent (e.g. 12.50)').setRequired(true).setMinValue(0.01)
        )
        .addStringOption((opt) =>
          opt.setName('category').setDescription('Category (e.g. Food, Transport, Software)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Optional description').setRequired(false)
        )
    )

    // ── /expense list ──
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Show your expenses for the current month')
        .addStringOption((opt) =>
          opt
            .setName('month')
            .setDescription('Month to view (YYYY-MM format, e.g. 2025-06). Defaults to current month.')
            .setRequired(false)
        )
    )

    // ── /expense edit ──
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit an existing expense')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('Expense ID to edit').setRequired(true).setMinValue(1)
        )
        .addNumberOption((opt) =>
          opt.setName('amount').setDescription('New amount').setRequired(false).setMinValue(0.01)
        )
        .addStringOption((opt) =>
          opt.setName('category').setDescription('New category').setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('New description').setRequired(false)
        )
    )

    // ── /expense remove ──
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Delete an expense')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('Expense ID to remove').setRequired(true).setMinValue(1)
        )
    )

    // ── /expense total ──
    .addSubcommand((sub) =>
      sub
        .setName('total')
        .setDescription('Show total spending for the current month vs your budget')
        .addNumberOption((opt) =>
          opt
            .setName('budget')
            .setDescription('Set your monthly budget (e.g. 500)')
            .setRequired(false)
            .setMinValue(0)
        )
        .addStringOption((opt) =>
          opt
            .setName('month')
            .setDescription('Month to view (YYYY-MM). Defaults to current month.')
            .setRequired(false)
        )
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    switch (sub) {
      case 'add':
        return handleAdd(interaction, userId, guildId);
      case 'list':
        return handleList(interaction, userId, guildId);
      case 'edit':
        return handleEdit(interaction, userId, guildId);
      case 'remove':
        return handleRemove(interaction, userId, guildId);
      case 'total':
        return handleTotal(interaction, userId, guildId);
    }
  },
};

// ── Subcommand Handlers ───────────────────────────────────────────────

async function handleAdd(interaction, userId, guildId) {
  const amount = interaction.options.getNumber('amount');
  const category = interaction.options.getString('category');
  const description = interaction.options.getString('description') || '';

  const { id, expense } = store.addExpense(userId, guildId, amount, category, description);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('✅ Expense Added')
    .addFields(
      { name: 'ID', value: `#${id}`, inline: true },
      { name: 'Amount', value: `£${expense.amount.toFixed(2)}`, inline: true },
      { name: 'Category', value: expense.category, inline: true }
    )
    .setTimestamp();

  if (description) {
    embed.addFields({ name: 'Description', value: description, inline: false });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction, userId, guildId) {
  const monthKey = interaction.options.getString('month') || getCurrentMonth();
  const expenses = store.getExpenses(userId, guildId, monthKey);

  if (expenses.length === 0) {
    return interaction.reply({
      content: `📭 No expenses found for **${formatMonthKey(monthKey)}**.`,
      ephemeral: true,
    });
  }

  // Build a formatted table
  const lines = expenses.map((e) => {
    const date = new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const desc = e.description ? ` — ${e.description}` : '';
    return `\`#${String(e.id).padStart(3)}\` │ ${date} │ **£${e.amount.toFixed(2)}** │ ${e.category}${desc}`;
  });

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`💰 Expenses — ${formatMonthKey(monthKey)}`)
    .setDescription(lines.join('\n'))
    .addFields({
      name: 'Total',
      value: `**£${total.toFixed(2)}** across ${expenses.length} expense(s)`,
      inline: false,
    })
    .setFooter({ text: 'Use /expense edit or /expense remove to manage entries' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleEdit(interaction, userId, guildId) {
  const id = interaction.options.getInteger('id');
  const amount = interaction.options.getNumber('amount');
  const category = interaction.options.getString('category');
  const description = interaction.options.getString('description');

  // Check at least one field is being updated
  if (amount === null && category === null && description === null) {
    return interaction.reply({
      content: '❌ Provide at least one field to update (amount, category, or description).',
      ephemeral: true,
    });
  }

  const updated = store.editExpense(id, userId, guildId, { amount, category, description });

  if (!updated) {
    return interaction.reply({
      content: `❌ Expense **#${id}** not found (or it doesn't belong to you).`,
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('✏️ Expense Updated')
    .addFields(
      { name: 'ID', value: `#${updated.id}`, inline: true },
      { name: 'Amount', value: `£${updated.amount.toFixed(2)}`, inline: true },
      { name: 'Category', value: updated.category, inline: true }
    )
    .setTimestamp();

  if (updated.description) {
    embed.addFields({ name: 'Description', value: updated.description, inline: false });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleRemove(interaction, userId, guildId) {
  const id = interaction.options.getInteger('id');
  const removed = store.removeExpense(id, userId, guildId);

  if (!removed) {
    return interaction.reply({
      content: `❌ Expense **#${id}** not found (or it doesn't belong to you).`,
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🗑️ Expense Removed')
    .setDescription(
      `Deleted **#${removed.id}** — £${removed.amount.toFixed(2)} (${removed.category})`
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleTotal(interaction, userId, guildId) {
  const monthKey = interaction.options.getString('month') || getCurrentMonth();
  const newBudget = interaction.options.getNumber('budget');

  // Set budget if provided
  if (newBudget !== null) {
    store.budget(userId, guildId, monthKey, newBudget);
  }

  const { total, count, byCategory } = store.getMonthlyTotal(userId, guildId, monthKey);
  const currentBudget = store.budget(userId, guildId, monthKey);

  // Category breakdown
  const categoryLines = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => {
      const pct = total > 0 ? ((amt / total) * 100).toFixed(0) : 0;
      return `${cat}: **£${amt.toFixed(2)}** (${pct}%)`;
    });

  const embed = new EmbedBuilder()
    .setColor(currentBudget && total > currentBudget ? 0xed4245 : 0x57f287)
    .setTitle(`📊 Spending Summary — ${formatMonthKey(monthKey)}`)
    .addFields(
      { name: '💷 Total Spent', value: `**£${total.toFixed(2)}**`, inline: true },
      { name: '📝 Expenses', value: `${count}`, inline: true }
    );

  // Budget comparison
  if (currentBudget) {
    const remaining = currentBudget - total;
    const pctUsed = ((total / currentBudget) * 100).toFixed(1);

    // Visual progress bar
    const barLength = 20;
    const filled = Math.min(barLength, Math.round((total / currentBudget) * barLength));
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    embed.addFields(
      { name: '🎯 Budget', value: `£${currentBudget.toFixed(2)}`, inline: true },
      {
        name: 'Progress',
        value: `\`${bar}\` ${pctUsed}%\n${
          remaining >= 0
            ? `✅ **£${remaining.toFixed(2)}** remaining`
            : `🚨 **£${Math.abs(remaining).toFixed(2)}** over budget!`
        }`,
        inline: false,
      }
    );
  } else {
    embed.addFields({
      name: '🎯 Budget',
      value: 'Not set — use `/expense total budget:500` to set one',
      inline: true,
    });
  }

  // Category breakdown
  if (categoryLines.length > 0) {
    embed.addFields({
      name: '📂 By Category',
      value: categoryLines.join('\n'),
      inline: false,
    });
  }

  embed.setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

// ── Utility Helpers ───────────────────────────────────────────────────

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthKey(key) {
  const [year, month] = key.split('-');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}
