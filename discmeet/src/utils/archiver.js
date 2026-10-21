/**
 * DiscMeet — src/utils/archiver.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * Session Archiver.
 *
 * Posts completed meeting sessions to a dedicated log/archive channel.
 * Output is clean and consolidated — no intermediate or redundant messages.
 *
 * Archive layout:
 *   1. Header embed with AI-generated title + date/time
 *   2. Detailed meeting notes (embed or chunked text)
 *   3. Transcript uploaded as a single .txt file
 *   4. Blue footer divider embed "End of Session" → PINNED
 *
 * If no LOG_CHANNEL_ID is configured, the archive step is skipped.
 */

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../config');
const logger = require('./logger');
const { formatTime } = require('./formatTime');

/**
 * Post a completed session to the archive/log channel.
 *
 * @param {import('discord.js').Client} client
 * @param {object} opts
 * @param {string} opts.title           - AI-generated session title
 * @param {string} opts.transcript      - The cleaned transcript text
 * @param {string} opts.meetingNotes    - The AI-generated detailed notes
 * @param {object} opts.summary         - Session summary { duration, speakerCount, segmentCount }
 */
async function postSessionArchive(client, { title, transcript, meetingNotes, summary }) {
  const channelId = config.logChannelId;

  if (!channelId) {
    logger.warn('No log channel configured (LOG_CHANNEL_ID) — skipping archive.');
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    logger.warn(`Could not fetch log channel (${channelId}) — skipping archive.`);
    return;
  }

  if (!channel.isTextBased()) {
    logger.warn(`Log channel (${channelId}) is not a text channel — skipping archive.`);
    return;
  }

  logger.section('Archiving Session');

  try {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    // ── Step 1: Header with AI title → Pin ──────────────────────────

    const headerEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 ${title}`)
      .setDescription(
        `**${formattedDate}** — ${formattedTime}\n\n` +
        `⏱️ Duration: **${formatTime(summary.duration)}** • ` +
        `🗣️ Speakers: **${summary.speakerCount}** • ` +
        `📼 Segments: **${summary.segmentCount}**`
      )
      .setTimestamp(now);

    const headerMsg = await channel.send({ embeds: [headerEmbed] });
    logger.info(`Session header posted: "${title}"`);

    // ── Step 2: Detailed meeting notes ──────────────────────────────

    if (meetingNotes && meetingNotes.trim().length > 0) {
      const maxEmbedDesc = 4000; // Discord embed description limit

      if (meetingNotes.length <= maxEmbedDesc) {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle('🧠 Meeting Notes')
              .setDescription(meetingNotes),
          ],
        });
      } else {
        // For very long notes, send an embed header then chunked text
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle('🧠 Meeting Notes'),
          ],
        });

        const chunks = splitText(meetingNotes, 1900);
        for (const chunk of chunks) {
          await channel.send(chunk);
        }
      }
      logger.info('Detailed meeting notes posted to archive');
    }

    // ── Step 3: Transcript as single file ───────────────────────────

    if (transcript && transcript.trim().length > 0) {
      const dateStamp = now.toISOString().slice(0, 10);
      const safeTitle = title
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 40);

      const transcriptAttachment = new AttachmentBuilder(
        Buffer.from(transcript, 'utf-8'),
        { name: `transcript-${safeTitle}-${dateStamp}.txt` }
      );

      await channel.send({
        files: [transcriptAttachment],
      });
      logger.info('Transcript file uploaded to archive');
    }

    // ── Step 4: Footer divider (Not pinned) ─────────────────────────

    const dividerLine = '━'.repeat(40);

    const footerEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setDescription(
        `${dividerLine}\n\n` +
        `**End of Session** — ${formattedTime}\n\n` +
        `${dividerLine}`
      )
      .setTimestamp(now);

    await channel.send({ embeds: [footerEmbed] });
    logger.info('Session footer divider posted');

    // ── Step 5: Pin Header ──────────────────────────────────────────

    try {
      await headerMsg.pin();
      logger.success('Session header pinned (after all messages sent)');
    } catch (pinErr) {
      logger.warn(`Failed to pin session header: ${pinErr.message}`);
    }

    logger.success('Session archived successfully');
  } catch (err) {
    logger.error('Failed to archive session:', err.message);
  }
}

/**
 * Split text into chunks that fit within Discord's message length limit.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string[]}
 */
function splitText(text, maxLength) {
  const lines = text.split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

module.exports = { postSessionArchive };
