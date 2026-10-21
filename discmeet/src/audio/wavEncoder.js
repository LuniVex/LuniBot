/**
 * Pure-JavaScript WAV encoder.
 * Wraps raw PCM audio data with a valid RIFF/WAV header.
 *
 * No external dependencies — just Buffer manipulation.
 */

/**
 * Encode raw PCM data into a WAV file buffer.
 *
 * @param {Buffer} pcmData - Raw PCM audio data (signed 16-bit little-endian)
 * @param {object} [options]
 * @param {number} [options.sampleRate=48000]  - Sample rate in Hz
 * @param {number} [options.channels=2]        - Number of audio channels (1=mono, 2=stereo)
 * @param {number} [options.bitDepth=16]       - Bits per sample
 * @returns {Buffer} Complete WAV file buffer
 */
function encodeWav(pcmData, options = {}) {
  const sampleRate = options.sampleRate || 48000;
  const channels = options.channels || 2;
  const bitDepth = options.bitDepth || 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;

  // WAV header is always 44 bytes
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // ── RIFF chunk descriptor ──
  buffer.write('RIFF', 0);                          // ChunkID
  buffer.writeUInt32LE(36 + dataSize, 4);            // ChunkSize (file size - 8)
  buffer.write('WAVE', 8);                           // Format

  // ── "fmt " sub-chunk ──
  buffer.write('fmt ', 12);                          // Subchunk1ID
  buffer.writeUInt32LE(16, 16);                      // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);                       // AudioFormat (1 = PCM, no compression)
  buffer.writeUInt16LE(channels, 22);                // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);              // SampleRate
  buffer.writeUInt32LE(byteRate, 28);                // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);              // BlockAlign
  buffer.writeUInt16LE(bitDepth, 34);                // BitsPerSample

  // ── "data" sub-chunk ──
  buffer.write('data', 36);                          // Subchunk2ID
  buffer.writeUInt32LE(dataSize, 40);                // Subchunk2Size

  // ── PCM data ──
  pcmData.copy(buffer, headerSize);

  return buffer;
}

/**
 * Calculate the duration of PCM audio data in seconds.
 *
 * @param {Buffer} pcmData
 * @param {object} [options]
 * @param {number} [options.sampleRate=48000]
 * @param {number} [options.channels=2]
 * @param {number} [options.bitDepth=16]
 * @returns {number} Duration in seconds
 */
function pcmDuration(pcmData, options = {}) {
  const sampleRate = options.sampleRate || 48000;
  const channels = options.channels || 2;
  const bitDepth = options.bitDepth || 16;
  const bytesPerSample = bitDepth / 8;
  const bytesPerSecond = sampleRate * channels * bytesPerSample;
  return pcmData.length / bytesPerSecond;
}

module.exports = { encodeWav, pcmDuration };
