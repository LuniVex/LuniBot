/**
 * Music Bot — src/sources/ytdlp.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { UserError } from '../util/errors.js';
import { Semaphore } from '../util/limits.js';
import { binaries } from './binaries.js';

const log = logger.child({ mod: 'ytdlp' });
const extractionSlots = new Semaphore(config.rateLimit.maxConcurrentExtractions);

export const AUDIO_FORMAT = 'bestaudio/best[height<=480]/best';

/** Every live child process, so shutdown can kill them all. */
export const liveChildren = new Set();

export function track(child) {
  liveChildren.add(child);
  child.once('close', () => liveChildren.delete(child));
  return child;
}

export function baseArgs({ playerClients = config.ytdlp.playerClients } = {}) {
  const args = [
    '--ignore-config',
    '--no-progress',
    '--color', 'never',
    '--socket-timeout', '20',
    '--retries', '3',
    '--extractor-retries', '2',
    '--extractor-args', `youtube:player_client=${playerClients}`,
    '--ffmpeg-location', binaries.ffmpeg,
  ];
  if (binaries.jsRuntime) args.push('--js-runtimes', binaries.jsRuntime);
  if (binaries.cookiesFile) args.push('--cookies', binaries.cookiesFile);
  return args;
}

const ERROR_RULES = [
  {
    re: /confirm you(?:['’]re| are) not a bot|not a bot/i,
    code: 'YT_BOT_CHECK',
    message: 'YouTube refused the request with a "confirm you\'re not a bot" check (common on server/VPS IPs).',
    hint: 'Bot owner: set YTDLP_COOKIES_FILE to a cookies.txt from a logged-in browser (README → "YouTube bot check"). Meanwhile, try a SoundCloud/Bandcamp link or another search.',
  },
  {
    re: /confirm your age|age[- ]restricted|inappropriate for some users/i,
    code: 'AGE_RESTRICTED',
    message: 'That video is age-restricted.',
    hint: 'Bot owner: an age-verified account\'s cookies (YTDLP_COOKIES_FILE) are needed to play it.',
  },
  { re: /private video/i, code: 'PRIVATE', message: 'That video is private.', hint: 'Ask the uploader to make it public or unlisted, or pick another link.' },
  { re: /members[- ]only|join this channel/i, code: 'MEMBERS_ONLY', message: 'That video is for channel members only.', hint: 'Pick a public upload of the same track.' },
  { re: /\bDRM\b/i, code: 'DRM', message: 'That content is DRM-protected and cannot be played.', hint: 'Search for the track by name instead; it will be matched on a playable source.' },
  {
    re: /available in your country|geo[- ]?restrict|blocked it in your country|not available from your location/i,
    code: 'GEO',
    message: 'That content is region-locked for the server the bot runs on.',
    hint: 'Search for the track by name to find a different upload.',
  },
  {
    re: /not currently live|channel is offline|stream is offline/i,
    code: 'OFFLINE',
    message: 'That channel isn\'t live right now.',
    hint: 'Try again when it\'s live, or play one of its past broadcasts.',
  },
  {
    re: /live event will begin|premieres in|this live (?:stream|event) (?:will|has not)/i,
    code: 'UPCOMING',
    message: 'That stream or premiere has not started yet.',
    hint: 'Try again once it is live.',
  },
  {
    re: /unsupported url/i,
    code: 'UNSUPPORTED',
    message: 'That site or link type isn\'t supported.',
    hint: 'Double-check the link, or search by name. Supported sites: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md',
  },
  {
    re: /HTTP Error 429|too many requests|rate[- ]?limit/i,
    code: 'RATE_LIMITED',
    message: 'The source is rate-limiting the bot right now.',
    hint: 'Wait a minute and try again.',
  },
  {
    re: /n challenge|signature (?:extraction|solving) failed|javascript runtime|nsig/i,
    code: 'JS_CHALLENGE',
    message: 'yt-dlp could not solve YouTube\'s player challenge.',
    hint: 'Bot owner: ensure Node >= 22 or Deno is available and restart the bot so yt-dlp updates itself.',
  },
  {
    re: /requested format is not available|no video formats found|no formats|only images are available/i,
    code: 'NO_FORMATS',
    message: 'No playable audio was found for that link.',
    hint: 'Try another upload of the same track, or search by name.',
  },
  {
    re: /unavailable|not available|has been removed|does not exist|404|no longer available|terminated/i,
    code: 'UNAVAILABLE',
    message: 'That content is unavailable (deleted, private or blocked).',
    hint: 'Check the link or search by name instead.',
  },
  {
    re: /unable to download (?:webpage|api page)|timed out|connection (?:reset|refused)|name or service not known|temporary failure/i,
    code: 'NETWORK',
    message: 'Could not reach the source.',
    hint: 'It may be down or blocking the bot; try again shortly.',
  },
];

export function mapYtdlpError(stderr) {
  const lines = String(stderr ?? '').split('\n');
  const errorLine = lines.find((l) => l.startsWith('ERROR:')) ?? '';
  const haystack = errorLine || lines.slice(-5).join('\n');
  for (const rule of ERROR_RULES) {
    if (rule.re.test(haystack)) return new UserError(rule.message, { hint: rule.hint, code: rule.code });
  }
  const detail = errorLine.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?(\S+:\s*)?/, '').trim().slice(0, 180);
  return new UserError(detail ? `Couldn't load that: ${detail}` : 'Couldn\'t load that link.', {
    hint: 'Check the link, or search by name instead.',
    code: 'EXTRACT_FAILED',
  });
}

const RETRY_WITH_FALLBACK = new Set(['YT_BOT_CHECK', 'NO_FORMATS', 'JS_CHALLENGE', 'EXTRACT_FAILED']);

function runOnce(args, { timeoutMs, playerClients }) {
  return extractionSlots.run(() => new Promise((resolve, reject) => {
    const fullArgs = [...baseArgs({ playerClients }), ...args];
    const child = track(spawn(binaries.ytdlp, fullArgs, { stdio: ['ignore', 'pipe', 'pipe'] }));
    const out = [];
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => {
      stderr += d;
      if (stderr.length > 64_000) stderr = stderr.slice(-32_000);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new UserError('The audio extractor is not available.', { hint: 'Bot owner: check the yt-dlp install (see logs).', code: 'NO_YTDLP', cause: err }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new UserError('The source took too long to respond.', { hint: 'Try again, or try a different link.', code: 'TIMEOUT' }));
        return;
      }
      const stdout = Buffer.concat(out).toString('utf8');
      // On failure `-J` still prints "null", so an exit code plus no real JSON is an error.
      const trimmed = stdout.trim();
      if (code !== 0 && (!trimmed || trimmed === 'null')) {
        const err = mapYtdlpError(stderr);
        log.debug({ code: err.code, stderr: stderr.slice(-1500) }, 'yt-dlp failed');
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  }));
}

/**
 * Run yt-dlp and return its stdout. Retries once with the fallback YouTube clients
 * when the failure looks like a client-specific block.
 */
export async function runYtdlp(args, { timeoutMs = config.ytdlp.extractTimeoutMs, youtube = true } = {}) {
  try {
    return await runOnce(args, { timeoutMs, playerClients: config.ytdlp.playerClients });
  } catch (err) {
    const fallback = config.ytdlp.fallbackPlayerClients;
    if (!youtube || !fallback || !RETRY_WITH_FALLBACK.has(err.code)) throw err;
    log.info({ code: err.code, fallback }, 'retrying with fallback YouTube player clients');
    return runOnce(args, { timeoutMs, playerClients: fallback });
  }
}

function isYoutubeTarget(target) {
  return /youtube\.com|youtu\.be|^ytsearch/i.test(target);
}

function parseJson(stdout) {
  let data = null;
  try {
    data = JSON.parse(stdout);
  } catch {
    // fall through
  }
  if (!data || typeof data !== 'object') {
    throw new UserError('The extractor returned something unexpected.', { hint: 'Try again; if it repeats, the site may have changed.', code: 'BAD_JSON' });
  }
  return data;
}

/**
 * Metadata for a URL. Playlists come back flat (entries without formats), capped at
 * `playlistEnd` so endless lists (YouTube Mixes/radio) can't hang the queue.
 * A link that is both a video and a list (watch?v=…&list=…) loads the list.
 */
export async function extractInfo(url, { playlistEnd = config.maxPlaylistItems } = {}) {
  const listFlag = /[?&]list=/.test(url) ? '--yes-playlist' : '--no-playlist';
  const { stdout } = await runYtdlp(
    ['-J', '--flat-playlist', listFlag, '--playlist-end', String(playlistEnd), '--', url],
    { youtube: isYoutubeTarget(url) },
  );
  return parseJson(stdout);
}

/** Search a provider (`ytsearch`, `scsearch`, ...) and return flat entries. */
export async function search(query, { limit = config.searchResults, provider = config.ytdlp.searchProvider } = {}) {
  const target = `${provider}${limit}:${query}`;
  const { stdout } = await runYtdlp(['-J', '--flat-playlist', '--', target], { youtube: provider.startsWith('yt'), timeoutMs: 25_000 });
  return parseJson(stdout).entries ?? [];
}

/** Full info for one item, including the selected audio format's direct URL and headers. */
export async function getStreamInfo(url) {
  const { stdout } = await runYtdlp(
    ['-J', '--no-playlist', '-f', AUDIO_FORMAT, '--', url],
    { youtube: isYoutubeTarget(url) },
  );
  const info = parseJson(stdout);
  const fmt = info.requested_downloads?.[0] ?? info;
  if (!fmt.url) throw new UserError('No playable audio was found for that link.', { hint: 'Try another upload of the same track.', code: 'NO_FORMATS' });
  return {
    info,
    url: fmt.url,
    protocol: fmt.protocol ?? info.protocol ?? 'https',
    headers: fmt.http_headers ?? info.http_headers ?? {},
    // Cookie-bound or fragmented formats are piped through yt-dlp rather than fetched by ffmpeg.
    needsPipe: Boolean(fmt.cookies || info.cookies) || !/^(https?|m3u8|m3u8_native)$/.test(fmt.protocol ?? ''),
    // YouTube gates media URLs until the pre-roll ad would have finished (403 before that).
    availableAt: fmt.available_at ? fmt.available_at * 1000 : 0,
    resolvedAt: Date.now(),
  };
}

/** Spawn yt-dlp writing the media to stdout (for formats ffmpeg can't fetch itself). */
export function spawnPipe(url) {
  const args = [...baseArgs(), '-f', AUDIO_FORMAT, '--no-playlist', '--no-part', '-o', '-', '--', url];
  return track(spawn(binaries.ytdlp, args, { stdio: ['ignore', 'pipe', 'pipe'] }));
}
