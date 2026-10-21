/**
 * DiscMeet — src/index.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * DiscMeet Bot — Main Entry Point
 *
 * AI-powered Discord meeting note-taker + expense tracker.
 * Uses Discord Slash Commands (no prefix commands).
 *
 * Slash Commands:
 *   /join       — Join voice channel and start recording
 *   /leave      — Leave voice channel
 *   /summarize  — End recording and generate AI meeting notes
 *   /status     — Show current session info
 *   /expense    — Track expenses (add, list, edit, remove, total)
 *
 * Architecture:
 *   1. Commands are defined in src/commands/ (one file per command)
 *   2. Commands are registered globally via src/deploy-commands.js
 *   3. This file loads commands, sets up the client, and routes interactions
 */

const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Load config first (validates env vars)
const config = require('./config');
const logger = require('./utils/logger');
const { leave } = require('./voice/connection');
const { setIdlePresence, clearVoiceChannelStatus } = require('./utils/presence');

// ── Discord Client Setup ──────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

/**
 * Active voice recording sessions per guild.
 * @type {Map<string, { session: import('./voice/session'), recorder: import('./voice/recorder'), connection: import('@discordjs/voice').VoiceConnection }>}
 */
const activeSessions = new Map();

// ── Load Commands ─────────────────────────────────────────────────────

client.commands = new Collection();

const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsDir, file));

  if (!command.data || !command.execute) {
    logger.warn(`Skipping command file ${file} — missing 'data' or 'execute'`);
    continue;
  }

  client.commands.set(command.data.name, command);
  logger.debug(`Loaded command: /${command.data.name}`);
}

// ── Bot Ready ─────────────────────────────────────────────────────────

client.once(Events.ClientReady, (c) => {
  logger.section('DiscMeet Bot Online');
  logger.success(`Logged in as ${c.user.tag}`);
  logger.info('DiscMeet by LuniVex — https://github.com/LuniVex/lunibot');
  logger.info(`Commands loaded: ${client.commands.size}`);
  logger.info(`Whisper model: ${config.whisperModel}`);
  logger.info(`Summary model: ${config.summaryModel}`);
  logger.info(`Log channel: ${config.logChannelId || '(not set — archive disabled)'}`);
  logger.info(`Serving ${c.guilds.cache.size} server(s)`);
  logger.info('Using slash commands — run "npm run deploy" if commands are not showing up.');

  // Set the default idle presence on startup
  setIdlePresence(client);
});

// ── Interaction Handler ───────────────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  // Only handle chat input (slash) commands
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.warn(`Unknown command received: /${interaction.commandName}`);
    return interaction.reply({
      content: '❌ Unknown command.',
      ephemeral: true,
    });
  }

  try {
    // Pass shared context to the command handler
    const context = {
      activeSessions,
      client,
    };

    await command.execute(interaction, context);
  } catch (err) {
    logger.error(`Command error (/${interaction.commandName}):`, err);

    const errorMsg = `❌ An error occurred: ${err.message}`;

    // Handle both replied and unreplied interactions
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMsg, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => {});
    }
  }
});

// ── Error Handling ────────────────────────────────────────────────────

client.on(Events.Error, (err) => {
  logger.error('Discord client error:', err);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down...');

  // Clean up all active sessions
  for (const [guildId, { session, recorder }] of activeSessions) {
    // Clear voice channel status before leaving
    await clearVoiceChannelStatus(client, session.channelId).catch(() => {});
    session.end();
    recorder.destroy();
    leave(guildId);
  }

  client.destroy();
  process.exit(0);
});

// ── Start ─────────────────────────────────────────────────────────────

logger.section('Starting DiscMeet Bot');
client.login(config.discordToken);
