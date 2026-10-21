/**
 * Modmail — src/handlers/permissions.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const db = require('../database/db');
const { getStaffRoleId } = require('../utils/configHelper');

/**
 * Checks whether a guild member has permission to run a command.
 * Priority: guild owner → staff role → per-user override → per-role override → deny.
 */
function hasPermission(member, commandName) {
  // Guild owner always has permission
  if (member.guild && member.id === member.guild.ownerId) return true;

  // Staff role grants access to all modmail commands
  const staffRoleId = getStaffRoleId();
  if (staffRoleId && member.roles?.cache?.has(staffRoleId)) return true;

  // Check per-user override
  const userPerm = db
    .prepare(
      'SELECT allowed FROM permissions WHERE command_name = ? AND target_type = ? AND target_id = ?'
    )
    .get(commandName, 'user', member.id);

  if (userPerm) return Boolean(userPerm.allowed);

  // Check per-role overrides (any matching role wins)
  if (member.roles?.cache) {
    for (const [roleId] of member.roles.cache) {
      const rolePerm = db
        .prepare(
          'SELECT allowed FROM permissions WHERE command_name = ? AND target_type = ? AND target_id = ?'
        )
        .get(commandName, 'role', roleId);

      if (rolePerm) return Boolean(rolePerm.allowed);
    }
  }

  return false;
}

function addPermission(commandName, targetType, targetId, allowed = true) {
  db.prepare(
    'INSERT OR REPLACE INTO permissions (command_name, target_type, target_id, allowed) VALUES (?, ?, ?, ?)'
  ).run(commandName, targetType, targetId, allowed ? 1 : 0);
}

function removePermission(commandName, targetType, targetId) {
  db.prepare(
    'DELETE FROM permissions WHERE command_name = ? AND target_type = ? AND target_id = ?'
  ).run(commandName, targetType, targetId);
}

function listPermissions(commandName) {
  return db
    .prepare('SELECT * FROM permissions WHERE command_name = ?')
    .all(commandName);
}

module.exports = { hasPermission, addPermission, removePermission, listPermissions };
