/**
 * DiscMeet — src/commands/resummarize.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * /resummarize — Re-process the last cached session.
 *
 * Loads the cached transcript from the previous session, re-runs the
 * AI summariser and title generator, and posts the results to the
 * archive channel using the same format (Title → Notes → Transcript → Footer).
 *
 * Useful for testing prompt adjustments without re-recording a meeting.
 * Uses the cached transcript to save Whisper API costs.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { summarise, generateTitle } = require('../processing/summariser');
const { postSessionArchive } = require('../utils/archiver');
const { loadCachedSession } = require('../utils/sessionCache');
const { formatTime } = require('../utils/formatTime');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resummarize')
    .setDescription('Re-summarize the last recorded session using cached data (debug tool)'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {{ client: import('discord.js').Client }} context
   */
  async execute(interaction, { client }) {
    // Load cached session
    const cached = loadCachedSession();

    if (!cached) {
      return interaction.reply({
        content: '❌ No cached session found. Record a meeting with `/join` → `/summarize` first.',
        ephemeral: true,
      });
    }

    const { transcript, metadata } = cached;

    if (!transcript || transcript.trim().length === 0) {
      return interaction.reply({
        content: '❌ Cached transcript is empty — nothing to re-summarize.',
        ephemeral: true,
      });
    }

    // Defer — summarisation takes time
    await interaction.deferReply();

    const processingEmbed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('🔄 Re-summarizing cached session...')
      .setDescription(
        `Using cached transcript from **${metadata.cachedAt || 'unknown'}**\n` +
          `**${metadata.speakerCount}** speaker(s), **${metadata.segmentCount}** segment(s)\n\n` +
          `Re-running AI summariser — this may take a moment...`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [processingEmbed] });

    try {
      // Step 1: Re-generate AI summary from cached transcript
      const meetingNotes = await summarise(transcript, {
        durationSeconds: metadata.duration,
        speakerCount: metadata.speakerCount,
      });

      // Step 2: Re-generate title
      const sessionTitle = await generateTitle(transcript);

      // Step 3: Build summary object matching the archiver's expected format
      const summary = {
        duration: metadata.duration,
        speakerCount: metadata.speakerCount,
        segmentCount: metadata.segmentCount,
      };

      // Step 4: Archive to the log channel
      await postSessionArchive(client, {
        title: sessionTitle,
        transcript,
        meetingNotes,
        summary,
      });

      // Step 5: Clean embed in the command thread
      const archiveChannelMention = config.logChannelId
        ? `<#${config.logChannelId}>`
        : 'the archive channel';

      const doneEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Re-summarization Complete')
        .setDescription(`Updated notes posted in ${archiveChannelMention}`)
        .addFields(
          { name: '⏱️ Duration', value: formatTime(summary.duration), inline: true },
          { name: '🗣️ Speakers', value: String(summary.speakerCount), inline: true },
          { name: '📼 Segments', value: String(summary.segmentCount), inline: true },
          { name: '📋 Topic', value: sessionTitle, inline: false }
        )
        .setFooter({ text: 'DiscMeet • Re-summarized from cache' })
        .setTimestamp();

      await interaction.editReply({ embeds: [doneEmbed] });
    } catch (err) {
      logger.error('Re-summarization failed:', err);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ Re-summarization Failed')
        .setDescription(`\`\`\`${err.message}\`\`\``)
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
