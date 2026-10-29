/**
 * Music Bot — src/player/stream.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { spawn } from 'node:child_process';
import { createAudioResource, StreamType } from '@discordjs/voice';
import { binaries } from '../sources/binaries.js';
import { spawnPipe, track as trackChild } from '../sources/ytdlp.js';

export const FILTERS = Object.freeze({
  bassboost: { label: 'Bass boost', emoji: '🔉', af: 'bass=g=8:f=110:w=0.6' },
  nightcore: { label: 'Nightcore', emoji: '🌙', af: 'asetrate=48000*1.25,aresample=48000', speed: 1.25 },
  eightd: { label: '8D', emoji: '🎧', af: 'apulsator=hz=0.08' },
  normalize: { label: 'Normalise', emoji: '📏', af: 'dynaudnorm=f=150:g=15' },
});

export function playbackSpeed(filters) {
  let speed = 1;
  for (const name of filters) speed *= FILTERS[name]?.speed ?? 1;
  return speed;
}

export function buildAudioFilter({ volume = 100, filters = [] }) {
  // Resample first so asetrate-based effects work from a known 48 kHz base.
  const chain = ['aresample=48000'];
  for (const name of filters) if (FILTERS[name]) chain.push(FILTERS[name].af);
  chain.push(`volume=${(volume / 100).toFixed(2)}`);
  return chain.join(',');
}

function headerArg(headers) {
  return Object.entries(headers ?? {}).map(([k, v]) => `${k}: ${v}\r\n`).join('');
}

/**
 * Build the ffmpeg argument list. Exported for tests.
 * ffmpeg does the decoding, filtering *and* Opus encoding, so the Node event loop only
 * demuxes Ogg pages — no JS-side transcoding.
 */
export function buildFfmpegArgs({ streamInfo, seekSec = 0, volume, filters, isLive, piped }) {
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
  const seek = !isLive && seekSec > 0 ? ['-ss', seekSec.toFixed(2)] : [];
  if (piped) {
    // Input from yt-dlp's stdout is not seekable, so seek on the output side (decode + discard).
    args.push('-i', 'pipe:0', ...seek);
  } else {
    if (/^https?$/.test(streamInfo.protocol) || /^m3u8/.test(streamInfo.protocol)) {
      args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_on_network_error', '1', '-reconnect_delay_max', '5');
    }
    const headers = headerArg(streamInfo.headers);
    if (headers) args.push('-headers', headers);
    args.push(...seek, '-i', streamInfo.url);
  }
  args.push(
    '-vn', '-sn', '-dn',
    '-af', buildAudioFilter({ volume, filters }),
    '-ac', '2', '-ar', '48000',
    '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', '-frame_duration', '20', '-application', 'audio',
    '-f', 'ogg', 'pipe:1',
  );
  return args;
}

/**
 * Start streaming a resolved track. Nothing is written to disk: either ffmpeg reads the
 * direct media URL, or yt-dlp pipes the bytes into ffmpeg (cookie-bound/fragmented formats).
 */
export function createStream({ streamInfo, pageUrl, seekSec = 0, volume = 100, filters = [], isLive = false, metadata }) {
  const piped = Boolean(streamInfo.needsPipe);
  const args = buildFfmpegArgs({ streamInfo, seekSec, volume, filters, isLive, piped });
  const ff = trackChild(spawn(binaries.ffmpeg, args, { stdio: [piped ? 'pipe' : 'ignore', 'pipe', 'pipe'] }));

  let stderr = '';
  let sourceStderr = '';
  let bytesOut = 0;
  // Without a listener a failed launch (ENOENT/EACCES) would throw and take the bot down.
  ff.on('error', (err) => {
    stderr += `\nffmpeg failed to start: ${err.message}`;
  });

  let source = null;
  if (piped) {
    source = spawnPipe(pageUrl);
    source.stdout.pipe(ff.stdin);
    // ffmpeg closing early (skip/stop) turns into EPIPE on our side; that's expected.
    ff.stdin.on('error', () => {});
    source.stdout.on('error', () => {});
    source.on('error', (err) => {
      sourceStderr += `\nyt-dlp failed to start: ${err.message}`;
    });
    // Keep yt-dlp's own errors: when it fails (e.g. YouTube's bot check) ffmpeg just sees EOF.
    source.stderr.on('data', (d) => {
      sourceStderr = (sourceStderr + d).slice(-4000);
    });
  }

  ff.stderr.on('data', (d) => {
    stderr = (stderr + d).slice(-4000);
  });
  ff.stdout.on('error', () => {});
  ff.stdout.on('data', (d) => {
    bytesOut += d.length;
  });

  const exited = new Promise((resolve) => ff.once('close', (code, signal) => resolve({ code, signal })));
  const resource = createAudioResource(ff.stdout, { inputType: StreamType.OggOpus, metadata });

  let killed = false;
  return {
    resource,
    seekSec,
    speed: playbackSpeed(filters),
    exited,
    get killed() {
      return killed;
    },
    piped,
    stderr: () => stderr,
    sourceStderr: () => sourceStderr,
    bytesOut: () => bytesOut,
    /** Current position in the source's own timeline, in seconds. */
    position() {
      return seekSec + (resource.playbackDuration / 1000) * this.speed;
    },
    kill() {
      killed = true;
      source?.kill('SIGKILL');
      ff.kill('SIGKILL');
    },
  };
}

/** Turn ffmpeg's stderr into a short reason a user can understand. */
export function isNoAudio(stderr) {
  return /does not contain any stream|matches no streams|no audio/i.test(String(stderr ?? ''));
}

export function describeStreamFailure(stderr) {
  const text = String(stderr ?? '');
  if (isNoAudio(text)) return 'that link has no audio track';
  if (/403|forbidden/i.test(text)) return 'the source refused the stream (HTTP 403)';
  if (/404|not found/i.test(text)) return 'the stream URL expired or vanished (HTTP 404)';
  if (/timed out|connection (?:reset|refused)|end of file|i\/o error/i.test(text)) return 'the connection to the source dropped';
  if (/invalid data|could not find codec|no such file/i.test(text)) return 'the source sent data that could not be decoded';
  return 'the audio stream stopped unexpectedly';
}
