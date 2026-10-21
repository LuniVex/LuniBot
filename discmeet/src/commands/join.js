/**
 * /join — Join the user's voice channel and start recording.
 *
 * Side-effects on join:
 *   - Sets bot presence to "Listening & summarising"
 *   - Sets voice channel status to "🔴 Recording"
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { join } = require('../voice/connection');
const Recorder = require('../voice/recorder');
const MeetingSession = require('../voice/session');
const { setRecordingPresence, setVoiceChannelStatus } = require('../utils/presence');
const { clearCache } = require('../utils/sessionCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your voice channel and start recording the meeting'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {{ activeSessions: Map, client: import('discord.js').Client }} context
   */
  async execute(interaction, { activeSessions, client }) {
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ You must be in a voice channel first!',
        ephemeral: true,
      });
    }

    if (activeSessions.has(interaction.guildId)) {
      return interaction.reply({
        content: '⚠️ A recording session is already active. Use `/summarize` to end it first.',
        ephemeral: true,
      });
    }

    await interaction.reply('🎙️ Joining voice channel and starting recording...');

    // Clear previous session cache
    clearCache();

    // Join the voice channel
    const connection = await join(voiceChannel);

    // Create a new meeting session
    const session = new MeetingSession(
      interaction.guildId,
      voiceChannel.id,
      interaction.channelId
    );

    // Create the recorder
    const recorder = new Recorder(connection, session, client);

    // Store the active session
    activeSessions.set(interaction.guildId, { session, recorder, connection });

    // ── Update presence & voice channel status ──
    setRecordingPresence(client);
    await setVoiceChannelStatus(client, voiceChannel.id, '🔴 Recording');

    // Build a rich embed for the start notification
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🎙️ Meeting Recording Started')
      .setDescription(`Recording in **${voiceChannel.name}**`)
      .addFields(
        { name: 'Channel', value: `<#${voiceChannel.id}>`, inline: true },
        { name: 'Started By', value: interaction.user.toString(), inline: true },
        {
          name: 'Commands',
          value:
            '`/summarize` — End & generate notes\n`/status` — Check session\n`/leave` — Cancel & leave',
          inline: false,
        }
      )
      .setFooter({ text: "DiscMeet • Speak naturally — I'm listening!" })
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};
