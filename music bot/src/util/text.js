/**
 * Music Bot — src/util/text.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'of', 'feat', 'ft', 'featuring', 'with', 'x', 'vs']);

export function normalize(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function tokens(text) {
  return normalize(text).split(' ').filter((t) => t && !STOPWORDS.has(t));
}

/** Fraction of `needle`'s tokens that appear in `haystack` (0..1). */
export function coverage(needle, haystack) {
  const want = tokens(needle);
  if (want.length === 0) return 0;
  const have = new Set(tokens(haystack));
  return want.filter((t) => have.has(t)).length / want.length;
}

export function isUrl(text) {
  return /^https?:\/\/\S+$/i.test(String(text ?? '').trim());
}
