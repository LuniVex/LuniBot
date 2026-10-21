const { ActivityType } = require('discord.js');
const db = require('../database/db');
const { loadCommands } = require('../commands/loader');

module.exports = {
  name: 'ready',
  once: true,

  async execute(client) {
    console.log(`[Ready] Logged in as ${client.user.tag}`);

    // Register all slash commands
    await loadCommands(client);

    // Set activity from the config table
    const activity = db
      .prepare("SELECT value FROM config WHERE key = 'activity_status'")
      .get();

    if (activity?.value) {
      client.user.setActivity(activity.value, {
        type: ActivityType.Watching,
      });
    }

    console.log('[Ready] Modmail bot is online and ready.');
  },
};
