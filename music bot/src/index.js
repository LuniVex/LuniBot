/**
 * Music Bot — src/index.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import { generateDependencyReport } from '@discordjs/voice';
import { createInteractionHandler } from './bot/interactions.js';
import { createMessageHandler } from './bot/messageTrigger.js';
import { config } from './config.js';
import { Store } from './db.js';
import { registerCommands } from './deploy-commands.js';
import { startHealthServer } from './health.js';
import { logger } from './logger.js';
import { configureLyrics } from './lyrics/service.js';
import { PlayerManager } from './player/PlayerManager.js';
import { binaries, prepareBinaries } from './sources/binaries.js';
import { liveChildren } from './sources/ytdlp.js';
import * as ui from './ui/nowPlaying.js';

const log = logger.child({ mod: 'main' });
const startedAt = Date.now();
let runtime = null;
let shuttingDown = false;

function createRuntime(store, messageTrigger) {
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];
  if (messageTrigger) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  const client = new Client({ intents, allowedMentions: { parse: [], repliedUser: false } });
  const manager = new PlayerManager({ client, store, ui });
  const ctx = { client, manager, store, log, messageTrigger };

  client.on(Events.InteractionCreate, createInteractionHandler(ctx));
  if (messageTrigger) client.on(Events.MessageCreate, createMessageHandler(ctx));
  client.on(Events.VoiceStateUpdate, (o, n) => manager.handleVoiceStateUpdate(o, n));
  client.on(Events.Error, (err) => log.error({ err: err.message }, 'discord client error'));
  client.on(Events.ShardDisconnect, (event) => log.warn({ code: event.code }, 'gateway disconnected'));
  client.on(Events.ShardResume, () => log.info('gateway resumed'));
  client.once(Events.ClientReady, async (c) => {
    log.info({ user: c.user.tag, guilds: c.guilds.cache.size, messageTrigger }, 'logged in');
    log.info('[Credit] Music Bot by LuniVex — https://github.com/LuniVex/lunibot');
    c.user.setActivity({ name: '/play', type: ActivityType.Listening });
    if (config.registerCommandsOnStart) {
      await registerCommands(config.discordClientId || c.application.id).catch((err) => log.error({ err: err.message }, 'command registration failed'));
    }
    await manager.restoreAlwaysOn().catch((err) => log.error({ err: err.message }, 'restore 24/7 failed'));
  });
  return ctx;
}

async function login(store) {
  let ctx = createRuntime(store, config.enableMessageTrigger);
  try {
    await ctx.client.login(config.discordToken);
  } catch (err) {
    const disallowed = /disallowed intents|privileged intent/i.test(`${err.message} ${err.code}`);
    if (!ctx.messageTrigger || !disallowed) throw err;
    log.warn('Message Content intent is not enabled in the Developer Portal; music-channel trigger disabled');
    await ctx.client.destroy();
    ctx = createRuntime(store, false);
    await ctx.client.login(config.discordToken);
  }
  return ctx;
}

async function shutdown(signal, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, 'shutting down');
  const force = setTimeout(() => {
    log.warn('forced exit after timeout');
    process.exit(code || 1);
  }, 10_000);
  force.unref();
  try {
    if (runtime?.manager) {
      await Promise.race([runtime.manager.shutdown(), new Promise((r) => setTimeout(r, 6_000))]);
    }
    for (const child of liveChildren) child.kill('SIGKILL');
    await runtime?.client?.destroy();
    runtime?.health?.close();
    runtime?.store?.close();
  } catch (err) {
    log.error({ err: err.message }, 'error during shutdown');
  }
  log.info('bye');
  process.exit(code);
}

async function main() {
  if (!config.discordToken) {
    log.fatal('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => log.error({ err }, 'unhandled rejection'));
  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'uncaught exception');
    void shutdown('uncaughtException', 1);
  });

  runtime = {};
  runtime.health = startHealthServer(config.healthPort, () => {
    const client = runtime.client;
    const ready = Boolean(client?.isReady()) && !shuttingDown;
    return {
      ok: ready,
      status: shuttingDown ? 'shutting_down' : ready ? 'ready' : 'starting',
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      guilds: client?.guilds.cache.size ?? 0,
      wsPingMs: client?.ws.ping ?? null,
      ...(runtime.manager?.stats() ?? { players: 0 }),
      ytdlp: binaries.ytdlpVersion,
      messageTrigger: runtime.messageTrigger ?? null,
    };
  });

  await prepareBinaries();
  log.debug({ report: generateDependencyReport() }, 'voice dependency report');

  runtime.store = new Store();
  const pruned = runtime.store.pruneHistory();
  if (pruned) log.info({ pruned }, 'pruned old play history');
  const expired = runtime.store.pruneLyrics();
  if (expired) log.info({ expired }, 'pruned expired lyrics cache entries');
  configureLyrics({ store: runtime.store });

  const ctx = await login(runtime.store);
  Object.assign(runtime, { client: ctx.client, manager: ctx.manager, messageTrigger: ctx.messageTrigger });
}

main().catch((err) => {
  log.fatal({ err: err.message, stack: err.stack }, 'startup failed');
  void shutdown('startup-failure', 1);
});
