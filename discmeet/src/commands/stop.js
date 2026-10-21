/**
 * DiscMeet — src/commands/stop.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * /summarize — End the recording, transcribe, clean, and generate AI meeting notes.
 *
 * Uses deferReply() since transcription + summarisation can take > 3 seconds.
 *
 * Lifecycle:
 *   1. End session & stop recording
 *   2. Clear voice channel status + reset bot presence
 *   3. Transcribe → Clean → Summarise → Generate Title
 *   4. Save notes to local file
 *   5. Archive to log channel (pinned title header → detailed notes → transcript file)
 *   6. Post ONE clean embed in the command thread with status + metadata + archive link
 *
 * The command thread is kept tidy — no raw transcripts or chunked notes are posted.
 * All detailed output goes exclusively to the archive channel.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { leave } = require('../voice/connection');
const { buildTimedTranscript } = require('../transcription/timedTranscript');
const { cleanTranscript } = require('../processing/fillerCleaner');
const { summarise, generateTitle } = require('../processing/summariser');
const { formatTime } = require('../utils/formatTime');
const { setIdlePresence, clearVoiceChannelStatus } = require('../utils/presence');
const { postSessionArchive } = require('../utils/archiver');
const { cacheSession } = require('../utils/sessionCache');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('End the recording and generate AI-powered meeting notes'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {{ activeSessions: Map, client: import('discord.js').Client }} context
   */
  async execute(interaction, { activeSessions, client }) {
    const sessionData = activeSessions.get(interaction.guildId);

    if (!sessionData) {
      return interaction.reply({
        content: '❌ No active recording session in this server.',
        ephemeral: true,
      });
    }

    const { session, recorder } = sessionData;
    const summary = session.getSummary();

    // Defer reply — transcription takes time
    await interaction.deferReply();

    // Notify that processing is starting
    const processingEmbed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('⏳ Processing Meeting...')
      .setDescription(
        `Recording ended after **${formatTime(summary.duration)}**\n` +
          `**${summary.speakerCount}** speaker(s), **${summary.segmentCount}** audio segment(s)\n\n` +
          `Transcribing and generating notes — this may take a moment...`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [processingEmbed] });

    // End the session and stop recording
    session.end();
    recorder.destroy();
    activeSessions.delete(interaction.guildId);

    // ── Clear voice status & reset presence ──
    await clearVoiceChannelStatus(client, session.channelId);
    setIdlePresence(client);

    // Disconnect from voice
    leave(interaction.guildId);

    // ── Pipeline: Transcribe → Clean → Summarise → Title → Archive ──

    try {
      // Step 1: Transcribe all audio segments
      const rawTranscript = await buildTimedTranscript(session);

      // Step 2: Clean filler words
      const cleanedTranscript = cleanTranscript(rawTranscript);

      // Step 3: Generate AI summary (detailed notes)
      const meetingNotes = await summarise(cleanedTranscript, {
        durationSeconds: summary.duration,
        speakerCount: summary.speakerCount,
      });

      // Step 4: Generate concise session title
      const sessionTitle = await generateTitle(cleanedTranscript);

      // Step 5: Save to local file
      await saveNotes(sessionTitle, meetingNotes, cleanedTranscript, session);

      // Step 6: Archive to the dedicated log channel
      await postSessionArchive(client, {
        title: sessionTitle,
        transcript: cleanedTranscript,
        meetingNotes,
        summary,
      });

      // Step 7: Post ONE clean embed in the command thread
      const archiveChannelMention = config.logChannelId
        ? `<#${config.logChannelId}>`
        : 'the archive channel';

      const doneEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Meeting Notes Ready')
        .setDescription(`Full notes and transcript saved in ${archiveChannelMention}`)
        .addFields(
          { name: '⏱️ Duration', value: formatTime(summary.duration), inline: true },
          { name: '🗣️ Speakers', value: String(summary.speakerCount), inline: true },
          { name: '📼 Segments', value: String(summary.segmentCount), inline: true },
          { name: '📋 Topic', value: sessionTitle, inline: false }
        )
        .setFooter({ text: 'DiscMeet • Session complete' })
        .setTimestamp();

      await interaction.editReply({ embeds: [doneEmbed] });

      // Cache session data for /resummarize, then clean up recordings
      cacheSession(session, cleanedTranscript);
      cleanupRecordings(session);
    } catch (err) {
      logger.error('Processing pipeline failed:', err);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ Processing Failed')
        .setDescription(
          `An error occurred during transcription/summarisation:\n\`\`\`${err.message}\`\`\``
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Save meeting notes and transcript to a markdown file on disk.
 */
async function saveNotes(title, meetingNotes, transcript, session) {
  try {
    fs.mkdirSync(config.notesDir, { recursive: true });

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `meeting-${dateStr}.md`;
    const filePath = path.join(config.notesDir, fileName);

    const summary = session.getSummary();
    const speakers = [...session.userNames.values()].join(', ');

    const content = [
      `# ${title}`,
      '',
      `> ${new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
      '',
      `**Duration:** ${formatTime(summary.duration)}  `,
      `**Speakers:** ${speakers || 'Unknown'}  `,
      `**Segments:** ${summary.segmentCount}  `,
      '',
      '---',
      '',
      meetingNotes,
      '',
      '---',
      '',
      '## Full Transcript',
      '',
      '```',
      transcript,
      '```',
      '',
    ].join('\n');

    fs.writeFileSync(filePath, content, 'utf-8');
    logger.success(`Notes saved to ${filePath}`);
    return filePath;
  } catch (err) {
    logger.error('Failed to save notes:', err.message);
    return null;
  }
}

function cleanupRecordings(session) {
  const segments = session.getAllSegmentsSorted();
  let cleaned = 0;

  for (const seg of segments) {
    try {
      if (fs.existsSync(seg.filePath)) {
        fs.unlinkSync(seg.filePath);
        cleaned++;
      }
    } catch {
      // Non-critical
    }
  }

  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} temporary recording file(s)`);
  }
}
