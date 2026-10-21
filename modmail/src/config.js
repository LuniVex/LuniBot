/**
 * Modmail — src/config.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID,
  ticketsChannelId: process.env.TICKETS_CHANNEL_ID,
  archiveChannelId: process.env.ARCHIVE_CHANNEL_ID,
  staffRoleId: process.env.STAFF_ROLE_ID,
  modHelpChannelId: process.env.MOD_HELP_CHANNEL_ID,
  databasePath: process.env.DATABASE_PATH,
};
