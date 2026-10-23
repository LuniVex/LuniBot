/**
 * Music Bot — src/deploy-commands.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';
import { commandData } from './bot/commands.js';
import { config } from './config.js';
import { logger } from './logger.js';

/** Register slash commands: instantly in DEV_GUILD_ID if set, otherwise globally. */
export async function registerCommands(applicationId = config.discordClientId) {
  if (!applicationId) throw new Error('DISCORD_CLIENT_ID (application id) is required to register commands');
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const route = config.devGuildId
    ? Routes.applicationGuildCommands(applicationId, config.devGuildId)
    : Routes.applicationCommands(applicationId);
  await rest.put(route, { body: commandData });
  logger.info({ scope: config.devGuildId ? `guild ${config.devGuildId}` : 'global', count: commandData.length }, 'slash commands registered');
}

// `npm run deploy-commands`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  registerCommands().catch((err) => {
    logger.fatal({ err: err.message }, 'command registration failed');
    process.exit(1);
  });
}
