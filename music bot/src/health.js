/**
 * Music Bot — src/health.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import http from 'node:http';
import { logger } from './logger.js';

const log = logger.child({ mod: 'health' });

/**
 * GET /healthz → 200 when the gateway is connected and the bot isn't shutting down,
 * 503 otherwise. The JSON body has enough detail for a dashboard or a quick curl.
 */
export function startHealthServer(port, getStatus) {
  const server = http.createServer((req, res) => {
    const pathname = (req.url ?? '/').split('?')[0];
    if (req.method !== 'GET' || !['/healthz', '/health', '/'].includes(pathname)) {
      res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"not found"}');
      return;
    }
    let status;
    try {
      status = getStatus();
    } catch (err) {
      status = { ok: false, error: err.message };
    }
    res.writeHead(status.ok ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(status));
  });
  server.on('error', (err) => log.error({ err: err.message, port }, 'health server error'));
  server.listen(port, () => log.info({ port }, 'health endpoint listening on /healthz'));
  return server;
}
