/**
 * Music Bot — src/logger.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import pino from 'pino';
import { config } from './config.js';

// Structured JSON logs on stdout. Pipe through `pino-pretty` locally if you want colours.
export const logger = pino({
  level: config.logLevel,
  base: { app: 'music-bot' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['token', '*.token', 'authorization', '*.authorization'],
});
