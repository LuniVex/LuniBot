/**
 * OpenAI Whisper transcription client.
 *
 * Sends WAV audio files to the Whisper API and returns transcribed text.
 * Handles file size limits and retries.
 */

const fs = require('node:fs');
const path = require('node:path');
const OpenAI = require('openai');
const config = require('../config');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: config.openaiApiKey });

/** Maximum file size for Whisper API (25 MB) */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Transcribe a single audio file using OpenAI Whisper.
 *
 * @param {string} filePath - Absolute path to a WAV/MP3 file
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeFile(filePath) {
  const stats = fs.statSync(filePath);

  if (stats.size > MAX_FILE_SIZE) {
    logger.warn(
      `File ${path.basename(filePath)} is ${(stats.size / 1024 / 1024).toFixed(1)}MB — ` +
        `exceeds 25MB Whisper limit. Skipping.`
    );
    return '[Audio too large to transcribe]';
  }

  if (stats.size < 1000) {
    logger.debug(`File ${path.basename(filePath)} is very small (${stats.size} bytes), skipping`);
    return '';
  }

  try {
    logger.debug(`Transcribing: ${path.basename(filePath)} (${(stats.size / 1024).toFixed(0)}KB)`);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: config.whisperModel,
      response_format: 'text',
      language: 'en',
      temperature: 0,
    });

    const text = (typeof transcription === 'string' ? transcription : transcription.text || '').trim();

    if (text) {
      logger.debug(`Transcribed: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
    }

    return text;
  } catch (err) {
    logger.error(`Whisper transcription failed for ${path.basename(filePath)}:`, err.message);

    // Retry once after a short delay
    try {
      logger.info('Retrying transcription...');
      await new Promise((r) => setTimeout(r, 2000));

      const retry = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: config.whisperModel,
        response_format: 'text',
        language: 'en',
        temperature: 0,
      });

      return (typeof retry === 'string' ? retry : retry.text || '').trim();
    } catch (retryErr) {
      logger.error('Retry also failed:', retryErr.message);
      return '[Transcription failed]';
    }
  }
}

/**
 * Transcribe multiple audio files in sequence.
 *
 * @param {string[]} filePaths - Array of absolute paths to audio files
 * @returns {Promise<Map<string, string>>} Map of filePath → transcribed text
 */
async function transcribeFiles(filePaths) {
  const results = new Map();

  for (const fp of filePaths) {
    const text = await transcribeFile(fp);
    results.set(fp, text);
  }

  return results;
}

module.exports = { transcribeFile, transcribeFiles };
