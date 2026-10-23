/**
 * Music Bot — src/util/errors.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
/**
 * An error that is safe to show to a Discord user. `message` is the user-facing
 * explanation; `hint` is a concrete next step ("how to fix it").
 */
export class UserError extends Error {
  constructor(message, { hint = null, code = 'USER_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'UserError';
    this.hint = hint;
    this.code = code;
  }
}

export function toUserError(err, fallback = 'Something went wrong while handling that.') {
  if (err instanceof UserError) return err;
  return new UserError(fallback, { hint: 'Try again in a moment. If it keeps happening, tell the bot owner.', code: 'INTERNAL', cause: err });
}

export function formatUserError(err) {
  const e = toUserError(err);
  return e.hint ? `❌ ${e.message}\n💡 ${e.hint}` : `❌ ${e.message}`;
}
