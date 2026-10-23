# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim

# ffmpeg for decoding/encoding, Python for yt-dlp, tini for proper signal handling.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    YTDLP_INSTALL_MODE=venv \
    DATA_DIR=/app/data \
    DATABASE_PATH=/app/data/bot.sqlite \
    HEALTH_PORT=8080

WORKDIR /app
RUN chown node:node /app
USER node

# Install scripts are skipped: better-sqlite3 and the DAVE (E2EE) library ship prebuilt
# binaries, and ffmpeg comes from apt instead of ffmpeg-static.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# yt-dlp lives in a venv owned by the app user so it can upgrade itself on every start.
RUN python3 -m venv /app/.venv-ytdlp \
 && /app/.venv-ytdlp/bin/pip install --no-cache-dir -q -U --pre "yt-dlp[default,curl-cffi]"

COPY --chown=node:node config.json ./
COPY --chown=node:node src ./src
RUN mkdir -p /app/data

VOLUME ["/app/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.HEALTH_PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/index.js"]
