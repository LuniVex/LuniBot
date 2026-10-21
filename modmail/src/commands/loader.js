const fs = require('fs');
const path = require('path');
const { Collection, REST, Routes } = require('discord.js');
const config = require('../config');

/**
 * Reads every .js file in this directory (except loader.js),
 * registers them as guild-scoped slash commands, and populates
 * client.commands for the interactionCreate handler.
 */
async function loadCommands(client) {
  client.commands = new Collection();

  const commandsDir = __dirname;
  const commandFiles = fs
    .readdirSync(commandsDir)
    .filter((f) => f.endsWith('.js') && f !== 'loader.js');

  const slashCommands = [];

  for (const file of commandFiles) {
    const command = require(path.join(commandsDir, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      slashCommands.push(command.data.toJSON());
    }
  }

  // Register with Discord (guild-scoped for instant updates)
  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log(
      `[Commands] Registering ${slashCommands.length} slash command(s)...`
    );
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, config.guildId),
      { body: slashCommands }
    );
    console.log('[Commands] Slash commands registered successfully.');
  } catch (err) {
    console.error('[Commands] Failed to register slash commands:', err);
  }
}

module.exports = { loadCommands };
