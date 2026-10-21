const db = require('../database/db');
const envConfig = require('../config');

/**
 * Reads a config value from the DB config table.
 * Returns the value if non-empty, otherwise null.
 */
function getConfigValue(key) {
  const row = db
    .prepare('SELECT value FROM config WHERE key = ?')
    .get(key);
  return row?.value || null;
}

/**
 * Returns the mod-help channel ID.
 * Priority: DB config → .env MOD_HELP_CHANNEL_ID
 */
function getModHelpChannelId() {
  return getConfigValue('mod_help_channel_id') || envConfig.modHelpChannelId || null;
}

/**
 * Returns the staff role ID.
 * Priority: DB config → .env STAFF_ROLE_ID
 */
function getStaffRoleId() {
  return getConfigValue('staff_role_id') || envConfig.staffRoleId || null;
}

module.exports = { getConfigValue, getModHelpChannelId, getStaffRoleId };
