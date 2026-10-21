/**
 * Attempts to rename a thread. If Discord blocks due to rate limits,
 * sends a staff-only fallback message instead of crashing.
 *
 * @param {import('discord.js').ThreadChannel} thread
 * @param {string} targetName
 * @param {Object} [options]
 * @param {boolean} [options.lock]    - Also lock the thread
 * @param {boolean} [options.archive] - Also archive the thread
 * @returns {Promise<{ success: boolean, rateLimited: boolean }>}
 */
async function safeSetName(thread, targetName, options = {}) {
  try {
    const editPayload = { name: targetName };
    if (options.lock !== undefined) editPayload.locked = options.lock;
    if (options.archive !== undefined) editPayload.archived = options.archive;

    await thread.edit(editPayload);
    return { success: true, rateLimited: false };
  } catch (err) {
    const isRateLimit =
      err.code === 50013 ||
      err.status === 429 ||
      err.message?.toLowerCase().includes('rate limit');

    if (isRateLimit) {
      console.warn(`[SafeRename] Rate limited on thread ${thread.id}. Target: "${targetName}"`);

      try {
        await thread.send({
          content: `⚠️ **Rate limit hit.** Please manually rename this thread to:\n\`${targetName}\``,
        });
      } catch (sendErr) {
        console.error('[SafeRename] Could not send fallback message:', sendErr);
      }

      // Still apply lock/archive if requested (separate from the name change)
      if (options.lock || options.archive) {
        try {
          const fallbackPayload = {};
          if (options.lock) fallbackPayload.locked = true;
          if (options.archive) fallbackPayload.archived = true;
          await thread.edit(fallbackPayload);
        } catch (_) {
          // Best effort
        }
      }

      return { success: false, rateLimited: true };
    }

    // Non-rate-limit error - log but don't crash
    console.error('[SafeRename] Unexpected error:', err);

    try {
      await thread.send({
        content: `⚠️ **Failed to rename thread.** Please manually rename to:\n\`${targetName}\``,
      });
    } catch (_) {}

    return { success: false, rateLimited: false };
  }
}

module.exports = { safeSetName };
