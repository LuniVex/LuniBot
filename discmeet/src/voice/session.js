/**
 * Meeting session state manager.
 *
 * Tracks the session lifecycle: start time, active speakers, guild/channel IDs,
 * and all recorded audio segments. Provides methods to calculate relative
 * timestamps and gather data for the transcription pipeline.
 */

const logger = require('../utils/logger');

class MeetingSession {
  /**
   * @param {string} guildId    - Discord guild (server) ID
   * @param {string} channelId  - Voice channel ID
   * @param {string} textChannelId - Text channel ID for posting results
   */
  constructor(guildId, channelId, textChannelId) {
    this.guildId = guildId;
    this.channelId = channelId;
    this.textChannelId = textChannelId;
    this.startedAt = Date.now();
    this.active = true;

    /**
     * Map of userId → array of segment metadata.
     * Each segment: { startTime: number, duration: number, filePath: string }
     * @type {Map<string, Array<{startTime: number, duration: number, filePath: string}>>}
     */
    this.segments = new Map();

    /**
     * Map of userId → display name (resolved when they first speak).
     * @type {Map<string, string>}
     */
    this.userNames = new Map();

    logger.info(`Meeting session started for channel ${channelId}`);
  }

  /**
   * Get elapsed seconds since session start.
   * @returns {number}
   */
  getElapsedSeconds() {
    return (Date.now() - this.startedAt) / 1000;
  }

  /**
   * Get relative timestamp (seconds from session start) for a given moment.
   * @param {number} [timestamp=Date.now()] - Absolute timestamp in ms
   * @returns {number} Relative seconds
   */
  getRelativeTime(timestamp = Date.now()) {
    return Math.max(0, (timestamp - this.startedAt) / 1000);
  }

  /**
   * Register a user's display name.
   * @param {string} userId
   * @param {string} displayName
   */
  registerUser(userId, displayName) {
    if (!this.userNames.has(userId)) {
      this.userNames.set(userId, displayName);
      logger.info(`Registered speaker: ${displayName} (${userId})`);
    }
  }

  /**
   * Add a completed audio segment for a user.
   * @param {string} userId
   * @param {{startTime: number, duration: number, filePath: string}} segment
   */
  addSegment(userId, segment) {
    if (!this.segments.has(userId)) {
      this.segments.set(userId, []);
    }
    this.segments.get(userId).push(segment);
    logger.debug(
      `Segment added for ${this.userNames.get(userId) || userId}: ` +
        `start=${segment.startTime.toFixed(1)}s, duration=${segment.duration.toFixed(1)}s`
    );
  }

  /**
   * Get all segments across all users, sorted chronologically.
   * @returns {Array<{userId: string, displayName: string, startTime: number, duration: number, filePath: string}>}
   */
  getAllSegmentsSorted() {
    const allSegments = [];
    for (const [userId, segs] of this.segments) {
      const displayName = this.userNames.get(userId) || `User-${userId.slice(-4)}`;
      for (const seg of segs) {
        allSegments.push({ userId, displayName, ...seg });
      }
    }
    allSegments.sort((a, b) => a.startTime - b.startTime);
    return allSegments;
  }

  /**
   * Get a summary of this session.
   * @returns {{ duration: number, speakerCount: number, segmentCount: number }}
   */
  getSummary() {
    let segmentCount = 0;
    for (const segs of this.segments.values()) {
      segmentCount += segs.length;
    }
    return {
      duration: this.getElapsedSeconds(),
      speakerCount: this.userNames.size,
      segmentCount,
    };
  }

  /**
   * End this session.
   */
  end() {
    this.active = false;
    const summary = this.getSummary();
    logger.info(
      `Session ended — Duration: ${Math.floor(summary.duration)}s, ` +
        `Speakers: ${summary.speakerCount}, Segments: ${summary.segmentCount}`
    );
  }
}

module.exports = MeetingSession;
