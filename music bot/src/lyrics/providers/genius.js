/**
 * Music Bot — src/lyrics/providers/genius.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { config } from '../../config.js';
import { cleanTitle, primaryArtist } from '../match.js';
import { makeHttp } from './http.js';

const request = makeHttp('Genius', { capacity: 10, perSeconds: 10 });
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** [innerStart, innerEnd, outerStart, outerEnd] of every <div> carrying `marker`, nesting-aware. */
function divBlocks(html, marker) {
  const blocks = [];
  let from = 0;
  for (;;) {
    const at = html.indexOf(marker, from);
    if (at === -1) break;
    const outerStart = html.lastIndexOf('<div', at);
    const innerStart = html.indexOf('>', at) + 1;
    const tag = /<(\/?)div\b[^>]*>/gi;
    tag.lastIndex = innerStart;
    let depth = 1;
    let m;
    while (depth > 0 && (m = tag.exec(html))) depth += m[1] ? -1 : 1;
    if (!m) break; // unbalanced markup: stop rather than guess
    blocks.push([innerStart, m.index, outerStart, tag.lastIndex]);
    from = tag.lastIndex;
  }
  return blocks;
}

/** Pull the lyrics out of a Genius song page (`data-lyrics-container` blocks). Exported for tests. */
export function extractGeniusLyrics(html) {
  const parts = divBlocks(html, 'data-lyrics-container="true"').map(([s, e]) => {
    let block = html.slice(s, e);
    // Header widgets (contributors, "Read More" blurb) are flagged for exclusion.
    for (const [, , os, oe] of divBlocks(block, 'data-exclude-from-selection="true"').reverse()) {
      block = block.slice(0, os) + block.slice(oe);
    }
    return block;
  });
  const text = parts.join('\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text).replace(/\n{3,}/g, '\n\n').trim();
}

function toCandidate(r) {
  return {
    title: r.title,
    artist: r.primary_artist?.name ?? r.artist_names,
    durationSec: null,
    instrumental: Boolean(r.instrumental),
    url: r.url,
    load: async () => {
      const html = await request(r.url, { as: 'text', headers: { 'User-Agent': BROWSER_UA } });
      return { plain: html ? extractGeniusLyrics(html) : null };
    },
  };
}

async function apiSearch(q) {
  const body = await request(`https://api.genius.com/search?${new URLSearchParams({ q })}`, {
    headers: { Authorization: `Bearer ${config.lyrics.geniusToken}` },
  });
  return (body?.response?.hits ?? []).filter((h) => h.type === 'song').map((h) => toCandidate(h.result)).slice(0, 8);
}

/**
 * Genius (GENIUS_ACCESS_TOKEN). The API finds the song; the lyrics come from its public
 * page. Plain lyrics only — Genius has no timing.
 */
export const genius = {
  id: 'genius',
  name: 'Genius',
  needsKey: true,
  canSync: false,
  enabled: () => Boolean(config.lyrics.geniusToken),

  async find(metas) {
    const m = metas[0];
    return apiSearch(`${primaryArtist(m.artist)} ${cleanTitle(m.title)}`.trim());
  },

  async search(query) {
    return apiSearch(query);
  },
};
