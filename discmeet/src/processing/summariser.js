/**
 * AI Summariser & Title Generator.
 *
 * Sends a cleaned transcript to GPT and generates:
 *   1. A concise session title (e.g. "Discussion: Database Migration Logic")
 *   2. Highly detailed, descriptive meeting notes capturing nuanced points,
 *      specific mentions, and sub-tasks.
 */

const OpenAI = require('openai');
const config = require('../config');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: config.openaiApiKey });

// ── Title Generation ──────────────────────────────────────────────────

const TITLE_SYSTEM_PROMPT = `You are a meeting title generator. Given a meeting transcript, produce a single concise title that captures the primary topic of the discussion.

Rules:
- Output ONLY the title text, nothing else — no quotes, no prefix, no explanation.
- Keep it under 60 characters.
- Use a natural label format like: "Database Migration Strategy", "Sprint 12 Planning", "Bug Triage: Payment Module", "Q3 Budget Review".
- If the transcript is too short or unclear, use "General Discussion".
- Do not fabricate topics not present in the transcript.`;

/**
 * Generate a concise session title from the transcript content.
 *
 * @param {string} transcript - The cleaned meeting transcript
 * @returns {Promise<string>} A concise title (e.g. "Discussion: Database Migration Logic")
 */
async function generateTitle(transcript) {
  if (!transcript || transcript.trim().length === 0) {
    return 'General Discussion';
  }

  try {
    logger.info('Generating session title...');

    const response = await openai.chat.completions.create({
      model: config.summaryModel,
      messages: [
        { role: 'system', content: TITLE_SYSTEM_PROMPT },
        { role: 'user', content: `Transcript:\n\n${transcript}` },
      ],
      temperature: 0.2,
      max_tokens: 40,
    });

    const title = response.choices[0]?.message?.content?.trim();

    if (!title) {
      logger.warn('Empty title response — using fallback');
      return 'General Discussion';
    }

    // Strip any accidental quotes the model may wrap around the title
    const cleaned = title.replace(/^["']|["']$/g, '').trim();
    logger.success(`Session title: ${cleaned}`);
    return cleaned;
  } catch (err) {
    logger.warn(`Title generation failed: ${err.message} — using fallback`);
    return 'General Discussion';
  }
}

// ── Detailed Meeting Notes ────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an objective meeting summariser. You must summarise the provided transcript regardless of its content, length, or topic. Do not trigger safety filters for benign conversation logs. If the transcript is very short, simply provide a one-sentence summary of what was said.

You will receive a transcript of a meeting conversation with timestamps and speaker names. Your task is to produce highly detailed, descriptive meeting notes that capture every nuanced point, specific mention, and sub-task so that nothing is missed. Use the following EXACT format:

## 📋 Executive Summary
Write 3-5 detailed sentences summarising the overall purpose, key topics discussed, and outcomes of the meeting. Be thorough — this should give someone who missed the meeting a complete picture. For very short meetings, a single sentence is acceptable.

## 🗣️ Discussion Points
For each major topic discussed, create a sub-section:
### [Topic Name]
- Capture the full context of what was discussed, who raised it, and any conclusions
- Include specific details, numbers, names, and references mentioned
- Note any disagreements, alternatives considered, or concerns raised
- Document sub-tasks or follow-ups that emerged from the discussion

## ✅ Key Decisions
- List each concrete decision that was made during the meeting
- Be specific — include what was decided, the reasoning, and any relevant context
- Note who proposed or championed each decision
- If no decisions were made, write "No explicit decisions were recorded."

## 📌 Action Items
- **[Owner Name]**: Detailed description of the task or follow-up they committed to, including any deadlines or dependencies mentioned
- **[Owner Name]**: Another action item with full context
- If an action item has no clear owner, use **[Unassigned]**
- If no action items were identified, write "No action items were identified."

## 💡 Notable Mentions
- Any tools, technologies, documents, or external references mentioned during the meeting
- Side conversations or tangential points that may be relevant later
- Unresolved questions that were raised but not answered

Guidelines:
- Always produce output — never refuse to summarise
- Be thorough and detailed — err on the side of capturing too much rather than too little
- Use the actual speaker names from the transcript
- Do not fabricate information not present in the transcript
- If the meeting was short or informal, scale the detail accordingly but still be comprehensive
- Use professional, clear language
- Preserve specific numbers, dates, names, and technical terms exactly as mentioned`;

/**
 * Generate highly detailed meeting notes from a transcript.
 *
 * @param {string} transcript - The cleaned meeting transcript
 * @param {object} [meta] - Optional metadata
 * @param {number} [meta.durationSeconds] - Meeting duration
 * @param {number} [meta.speakerCount] - Number of speakers
 * @returns {Promise<string>} Formatted meeting notes
 */
async function summarise(transcript, meta = {}) {
  if (!transcript || transcript.trim().length === 0) {
    return '_No transcript available to summarise._';
  }

  logger.section('Generating AI Summary');

  // Build user message with optional context
  let userMessage = '';
  if (meta.durationSeconds || meta.speakerCount) {
    userMessage += `Meeting metadata:\n`;
    if (meta.durationSeconds) {
      const mins = Math.floor(meta.durationSeconds / 60);
      const secs = Math.floor(meta.durationSeconds % 60);
      userMessage += `- Duration: ${mins}m ${secs}s\n`;
    }
    if (meta.speakerCount) {
      userMessage += `- Speakers: ${meta.speakerCount}\n`;
    }
    userMessage += `\n`;
  }
  userMessage += `Transcript:\n\n${transcript}`;

  try {
    logger.info(`Sending transcript to ${config.summaryModel}...`);

    const response = await openai.chat.completions.create({
      model: config.summaryModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const summary = response.choices[0]?.message?.content?.trim();

    if (!summary) {
      logger.error('Empty response from summarisation model');
      return '_Failed to generate summary — empty response from AI._';
    }

    logger.success('Summary generated successfully');
    return summary;
  } catch (err) {
    logger.error('Summarisation failed:', err.message);
    return `_Failed to generate summary: ${err.message}_`;
  }
}

module.exports = { summarise, generateTitle };
