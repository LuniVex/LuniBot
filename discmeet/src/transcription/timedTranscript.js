/**
 * Timed transcript builder.
 *
 * Takes the meeting session's segments (each with a speaker, start time,
 * and audio file path), transcribes each via Whisper, and assembles a
 * chronologically-ordered timed transcript.
 *
 * Output format:
 *   [01:23] Alice: "So we need to discuss the budget."
 *   [01:45] Bob: "I think we should allocate more to marketing."
 */

const { transcribeFile } = require('./whisper');
const { formatTime } = require('../utils/formatTime');
const logger = require('../utils/logger');

/**
 * Build a complete timed transcript from a meeting session.
 *
 * @param {import('../voice/session')} session - The meeting session
 * @returns {Promise<string>} The formatted timed transcript
 */
async function buildTimedTranscript(session) {
  const segments = session.getAllSegmentsSorted();

  if (segments.length === 0) {
    logger.warn('No audio segments to transcribe');
    return '(No speech was recorded during this session.)';
  }

  logger.section('Transcribing Audio Segments');
  logger.info(`Processing ${segments.length} segment(s) from ${session.userNames.size} speaker(s)...`);

  const transcriptLines = [];
  let processedCount = 0;

  for (const segment of segments) {
    processedCount++;
    const progress = `[${processedCount}/${segments.length}]`;

    logger.info(
      `${progress} Transcribing ${segment.displayName} ` +
        `(${segment.duration.toFixed(1)}s at ${formatTime(segment.startTime)})...`
    );

    const text = await transcribeFile(segment.filePath);

    if (text && text !== '[Transcription failed]' && text !== '[Audio too large to transcribe]') {
      const timestamp = formatTime(segment.startTime);
      const line = `${timestamp} ${segment.displayName}: "${text}"`;
      transcriptLines.push(line);
    } else if (text) {
      // Include error markers so the user knows something was missed
      const timestamp = formatTime(segment.startTime);
      transcriptLines.push(`${timestamp} ${segment.displayName}: ${text}`);
    }
  }

  const transcript = transcriptLines.join('\n');

  logger.success(`Transcript complete — ${transcriptLines.length} entries`);

  return transcript;
}

/**
 * Build a raw (unformatted) transcript — just text per speaker, no timestamps.
 * Useful for feeding into the summariser with less noise.
 *
 * @param {import('../voice/session')} session
 * @returns {Promise<string>}
 */
async function buildRawTranscript(session) {
  const segments = session.getAllSegmentsSorted();

  if (segments.length === 0) {
    return '';
  }

  const lines = [];

  for (const segment of segments) {
    const text = await transcribeFile(segment.filePath);
    if (text && !text.startsWith('[')) {
      lines.push(`${segment.displayName}: ${text}`);
    }
  }

  return lines.join('\n');
}

module.exports = { buildTimedTranscript, buildRawTranscript };
