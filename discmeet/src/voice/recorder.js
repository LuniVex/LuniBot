/**
 * DiscMeet — src/voice/recorder.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * Per-user audio recorder.
 *
 * Subscribes to the VoiceReceiver's per-user Opus streams, decodes them
 * to PCM via prism-media, buffers the data, and writes WAV files when
 * a speaking segment ends. Manages concurrent streams across all users
 * in the voice channel.
 */

const { EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const fs = require('node:fs');
const path = require('node:path');
const { encodeWav, pcmDuration } = require('../audio/wavEncoder');
const config = require('../config');
const logger = require('../utils/logger');

class Recorder {
  /**
   * @param {import('@discordjs/voice').VoiceConnection} connection - Active voice connection
   * @param {import('./session')} session - Meeting session instance
   * @param {import('discord.js').Client} client - Discord client (to resolve usernames)
   */
  constructor(connection, session, client) {
    this.connection = connection;
    this.session = session;
    this.client = client;
    this.receiver = connection.receiver;

    /** @type {Map<string, boolean>} Tracks which users currently have an active subscription */
    this.activeSubscriptions = new Map();

    /** Counter for unique segment filenames */
    this.segmentCounter = 0;

    // Ensure recordings directory exists
    fs.mkdirSync(config.recordingsDir, { recursive: true });

    // Start listening for speakers
    this._startListening();
  }

  /**
   * Listen for the speaking event and set up per-user recording pipelines.
   * @private
   */
  _startListening() {
    this.receiver.speaking.on('start', (userId) => {
      // Avoid creating duplicate subscriptions for the same user
      if (this.activeSubscriptions.get(userId)) {
        return;
      }

      this.activeSubscriptions.set(userId, true);
      this._recordUser(userId);
    });

    logger.success('Recorder is listening for speakers');
  }

  /**
   * Set up the recording pipeline for a single user's speaking segment.
   *
   * Pipeline: Opus stream → prism Decoder → PCM buffer → WAV file
   *
   * @param {string} userId
   * @private
   */
  async _recordUser(userId) {
    // Resolve display name
    try {
      const guild = this.client.guilds.cache.get(this.session.guildId);
      if (guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          this.session.registerUser(userId, member.displayName);
        }
      }
    } catch {
      // Silently continue — we'll use a fallback name
    }

    const displayName = this.session.userNames.get(userId) || `User-${userId.slice(-4)}`;

    // Record the start time (relative to session start)
    const segmentStartTime = this.session.getRelativeTime();

    // Subscribe to this user's Opus audio stream
    const opusStream = this.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: config.silenceDuration,
      },
    });

    // Create an Opus decoder (48kHz stereo — Discord's native format)
    const decoder = new prism.opus.Decoder({
      channels: 2,
      rate: 48000,
      frameSize: 960,
    });

    // Collect PCM chunks
    const pcmChunks = [];

    decoder.on('data', (chunk) => {
      pcmChunks.push(chunk);
    });

    decoder.on('end', () => {
      this.activeSubscriptions.set(userId, false);

      // Skip empty segments
      if (pcmChunks.length === 0) {
        logger.debug(`Empty segment from ${displayName}, skipping`);
        return;
      }

      const pcmBuffer = Buffer.concat(pcmChunks);

      // Skip very short segments (< 0.3 seconds) — likely noise
      const duration = pcmDuration(pcmBuffer);
      if (duration < 0.3) {
        logger.debug(`Very short segment (${duration.toFixed(2)}s) from ${displayName}, skipping`);
        return;
      }

      // Encode as WAV and save
      const wavBuffer = encodeWav(pcmBuffer);
      const fileName = `segment_${String(this.segmentCounter++).padStart(4, '0')}_${userId}_${Date.now()}.wav`;
      const filePath = path.join(config.recordingsDir, fileName);

      fs.writeFileSync(filePath, wavBuffer);

      // Register segment in the session
      this.session.addSegment(userId, {
        startTime: segmentStartTime,
        duration,
        filePath,
      });

      logger.info(
        `📼 Recorded ${displayName}: ${duration.toFixed(1)}s → ${fileName}`
      );
    });

    decoder.on('error', (err) => {
      logger.error(`Decoder error for ${displayName}:`, err.message);
      this.activeSubscriptions.set(userId, false);
    });

    opusStream.on('error', (err) => {
      logger.error(`Opus stream error for ${displayName}:`, err.message);
    });

    // Pipe the Opus stream through the decoder
    opusStream.pipe(decoder);
  }

  /**
   * Stop recording and clean up all active streams.
   */
  destroy() {
    this.activeSubscriptions.clear();
    logger.info('Recorder destroyed');
  }
}

module.exports = Recorder;
