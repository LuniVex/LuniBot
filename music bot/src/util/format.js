/**
 * Music Bot — src/util/format.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
export function formatDuration(totalSec) {
  if (totalSec == null || !Number.isFinite(totalSec)) return '?:??';
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function progressBar(positionSec, durationSec, size = 16) {
  if (!durationSec || durationSec <= 0) return '🔴 LIVE';
  const ratio = Math.min(1, Math.max(0, positionSec / durationSec));
  const knob = Math.min(size - 1, Math.round(ratio * (size - 1)));
  const bar = '▬'.repeat(knob) + '🔘' + '▬'.repeat(size - 1 - knob);
  return `${bar} \`${formatDuration(positionSec)} / ${formatDuration(durationSec)}\``;
}

export function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Escape characters that would break a markdown link label. */
export function escapeMd(text) {
  return String(text ?? '').replace(/([\\*_`~|[\]()>])/g, '\\$1');
}

export function trackLabel(track, max = 80) {
  const base = track.artist && !track.title.toLowerCase().includes(track.artist.toLowerCase())
    ? `${track.artist} — ${track.title}`
    : track.title;
  return truncate(base, max);
}
