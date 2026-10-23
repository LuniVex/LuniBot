/**
 * Music Bot — src/bot/messageTrigger.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { logger } from '../logger.js';
import { formatUserError, UserError } from '../util/errors.js';
import { playRequest } from './play.js';

const log = logger.child({ mod: 'message-trigger' });

function deleteLater(message, ms) {
  if (message) setTimeout(() => message.delete().catch(() => {}), ms).unref();
}

/** Plain messages in a guild's configured music channel are treated as /play requests. */
export function createMessageHandler(ctx) {
  return async (message) => {
    if (!message.inGuild() || message.author.bot || message.system) return;
    const { musicChannelId } = ctx.store.getSettings(message.guildId);
    if (!musicChannelId || message.channelId !== musicChannelId) return;
    const query = message.content.trim();
    // Lines starting with "//" are chat, not requests.
    if (!query || query.startsWith('//')) return;

    try {
      const member = message.member ?? await message.guild.members.fetch(message.author.id);
      await message.channel.sendTyping().catch(() => {});
      const result = await playRequest({
        manager: ctx.manager,
        guild: message.guild,
        member,
        textChannelId: message.channelId,
        query,
      });
      if (result.picker) {
        const reply = await message.reply({ ...result.picker, allowedMentions: { repliedUser: false } });
        deleteLater(reply, 120_000);
        return;
      }
      await message.react('✅').catch(() => {});
      const reply = await message.reply({ content: result.content, allowedMentions: { parse: [], repliedUser: false } });
      deleteLater(reply, 15_000);
    } catch (err) {
      if (!(err instanceof UserError)) log.error({ err }, 'message request failed');
      const reply = await message.reply({ content: formatUserError(err), allowedMentions: { repliedUser: false } }).catch(() => null);
      deleteLater(reply, 20_000);
    }
  };
}
