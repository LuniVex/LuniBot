/**
 * Modmail — src/events/messageUpdate.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const { ChannelType } = require('discord.js');
const { syncEdit } = require('../handlers/messageBridge');
const config = require('../config');

module.exports = {
  name: 'messageUpdate',

  async execute(oldMessage, newMessage) {
    // Ignore bots and no-change edits
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    // Fetch partial messages if needed
    if (newMessage.partial) {
      try {
        await newMessage.fetch();
      } catch {
        return;
      }
    }

    if (newMessage.channel.type === ChannelType.DM) {
      // User edited a DM → sync to the ticket channel
      await syncEdit(newMessage.id, newMessage.content, 'dm', newMessage.client);
    } else if (newMessage.channel.parentId === config.staffCategoryId) {
      // Staff edited a message → sync to the user's DM
      await syncEdit(
        newMessage.id,
        newMessage.content,
        'channel',
        newMessage.client
      );
    }
  },
};
