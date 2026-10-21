/**
 * Slash Command Registration Script.
 *
 * Reads all command files from src/commands/, converts them to JSON,
 * and registers them globally via Discord's REST API.
 *
 * Run: npm run deploy
 * You only need to run this once (or when you change command definitions).
 */

const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const logger = require('./utils/logger');

async function deployCommands() {
  logger.section('Deploying Slash Commands');

  // Load all command files
  const commandsDir = path.join(__dirname, 'commands');
  const commandFiles = fs
    .readdirSync(commandsDir)
    .filter((file) => file.endsWith('.js'));

  const commands = [];

  for (const file of commandFiles) {
    const command = require(path.join(commandsDir, file));

    if (!command.data || !command.execute) {
      logger.warn(`Skipping ${file} — missing 'data' or 'execute' export`);
      continue;
    }

    commands.push(command.data.toJSON());
    logger.info(`Loaded command: /${command.data.name}`);
  }

  if (commands.length === 0) {
    logger.error('No commands found to deploy!');
    process.exit(1);
  }

  // Register globally via REST API
  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  try {
    logger.info(`Registering ${commands.length} global command(s)...`);

    const data = await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );

    logger.success(`Successfully registered ${data.length} command(s)!`);
    logger.info('Global commands may take up to 1 hour to appear in all servers.');
    logger.info('For instant testing, re-invite the bot with the applications.commands scope.');
  } catch (err) {
    logger.error('Failed to deploy commands:', err);
    process.exit(1);
  }
}

deployCommands();
