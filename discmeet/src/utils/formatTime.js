/**
 * DiscMeet — src/utils/formatTime.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * Converts elapsed seconds into a formatted timestamp string.
 *
 * @param {number} totalSeconds - Elapsed seconds (can be fractional)
 * @returns {string} Formatted as [MM:SS]
 *
 * @example
 *   formatTime(0)    → "[00:00]"
 *   formatTime(83)   → "[01:23]"
 *   formatTime(3661) → "[61:01]"
 */
function formatTime(totalSeconds) {
  const seconds = Math.floor(totalSeconds);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `[${mm}:${ss}]`;
}

module.exports = { formatTime };
