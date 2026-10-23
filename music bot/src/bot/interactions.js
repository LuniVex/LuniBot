/**
 * Music Bot — src/bot/interactions.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { MessageFlags } from 'discord.js';
import { logger } from '../logger.js';
import { formatUserError, UserError } from '../util/errors.js';
import { escapeMd, trackLabel } from '../util/format.js';
import { ID } from '../ui/nowPlaying.js';
import { addModal, emptyQueueView, PICK_PREFIX, QID, queueView } from '../ui/views.js';
import { autocomplete, commandHandlers, runPlay } from './commands.js';
import { checkTextChannel, requireControl, requireSameVoice, requireVoice } from './permissions.js';
import { handleLyricsCardButton, handleLyricsView } from './lyrics.js';
import { enqueueResolved, pendingPicks } from './play.js';

const EPHEMERAL = MessageFlags.Ephemeral;
const log = logger.child({ mod: 'interactions' });

async function replyError(interaction, err) {
  if (!(err instanceof UserError)) log.error({ err, id: interaction.customId ?? interaction.commandName }, 'interaction failed');
  if (interaction.isAutocomplete()) {
    if (!interaction.responded) await interaction.respond([]).catch(() => {});
    return;
  }
  const payload = { content: formatUserError(err), flags: EPHEMERAL };
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch (e) {
    log.warn({ err: e.message }, 'could not deliver error reply');
  }
}

/** Buttons and selects on the now-playing card. */
async function handleControl(interaction, ctx) {
  const id = interaction.customId;
  const player = ctx.manager.get(interaction.guildId);
  const member = interaction.member;

  if (id === ID.add) {
    checkTextChannel(interaction.channelId);
    await interaction.showModal(addModal());
    return;
  }
  if (!player) {
    // A card left over from a previous session: close it instead of leaving dead buttons.
    await interaction.update({ components: [] }).catch(() => {});
    await interaction.followUp({ content: '💤 Nothing is playing. Start something with `/play`.', flags: EPHEMERAL });
    return;
  }
  if (id === ID.queue) {
    const view = player.current || player.queue.length ? queueView(player, 0) : emptyQueueView();
    await interaction.reply({ ...view, flags: EPHEMERAL, allowedMentions: { parse: [] } });
    return;
  }
  // Lyrics only change what the card shows, so they're open to every listener (no DJ check).
  if (id.startsWith('mb:lyr')) {
    await handleLyricsCardButton(interaction, ctx, player);
    return;
  }

  requireSameVoice(member, player);
  const requesterOk = id === ID.toggle || id === ID.skip;
  requireControl(member, player, { allowRequester: requesterOk });
  await interaction.deferUpdate();

  switch (id) {
    case ID.toggle:
      player.togglePause();
      break;
    case ID.skip:
      await player.skip();
      break;
    case ID.previous:
      await player.previous();
      break;
    case ID.stop:
      await player.stop({ by: member.displayName });
      break;
    case ID.shuffle: {
      const n = player.shuffle();
      if (n < 2) throw new UserError('Add at least two songs to the queue to shuffle.', { code: 'NOTHING_TO_SHUFFLE' });
      break;
    }
    case ID.loop:
      player.cycleLoop();
      break;
    case ID.volume:
      await player.setVolume(Number(interaction.values[0]));
      break;
    case ID.filters:
      await player.setFilters(interaction.values);
      break;
    default:
      throw new UserError('That control is not available any more.', { code: 'UNKNOWN_CONTROL' });
  }
}

/** Buttons on the ephemeral /queue view. */
async function handleQueueView(interaction, ctx) {
  const player = ctx.manager.get(interaction.guildId);
  if (!player) {
    await interaction.update(emptyQueueView());
    return;
  }
  const id = interaction.customId;
  if (id.startsWith(QID.page)) {
    await interaction.update({ ...queueView(player, Number(id.slice(QID.page.length)) || 0), allowedMentions: { parse: [] } });
    return;
  }
  requireSameVoice(interaction.member, player);
  requireControl(interaction.member, player);
  if (id === QID.shuffle) player.shuffle();
  else if (id === QID.clear) player.clearQueue();
  await interaction.update({ ...queueView(player, 0), allowedMentions: { parse: [] } });
}

/** The search-result picker. */
async function handlePick(interaction, ctx) {
  const token = interaction.customId.slice(PICK_PREFIX.length);
  const pick = pendingPicks.get(token);
  if (!pick) {
    await interaction.update({ content: '⌛ This picker expired. Run `/play` again.', components: [] });
    return;
  }
  if (interaction.user.id !== pick.userId) {
    throw new UserError('This picker belongs to someone else.', { hint: 'Use `/play` to search yourself.', code: 'NOT_YOUR_PICKER' });
  }
  const chosen = pick.choices[Number(interaction.values[0])];
  if (!chosen) throw new UserError('That choice is no longer available.', { code: 'BAD_PICK' });

  const voiceChannel = requireVoice(interaction.member, ctx.manager.get(interaction.guildId));
  pendingPicks.delete(token);
  await interaction.update({ content: `✅ Picked **${escapeMd(trackLabel(chosen, 90))}**`, components: [] });
  const content = await enqueueResolved({
    manager: ctx.manager,
    guild: interaction.guild,
    voiceChannel,
    textChannelId: pick.textChannelId,
    tracks: [chosen],
    next: pick.next,
  });
  if (pick.lyrics) ctx.manager.get(interaction.guildId)?.setLyricsLive(true, interaction.user.id);
  await interaction.followUp({ content: `${content} — requested by <@${interaction.user.id}>`, allowedMentions: { parse: [] } });
}

export function createInteractionHandler(ctx) {
  return async (interaction) => {
    try {
      if (interaction.isAutocomplete()) {
        await autocomplete(interaction, ctx);
        return;
      }
      if (!interaction.inCachedGuild()) {
        if (interaction.isRepliable()) await interaction.reply({ content: 'I only work inside servers.', flags: EPHEMERAL });
        return;
      }
      if (interaction.isChatInputCommand()) {
        const handler = commandHandlers[interaction.commandName];
        if (handler) await handler(interaction, ctx);
        return;
      }
      if (interaction.isModalSubmit() && interaction.customId === ID.addModal) {
        await runPlay(interaction, ctx, { query: interaction.fields.getTextInputValue('query') });
        return;
      }
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const id = interaction.customId;
        if (id.startsWith('mb:')) await handleControl(interaction, ctx);
        else if (id.startsWith('mbq:')) await handleQueueView(interaction, ctx);
        else if (id.startsWith(PICK_PREFIX)) await handlePick(interaction, ctx);
        else if (id.startsWith('mbl:')) await handleLyricsView(interaction, ctx);
      }
    } catch (err) {
      await replyError(interaction, err);
    }
  };
}
