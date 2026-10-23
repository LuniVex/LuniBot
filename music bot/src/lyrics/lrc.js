/**
 * Music Bot — src/lyrics/lrc.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
const STAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const WORD_STAMP = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;

function fractionToMs(frac) {
  if (!frac) return 0;
  if (frac.length === 1) return Number(frac) * 100;
  if (frac.length === 2) return Number(frac) * 10;
  return Number(frac.slice(0, 3));
}

/**
 * Parse LRC into sorted `[{ timeMs, text }]`. Handles several stamps on one line,
 * `[offset:±ms]`, enhanced (word-level) stamps and metadata tags like `[ar:…]`.
 */
export function parseLrc(lrc) {
  if (!lrc) return [];
  let offsetMs = 0;
  const lines = [];
  for (const raw of String(lrc).split(/\r?\n/)) {
    const offset = raw.match(/^\[offset:\s*([+-]?\d+)\s*\]/i);
    if (offset) {
      offsetMs = Number(offset[1]);
      continue;
    }
    const stamps = [...raw.matchAll(STAMP)];
    if (stamps.length === 0) continue;
    const text = raw.replace(STAMP, '').replace(WORD_STAMP, '').trim();
    for (const s of stamps) {
      const timeMs = Number(s[1]) * 60_000 + Number(s[2]) * 1000 + fractionToMs(s[3]);
      lines.push({ timeMs, text });
    }
  }
  // A positive LRC offset means "show lyrics earlier".
  return lines
    .map((l) => ({ timeMs: Math.max(0, l.timeMs - offsetMs), text: l.text }))
    .sort((a, b) => a.timeMs - b.timeMs);
}

/** Index of the line active at `ms` (-1 before the first line). Binary search. */
export function lineAt(synced, ms) {
  let lo = 0;
  let hi = synced.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (synced[mid].timeMs <= ms) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function syncedToPlain(synced) {
  return synced.map((l) => l.text).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
