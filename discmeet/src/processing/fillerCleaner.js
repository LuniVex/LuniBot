/**
 * DiscMeet — src/processing/fillerCleaner.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * Filler word cleaner.
 *
 * Intelligently removes common filler words from transcribed text and
 * replaces them with "..." where a pause is semantically appropriate.
 *
 * Handles edge cases:
 *   - "like" as a verb ("I like pizza") is preserved
 *   - "so" as a conjunction introducing a result ("so we decided") is preserved
 *   - "actually" / "basically" at sentence start are removed cleanly
 *   - Mid-sentence fillers become "..." to indicate a natural pause
 */

/**
 * List of filler words/phrases to detect.
 * Order matters — longer phrases are checked first to avoid partial matches.
 */
const FILLER_PHRASES = [
  'you know what I mean',
  'you know what',
  'I mean like',
  'kind of like',
  'sort of like',
  'you know',
  'I mean',
  'kind of',
  'sort of',
  'basically',
  'actually',
  'honestly',
  'literally',
  'obviously',
  'like',
  'right',
  'so',
  'um',
  'uh',
  'er',
  'ah',
  'hmm',
];

/**
 * Words that look like fillers but shouldn't be removed in certain contexts.
 * Maps word → regex pattern where the word should be PRESERVED.
 */
const PRESERVE_PATTERNS = {
  // "like" as a verb: "I like", "would like", "don't like", "looks like", etc.
  like: /(?:(?:would|do|don't|doesn't|didn't|will|can|could|should|might|must|to|really|also|I|we|they|he|she|you|it)\s+like|like\s+(?:a|an|the|this|that|it|them|him|her|us|me|my|your|his|its|our|their|to|when|how|where)\b|looks?\s+like|feels?\s+like|seems?\s+like|sounds?\s+like|tastes?\s+like)/i,

  // "so" introducing a result/consequence: "so we", "so I", "so that", "so the"
  so: /(?:^|\.\s+)so\s+(?:we|I|he|she|they|it|the|that|this|there|what|when|if|let)/i,

  // "right" as an adjective/direction or confirmation question
  right: /(?:(?:the|a|that's|is|are|was|were)\s+right|right\s+(?:now|here|there|away|side|hand|turn|thing|answer|direction|place)|right[\?\.])/i,
};

/**
 * Brand name corrections applied after filler cleaning.
 * Maps exact match or regex variation to the correct brand name.
 */
const BRAND_CORRECTIONS = [
  { pattern: /lunivex|lunar\s+vex|loony\s*vex|loony\s*verse|blue\s*leaf\s*vex/gi, replacement: 'LuniVex' },
  { pattern: /vespa|vespay|vest\s*but/gi, replacement: 'Vesper' }
];

/**
 * Clean filler words from a single sentence.
 *
 * @param {string} sentence - The sentence to clean
 * @returns {string} Cleaned sentence
 */
function cleanSentence(sentence) {
  if (!sentence || sentence.trim().length === 0) {
    return sentence;
  }

  let result = sentence;

  for (const filler of FILLER_PHRASES) {
    // Check if this filler should be preserved in this context
    const preservePattern = PRESERVE_PATTERNS[filler.toLowerCase()];
    if (preservePattern && preservePattern.test(result)) {
      continue;
    }

    // Build a regex that matches the filler as a whole word
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fillerRegex = new RegExp(
      `(?:^|(?<=\\s))${escaped}(?:,?\\s*)?(?=$|\\s)`,
      'gi'
    );

    // Check if filler appears at the start, middle, or end
    const startsWithFiller = new RegExp(`^\\s*${escaped}[,\\s]+`, 'i');
    const endsWithFiller = new RegExp(`[,\\s]+${escaped}\\s*[.!?]?\\s*$`, 'i');
    const midFiller = new RegExp(`(\\w+[,\\s]+)${escaped}([,\\s]+\\w+)`, 'gi');

    // At sentence start: remove cleanly
    if (startsWithFiller.test(result)) {
      result = result.replace(startsWithFiller, '');
    }
    // At sentence end: remove cleanly
    else if (endsWithFiller.test(result)) {
      result = result.replace(endsWithFiller, (match) => {
        // Keep trailing punctuation
        const punctuation = match.match(/[.!?]+\s*$/);
        return punctuation ? punctuation[0] : '';
      });
    }
    // Mid-sentence: replace with ellipsis to indicate a pause
    else if (midFiller.test(result)) {
      result = result.replace(midFiller, '$1...$2');
    }
  }

  // Clean up artifacts
  result = result
    // Collapse multiple ellipses
    .replace(/\.{3,}\s*\.{3,}/g, '...')
    // Remove double spaces
    .replace(/\s{2,}/g, ' ')
    // Remove space before punctuation
    .replace(/\s+([.!?,])/g, '$1')
    // Capitalise first letter after cleanup
    .replace(/^\s*([a-z])/, (_, c) => c.toUpperCase())
    .trim();

  // Apply brand corrections
  for (const { pattern, replacement } of BRAND_CORRECTIONS) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Clean filler words from an entire transcript.
 *
 * Processes each line of the transcript independently, preserving
 * the [Timestamp] Speaker: "text" format.
 *
 * @param {string} transcript - The full timed transcript
 * @returns {string} Cleaned transcript
 */
function cleanTranscript(transcript) {
  if (!transcript) return transcript;

  return transcript
    .split('\n')
    .map((line) => {
      // Match the transcript format: [MM:SS] Speaker: "text"
      const match = line.match(/^(\[[\d:]+\]\s+\w[\w\s]*?:\s*)"(.*)"$/);
      if (match) {
        const prefix = match[1]; // [01:23] Alice:
        const text = match[2]; // The spoken text
        const cleaned = cleanSentence(text);
        return `${prefix}"${cleaned}"`;
      }

      // If it doesn't match the expected format, clean the whole line
      return cleanSentence(line);
    })
    .join('\n');
}

module.exports = { cleanSentence, cleanTranscript, FILLER_PHRASES };
