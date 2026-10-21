/**
 * DiscMeet — src/utils/sessionCache.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * Session Cache Manager.
 *
 * Persists the last completed session's audio segments, transcript, and
 * metadata to disk so that /resummarize can re-process without re-recording.
 *
 * Cache layout (cache/last_session/):
 *   - transcript.txt     — cleaned transcript text
 *   - metadata.json      — session summary (duration, speakers, segments)
 *   - *.wav              — copied audio segment files
 *
 * The cache is overwritten when a new /join session starts.
 */

const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const logger = require('./logger');

/**
 * Save session data to the cache directory.
 * Copies audio segments and writes transcript + metadata.
 *
 * @param {import('../voice/session')} session - The ended meeting session
 * @param {string} transcript - The cleaned transcript text
 */
function cacheSession(session, transcript) {
  try {
    // Ensure cache directory exists (clears any previous cache)
    clearCache();
    fs.mkdirSync(config.cacheDir, { recursive: true });

    // Save transcript
    const transcriptPath = path.join(config.cacheDir, 'transcript.txt');
    fs.writeFileSync(transcriptPath, transcript, 'utf-8');

    // Save metadata
    const summary = session.getSummary();
    const metadata = {
      duration: summary.duration,
      speakerCount: summary.speakerCount,
      segmentCount: summary.segmentCount,
      speakers: [...session.userNames.values()],
      cachedAt: new Date().toISOString(),
    };
    const metadataPath = path.join(config.cacheDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    // Copy audio segment files to cache
    const segments = session.getAllSegmentsSorted();
    let copied = 0;
    for (const seg of segments) {
      try {
        if (fs.existsSync(seg.filePath)) {
          const destPath = path.join(config.cacheDir, path.basename(seg.filePath));
          fs.copyFileSync(seg.filePath, destPath);
          copied++;
        }
      } catch {
        // Non-critical — skip individual file failures
      }
    }

    logger.success(`Session cached: transcript + metadata + ${copied} audio file(s)`);
  } catch (err) {
    logger.error('Failed to cache session:', err.message);
  }
}

/**
 * Load cached session data (transcript + metadata).
 * Returns null if no cache exists.
 *
 * @returns {{ transcript: string, metadata: object } | null}
 */
function loadCachedSession() {
  try {
    const transcriptPath = path.join(config.cacheDir, 'transcript.txt');
    const metadataPath = path.join(config.cacheDir, 'metadata.json');

    if (!fs.existsSync(transcriptPath) || !fs.existsSync(metadataPath)) {
      return null;
    }

    const transcript = fs.readFileSync(transcriptPath, 'utf-8');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    return { transcript, metadata };
  } catch (err) {
    logger.error('Failed to load cached session:', err.message);
    return null;
  }
}

/**
 * Clear the session cache directory.
 */
function clearCache() {
  try {
    if (fs.existsSync(config.cacheDir)) {
      fs.rmSync(config.cacheDir, { recursive: true, force: true });
      logger.info('Session cache cleared');
    }
  } catch (err) {
    logger.warn('Failed to clear session cache:', err.message);
  }
}

module.exports = { cacheSession, loadCachedSession, clearCache };
