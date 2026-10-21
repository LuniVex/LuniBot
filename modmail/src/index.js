/**
 * Modmail — src/index.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { initialize } = require('./database/schema');
const fs = require('fs');
const path = require('path');

// ── Initialize database ─────────────────────────────────────────
initialize();

// ── Create Discord client ────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [
    Partials.Channel,  // Required for DM events
    Partials.Message,  // Required for uncached message edits/deletes
    Partials.Reaction, // Required for reaction collectors on uncached messages
  ],
});

// ── Load event handlers ──────────────────────────────────────
const eventsDir = path.join(__dirname, 'events');
const eventFiles = fs
  .readdirSync(eventsDir)
  .filter((f) => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsDir, file));

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }

  console.log(`[Events] Loaded ${event.name} (${event.once ? 'once' : 'on'})`);
}

// ── Global error handlers ────────────────────────────────────
client.on('error', (err) => console.error('[Client Error]', err));

process.on('unhandledRejection', (err) =>
  console.error('[Unhandled Rejection]', err)
);

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
  process.exit(1);
});

// ── Login ────────────────────────────────────────────────────
client.login(config.token);
