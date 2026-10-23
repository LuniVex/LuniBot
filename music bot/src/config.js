/**
 * Music Bot — src/config.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env if present. Real environment variables always win over the file.
const envFile = path.join(ROOT_DIR, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function list(value) {
  if (!value) return null;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

// "none" turns the retry-with-other-clients behaviour off.
function fallbackClients(value) {
  return value === 'none' ? '' : value;
}

function loadFileConfig() {
  const file = path.resolve(ROOT_DIR, env.CONFIG_PATH || 'config.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Could not parse config file ${file}: ${err.message}`);
  }
}

const file = loadFileConfig();
const fileYt = file.ytdlp ?? {};
const fileRate = file.rateLimit ?? {};
const fileLyrics = file.lyrics ?? {};

export const config = Object.freeze({
  discordToken: env.DISCORD_TOKEN ?? '',
  discordClientId: env.DISCORD_CLIENT_ID ?? '',
  devGuildId: env.DEV_GUILD_ID || null,
  registerCommandsOnStart: bool(env.REGISTER_COMMANDS_ON_START, true),
  enableMessageTrigger: bool(env.ENABLE_MESSAGE_TRIGGER, true),

  spotifyClientId: env.SPOTIFY_CLIENT_ID || null,
  spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET || null,

  databasePath: path.resolve(ROOT_DIR, env.DATABASE_PATH || 'data/bot.sqlite'),
  dataDir: path.resolve(ROOT_DIR, env.DATA_DIR || 'data'),
  healthPort: int(env.HEALTH_PORT, 8080),
  logLevel: env.LOG_LEVEL || 'info',

  defaultVolume: int(env.DEFAULT_VOLUME, file.defaultVolume ?? 80),
  maxVolume: file.maxVolume ?? 150,
  maxQueueSize: int(env.MAX_QUEUE_SIZE, file.maxQueueSize ?? 500),
  maxPlaylistItems: int(env.MAX_PLAYLIST_ITEMS, file.maxPlaylistItems ?? 200),
  allowedTextChannels: list(env.ALLOWED_TEXT_CHANNELS) ?? file.allowedTextChannels ?? [],
  allowedVoiceChannels: list(env.ALLOWED_VOICE_CHANNELS) ?? file.allowedVoiceChannels ?? [],
  djRoleId: env.DJ_ROLE_ID || file.djRoleId || null,
  leaveWhenEmptyAfterSec: file.leaveWhenEmptyAfterSec ?? 120,
  leaveWhenIdleAfterSec: file.leaveWhenIdleAfterSec ?? 300,
  nowPlayingUpdateSec: Math.max(10, file.nowPlayingUpdateSec ?? 15),
  searchResults: file.searchResults ?? 5,

  rateLimit: {
    lookupsPerUser: fileRate.lookupsPerUser ?? 6,
    perSeconds: fileRate.perSeconds ?? 30,
    maxConcurrentExtractions: int(env.MAX_CONCURRENT_EXTRACTIONS, fileRate.maxConcurrentExtractions ?? 4),
  },

  ytdlp: {
    path: env.YTDLP_PATH || null,
    installMode: env.YTDLP_INSTALL_MODE || 'auto', // auto | venv | binary
    cookiesFile: env.YTDLP_COOKIES_FILE ? path.resolve(ROOT_DIR, env.YTDLP_COOKIES_FILE) : null,
    playerClients: env.YTDLP_PLAYER_CLIENTS || fileYt.playerClients || 'default',
    fallbackPlayerClients: fallbackClients(env.YTDLP_FALLBACK_PLAYER_CLIENTS || fileYt.fallbackPlayerClients || 'web_embedded,web_safari,android_vr'),
    jsRuntime: env.YTDLP_JS_RUNTIME || null,
    updateChannel: env.YTDLP_UPDATE_CHANNEL || fileYt.updateChannel || 'nightly',
    autoUpdate: bool(env.YTDLP_AUTO_UPDATE, fileYt.autoUpdate ?? true),
    extractTimeoutMs: (fileYt.extractTimeoutSec ?? 45) * 1000,
    searchProvider: fileYt.searchProvider || 'ytsearch',
    fallbackSearchProvider: fileYt.fallbackSearchProvider || 'scsearch',
  },

  ffmpegPath: env.FFMPEG_PATH || null,

  lyrics: {
    providers: list(env.LYRICS_PROVIDERS) ?? fileLyrics.providers ?? ['lrclib', 'musixmatch', 'genius'],
    musixmatchKey: env.MUSIXMATCH_API_KEY || null,
    geniusToken: env.GENIUS_ACCESS_TOKEN || null,
    // LRCLIB asks clients to identify themselves.
    userAgent: env.LYRICS_USER_AGENT || 'LuniBot-Music/1.0 (+https://github.com/LuniVex/lunibot)',
    requestTimeoutMs: fileLyrics.requestTimeoutMs ?? 4000,
    totalTimeoutMs: fileLyrics.totalTimeoutMs ?? 12000,
    cacheTtlDays: fileLyrics.cacheTtlDays ?? 30,
    missTtlHours: fileLyrics.missTtlHours ?? 12,
    liveMinEditMs: Math.max(1000, fileLyrics.liveMinEditMs ?? 1500),
    lookaheadMs: fileLyrics.lookaheadMs ?? 400,
  },
});
