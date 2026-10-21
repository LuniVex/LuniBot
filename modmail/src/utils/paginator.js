/**
 * Reaction-based pagination utility.
 * Sends an embed with ◀️ / ▶️ reactions and swaps pages on user clicks.
 */
async function paginate(interaction, pages, timeout = 120_000) {
  if (pages.length === 0) {
    return interaction.reply({ content: 'No results found.', ephemeral: true });
  }

  let currentPage = 0;

  const getEmbed = () => {
    const embed = pages[currentPage];
    embed.setFooter({ text: `Page ${currentPage + 1} of ${pages.length}` });
    return embed;
  };

  const message = await interaction.reply({
    embeds: [getEmbed()],
    fetchReply: true,
  });

  if (pages.length <= 1) return;

  await message.react('◀️');
  await message.react('▶️');

  const filter = (reaction, user) =>
    ['◀️', '▶️'].includes(reaction.emoji.name) && user.id === interaction.user.id;

  const collector = message.createReactionCollector({ filter, time: timeout });

  collector.on('collect', async (reaction, user) => {
    if (reaction.emoji.name === '▶️') {
      currentPage = (currentPage + 1) % pages.length;
    } else {
      currentPage = (currentPage - 1 + pages.length) % pages.length;
    }

    await message.edit({ embeds: [getEmbed()] });
    await reaction.users.remove(user.id).catch(() => {});
  });

  collector.on('end', () => {
    message.reactions.removeAll().catch(() => {});
  });
}

module.exports = { paginate };
