/**
 * Maps a 1-based ticket count to a letter suffix.
 *   1 → 'a', 2 → 'b', ..., 26 → 'z', 27 → 'aa', 28 → 'ab', ...
 */
function countToLetter(n) {
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(97 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

module.exports = { countToLetter };
