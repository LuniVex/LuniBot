/**
 * DiscMeet — src/utils/logger.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * Simple coloured console logger with level prefixes.
 * Uses ANSI escape codes — works in all modern terminals.
 */

const COLOURS = {
  reset: '\x1b[0m',
  grey: '\x1b[90m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function timestamp() {
  return COLOURS.grey + new Date().toLocaleTimeString() + COLOURS.reset;
}

const logger = {
  info(...args) {
    console.log(timestamp(), `${COLOURS.cyan}[INFO]${COLOURS.reset}`, ...args);
  },

  success(...args) {
    console.log(timestamp(), `${COLOURS.green}[OK]${COLOURS.reset}`, ...args);
  },

  warn(...args) {
    console.warn(timestamp(), `${COLOURS.yellow}[WARN]${COLOURS.reset}`, ...args);
  },

  error(...args) {
    console.error(timestamp(), `${COLOURS.red}[ERROR]${COLOURS.reset}`, ...args);
  },

  debug(...args) {
    if (process.env.DEBUG) {
      console.log(timestamp(), `${COLOURS.magenta}[DEBUG]${COLOURS.reset}`, ...args);
    }
  },

  /** Log a section header */
  section(title) {
    const line = '─'.repeat(50);
    console.log(`\n${COLOURS.cyan}${line}\n  ${title}\n${line}${COLOURS.reset}\n`);
  },
};

module.exports = logger;
