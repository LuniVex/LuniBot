/**
 * Music Bot — src/sources/binaries.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { spawn } from 'node:child_process';
import { constants, createWriteStream } from 'node:fs';
import { access, chmod, copyFile, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config, ROOT_DIR } from '../config.js';
import { logger } from '../logger.js';

const log = logger.child({ mod: 'binaries' });

/** Resolved once at startup by `prepareBinaries()`. */
export const binaries = {
  ytdlp: null,
  ytdlpVersion: null,
  ffmpeg: null,
  jsRuntime: null,
  cookiesFile: null,
};

async function isExecutable(file) {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(name) {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (dir && await isExecutable(candidate)) return candidate;
    }
  }
  return null;
}

/** Run a short-lived command and capture its output (used for --version / -U only). */
export function runCommand(file, args, { timeoutMs = 60_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (error) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: String(error) }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

async function locateFfmpeg() {
  if (config.ffmpegPath) return config.ffmpegPath;
  const onPath = await findOnPath('ffmpeg');
  if (onPath) return onPath;
  try {
    const mod = await import('ffmpeg-static');
    if (mod.default && await isExecutable(mod.default)) return mod.default;
  } catch {
    // optional dependency not installed
  }
  return null;
}

function ytdlpAsset() {
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'linux') return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  return null;
}

function releaseRepo() {
  return config.ytdlp.updateChannel === 'nightly' ? 'yt-dlp/yt-dlp-nightly-builds' : 'yt-dlp/yt-dlp';
}

async function downloadYtdlp(dest) {
  const asset = ytdlpAsset();
  if (!asset) throw new Error(`No standalone yt-dlp build for ${process.platform}; set YTDLP_PATH`);
  const url = `https://github.com/${releaseRepo()}/releases/latest/download/${asset}`;
  log.info({ url }, 'downloading yt-dlp');
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
  if (!res.ok || !res.body) throw new Error(`yt-dlp download failed: HTTP ${res.status}`);
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  await chmod(tmp, 0o755);
  await rename(tmp, dest);
}

async function findPython() {
  for (const name of ['python3', 'python']) {
    const file = await findOnPath(name);
    if (!file) continue;
    const res = await runCommand(file, ['-c', 'import sys; print(sys.version_info >= (3, 10))'], { timeoutMs: 15_000 });
    if (res.stdout.trim() === 'True') return file;
  }
  return null;
}

/**
 * Preferred install: a private virtualenv with `yt-dlp[default,curl-cffi]`. It starts in
 * ~0.3s (the one-file binaries unpack themselves on every run, ~6s on macOS), ships
 * certifi, EJS and impersonation support, and `pip install -U` is the refresh.
 */
async function setupVenv() {
  const python = await findPython();
  if (!python) return null;
  const venv = path.join(ROOT_DIR, '.venv-ytdlp');
  const binDir = process.platform === 'win32' ? 'Scripts' : 'bin';
  const exe = path.join(venv, binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  const pip = path.join(venv, binDir, process.platform === 'win32' ? 'pip.exe' : 'pip');
  const installed = await isExecutable(exe);

  if (!await isExecutable(pip)) {
    log.info({ venv }, 'creating yt-dlp virtualenv');
    const res = await runCommand(python, ['-m', 'venv', venv], { timeoutMs: 120_000 });
    if (res.code !== 0) {
      log.warn({ err: res.stderr.slice(-300) }, 'could not create virtualenv');
      return null;
    }
  }
  if (installed && !config.ytdlp.autoUpdate) return { file: exe };

  const pre = config.ytdlp.updateChannel === 'nightly' ? ['--pre'] : [];
  for (const spec of ['yt-dlp[default,curl-cffi]', 'yt-dlp[default]']) {
    const res = await runCommand(pip, ['install', '-q', '-U', '--disable-pip-version-check', ...pre, spec], { timeoutMs: 300_000 });
    if (res.code === 0) {
      log.info({ spec }, installed ? 'yt-dlp refreshed' : 'yt-dlp installed');
      return { file: exe };
    }
    log.warn({ spec, err: res.stderr.trim().split('\n').slice(-2).join(' | ') }, 'pip install failed');
  }
  // Offline or PyPI down: keep using what is already there.
  return installed ? { file: exe } : null;
}

async function setupStandalone() {
  const managed = path.join(ROOT_DIR, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (!await isExecutable(managed)) {
    await downloadYtdlp(managed);
    return { file: managed };
  }
  if (config.ytdlp.autoUpdate) {
    const target = config.ytdlp.updateChannel === 'nightly' ? 'nightly' : 'stable';
    const res = await runCommand(managed, ['--update-to', target], { timeoutMs: 120_000 });
    const out = `${res.stdout}${res.stderr}`.trim().split('\n').slice(-1)[0];
    if (res.code === 0) log.info({ out }, 'yt-dlp update check done');
    else log.warn({ out }, 'yt-dlp self-update failed');
  }
  return { file: managed };
}

async function locateYtdlp() {
  if (config.ytdlp.path) return { file: config.ytdlp.path };
  const mode = config.ytdlp.installMode;
  if (mode !== 'binary') {
    const venv = await setupVenv().catch((err) => {
      log.warn({ err: err.message }, 'virtualenv setup failed');
      return null;
    });
    if (venv) return venv;
    if (mode === 'venv') return null;
  }
  try {
    return await setupStandalone();
  } catch (err) {
    log.warn({ err: err.message }, 'could not get standalone yt-dlp, falling back to PATH');
    const onPath = await findOnPath('yt-dlp');
    return onPath ? { file: onPath } : null;
  }
}

function pickJsRuntime() {
  if (config.ytdlp.jsRuntime) return config.ytdlp.jsRuntime;
  // yt-dlp accepts Node >= 22 as its JS challenge solver; we are already running on one.
  const major = Number(process.versions.node.split('.')[0]);
  return major >= 22 ? `node:${process.execPath}` : null;
}

/**
 * Locate ffmpeg + yt-dlp and refresh yt-dlp. YouTube breaks extractors often, so the
 * update runs on every start; a failed update is logged but never blocks boot
 * (a custom YTDLP_PATH is left alone — update it with its own package manager).
 */
export async function prepareBinaries() {
  binaries.ffmpeg = await locateFfmpeg();
  if (!binaries.ffmpeg) throw new Error('ffmpeg not found. Install it, set FFMPEG_PATH, or `npm install ffmpeg-static`.');

  const yt = await locateYtdlp();
  if (!yt) throw new Error('yt-dlp not found and could not be downloaded. Install it or set YTDLP_PATH.');
  binaries.ytdlp = yt.file;

  const ver = await runCommand(yt.file, ['--version'], { timeoutMs: 30_000 });
  binaries.ytdlpVersion = ver.stdout.trim() || 'unknown';

  binaries.jsRuntime = pickJsRuntime();
  if (!binaries.jsRuntime) {
    log.warn('no JS runtime for yt-dlp (needs Node >= 22 or Deno); YouTube formats will be limited');
  }

  if (config.ytdlp.cookiesFile) {
    // yt-dlp rewrites the cookie jar after every run, so work on a private copy and
    // leave the operator's file (often mounted read-only) untouched.
    const copy = path.join(config.dataDir, 'cookies.runtime.txt');
    try {
      await mkdir(config.dataDir, { recursive: true });
      await rm(copy, { force: true });
      await copyFile(config.ytdlp.cookiesFile, copy);
      binaries.cookiesFile = copy;
      log.info('using YouTube cookies file');
    } catch (err) {
      log.error({ err: err.message, file: config.ytdlp.cookiesFile }, 'YTDLP_COOKIES_FILE is set but unreadable; continuing without cookies');
    }
  }

  log.info({ ytdlp: binaries.ytdlp, version: binaries.ytdlpVersion, ffmpeg: binaries.ffmpeg, jsRuntime: binaries.jsRuntime }, 'binaries ready');
  return binaries;
}
