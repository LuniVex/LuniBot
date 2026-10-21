const { ChannelType } = require('discord.js');
const { syncDelete } = require('../handlers/messageBridge');
const config = require('../config');

module.exports = {
  name: 'messageDelete',

  async execute(message) {
    // Ignore bots
    if (message.author?.bot) return;

    if (message.channel.type === ChannelType.DM) {
      // User deleted a DM → delete the ticket channel copy
      await syncDelete(message.id, 'dm', message.client);
    } else if (message.channel.parentId === config.staffCategoryId) {
      // Staff deleted a message → delete the DM copy
      await syncDelete(message.id, 'channel', message.client);
    }
  },
};
