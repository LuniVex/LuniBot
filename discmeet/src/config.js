/**
 * Configuration loader — reads .env and exports a validated, frozen config object.
 * Fails fast with clear error messages if required keys are missing.
 */

const dotenv = require('dotenv');
const path = require('path');

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const REQUIRED_KEYS = ['DISCORD_TOKEN', 'CLIENT_ID', 'OPENAI_API_KEY'];

// Validate required keys exist
const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `\x1b[31m[CONFIG ERROR]\x1b[0m Missing required environment variables:\n` +
      missing.map((k) => `  • ${k}`).join('\n') +
      `\n\nCopy .env.example to .env and fill in your values.`
  );
  process.exit(1);
}

const config = Object.freeze({
  // Required
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  openaiApiKey: process.env.OPENAI_API_KEY,

  // Optional with defaults
  whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
  summaryModel: process.env.SUMMARY_MODEL || 'gpt-4o-mini',
  silenceDuration: parseInt(process.env.SILENCE_DURATION, 10) || 300,

  // Archive & presence
  logChannelId: process.env.LOG_CHANNEL_ID || null,
  idleStatus: process.env.IDLE_STATUS || 'Watching over meetings',

  // Derived paths
  recordingsDir: path.resolve(__dirname, '..', 'recordings'),
  notesDir: path.resolve(__dirname, '..', 'notes'),
  dataDir: path.resolve(__dirname, '..', 'data'),
  cacheDir: path.resolve(__dirname, '..', 'cache', 'last_session'),
});

module.exports = config;
