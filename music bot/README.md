# Music Bot

*Part of [LuniBot](https://github.com/LuniVex/lunibot), created by LuniVex. New here? Start with [SETUP.txt](SETUP.txt).*

A self-hosted Discord music bot built on **yt-dlp + @discordjs/voice + FFmpeg**. It plays YouTube, YouTube Music, SoundCloud, Bandcamp, Twitch, archive.org and anything else yt-dlp can extract. Spotify links are matched to a playable source. It has five slash commands, live synced lyrics, and everything else on buttons on a live now-playing card.

- **Engine:** yt-dlp extracts, FFmpeg decodes, filters and encodes Opus, and `@discordjs/voice` sends it with DAVE end-to-end encryption, which Discord has required since March 2026. No Java and no Lavalink server.
- **Why this engine rather than Lavalink:** platform coverage. yt-dlp supports 1800+ sites, while Lavalink needs plugins and can't play arbitrary niche sites. The cost is one FFmpeg process per active server, which is fine for tens to low hundreds of concurrent servers.
- **Never downloads first:** audio is streamed. FFmpeg reads the media URL directly, or yt-dlp pipes the bytes into it for cookie-bound or fragmented formats. Nothing is written to disk.

See **[docs/PLATFORMS.md](docs/PLATFORMS.md)** for per-platform support and caveats.

---

## Commands

| Command | What it does |
|---|---|
| `/play query [next] [choose]` | Search text, a track, a playlist or album, or a live stream from any supported link. Has autocomplete. A clear match plays straight away; an ambiguous search shows a picker. |
| `/queue [page]` | The queue, paginated, with shuffle and clear buttons. Only you see it. |
| `/settings view\|volume\|dj-role\|always-on\|music-channel` | Server settings. Requires **Manage Server**. |
| `/playlist save\|load\|list\|delete` | Your personal saved playlists. They follow you across servers. |
| `/lyrics [query] [live]` | Lyrics for the current song, or a manual search. `live:true/false` toggles live lyrics on the card. See [Lyrics](#lyrics). |

`/play` also has a `lyrics:true` flag that turns on live lyrics.

**On the now-playing card:** ⏮️ previous · ⏯️ pause/resume · ⏭️ skip · ⏹️ stop · 🎤 live lyrics · 🔀 shuffle · 🔁 loop (off/track/queue) · ➕ add (opens a search box) · 📜 queue · a volume menu (10–150%) · a filters menu (bass boost, nightcore, 8D, normalise). The card updates in place, with a progress bar refreshed every 15s. On each new track it re-posts itself if chat has scrolled it away.

**Music channel:** after `/settings music-channel #music`, any plain message in that channel is played like `/play`. Lines starting with `//` are ignored, so people can still chat there.

**DJ role:** after `/settings dj-role @DJ`, only DJs, server managers, the person who requested the current track (pause/skip only) and anyone alone with the bot can use the controls. Everyone can still add songs.

Errors are only shown to the person who caused them, and each one includes a concrete fix, for example: *❌ I can't join or speak in #Music. 💡 Give me View Channel, Connect and Speak in that channel.*

---

## Lyrics

Lyrics work like a music player: the bot looks for **timed (synced) lyrics** first and highlights the current line as the song plays.

### Providers

| Order | Provider | Key needed | Gives | Notes |
|---|---|---|---|---|
| 1 | **[LRCLIB](https://lrclib.net)** | No | plain **and synced** (LRC) | Primary source. Crowd-sourced, so results go through a quality check (a famous song's exact-match record contained only the word "probe" during testing). |
| 2 | **Musixmatch** (official API) | `MUSIXMATCH_API_KEY` | plain; synced only on a commercial plan | The free plan returns a partial preview (labelled "partial preview"). Subtitle access is tried once; if the plan refuses it, the bot stops asking. |
| 3 | **Genius** | `GENIUS_ACCESS_TOKEN` | plain only | The API finds the song; the lyrics come from its public page. |
| — | **Spotify lyrics** | — | — | **Not included.** Spotify has no public lyrics API. The private web-player endpoint needs a user's `sp_dc` session cookie and is described as subject to removal under Spotify's terms. The adapter interface (`find` / `search` in `src/lyrics/providers/`) makes it a single-file addition if you accept that risk. |

Every provider is optional apart from LRCLIB, which is free. Set `LYRICS_PROVIDERS` to change the order or drop one. `/settings view` shows which providers are active. If every provider is down, the bot says "providers are unreachable" and music keeps playing.

### How a match is chosen

1. **Queries from the playing track:** clean Spotify metadata if the song came from Spotify. Otherwise the artist and title split out of YouTube-style names ("Imagine Dragons - Believer (Lyrics)" by *7clouds* becomes artist *Imagine Dragons*, title *Believer*), then the raw title and uploader.
2. **Normalisation:** removes "(Official Video)", "[Lyrics]", "- 2011 Remaster", "feat. X", "4K", casing and accents. Remixes and covers are kept as different songs.
3. **Score:** title words in both directions, primary artist, and duration. Within 3s is a strong signal, more than 15s off is a strong penalty. Results below a threshold are rejected, so a different song that shares a title isn't shown.
4. **Waterfall:** providers are asked in order, and the first good match **with timing** wins. A plain-only match is kept while providers that can sync are still tried. If none has timing, the plain text from the highest-priority provider is used. Timing beats line count.
5. **Manual override:** `/lyrics query:<song artist>` searches every provider. Duplicate uploads collapse into one entry, and covers or remixes rank lower unless you ask for them. One clear hit opens directly; several plausible songs open a picker. **📌 Use for current song** pins the result to what's playing and to future plays of it.
6. **Nothing found:** you get a plain message ("Couldn't find lyrics for… try `/lyrics query:`", "…is an instrumental", or "providers unreachable"), never an empty embed.

### How sync is handled

- LRC is parsed with support for multiple timestamps per line, `[offset:]` tags and word-level stamps. A binary search finds the active line from the playback position. The position accounts for seeks, and for the speed change when nightcore is on.
- **Live mode** (🎤 button, `/play … lyrics:true` or `/lyrics live:true`) turns the now-playing card into a lyrics view. It shows two dimmed lines before, **the current line in bold**, two after, and the progress bar.
- **Edit rate:** the card is edited only when the visible line changes, or every 5s for the progress bar. Edits are at least `liveMinEditMs` apart (default 1.5s), well under Discord's limit. The highlight runs `lookaheadMs` (default 400ms) ahead to cover edit latency. Updates stop while paused and pick up again on resume.
- **⏪ −2s / ⏩ +2s / reset** nudge the timing. The offset is **saved per user**, and the card uses the offset of whoever last adjusted it, or whoever turned live mode on.
- **Unsynced lyrics** scroll proportionally to the progress and are labelled "approximate position". **Instrumentals** show 🎼. Long lyrics are paginated in `/lyrics` (about 1,800 characters per page, split between verses), and very long lines are shortened in the live view.
- Every lyrics view carries the attribution line "Lyrics from **<source>** · synced/unsynced".

### Caching and limits

- Results are cached in SQLite under a hash of the normalised title, primary artist and duration (3s buckets). Hits are kept 30 days, misses 12 hours, and "providers down" 5 minutes. A repeat play loads lyrics from the cache in under 1ms. Expired rows are pruned at startup.
- Concurrent lookups for the same song share one request. Each HTTP call times out after 4s, and a whole lookup after 12s. Each provider has its own local rate limit and backs off on HTTP 429, honouring `Retry-After`. Lookups run in the background, so a slow provider never delays playback; this is covered by a test that hangs LRCLIB on purpose.
- Users get 8 `/lyrics` lookups per 30s.

---

## Setup

### 1. Create the Discord application

1. Go to <https://discord.com/developers/applications>, choose **New Application**, then the **Bot** tab and **Reset Token**. Copy the token.
2. Still on the **Bot** tab, under *Privileged Gateway Intents*, turn on **Message Content Intent**. This is optional and only needed for the music-channel trigger. If it's off, the bot runs without the trigger and logs a warning.
3. Invite the bot with this URL, replacing `APP_ID`:

   ```
   https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot+applications.commands&permissions=3230784
   ```

   `3230784` grants exactly these permissions:

   | Permission | Why |
   |---|---|
   | View Channels | See the text and voice channels it's used in |
   | Send Messages | Now-playing card and notices |
   | Embed Links | The card is an embed |
   | Read Message History | Edit and re-post its own card |
   | Add Reactions | ✅ on music-channel requests |
   | Connect, Speak | Voice |

   If you restrict a voice channel, give the bot **Connect** and **Speak** there.

### 2a. Run with Docker (recommended for hosting)

```bash
cp .env.example .env        # set DISCORD_TOKEN at minimum
docker compose up -d --build
docker compose logs -f
curl localhost:8080/healthz
```

The image includes FFmpeg, Python and yt-dlp, and upgrades yt-dlp on every container start. Data (SQLite) lives in the `bot-data` volume.

### 2b. Run locally

You need **Node.js ≥ 22.12**, because `@discordjs/voice` 0.19 (the DAVE-capable version) requires it. You also need **Python ≥ 3.10** so the bot can manage yt-dlp. FFmpeg is optional: if none is on your PATH, the `ffmpeg-static` npm package provides one.

```bash
npm install
cp .env.example .env        # set DISCORD_TOKEN
npm start
```

On first start the bot creates `.venv-ytdlp/` and installs `yt-dlp[default,curl-cffi]` into it. On every later start it runs `pip install -U` there. Slash commands register automatically on login. Set `DEV_GUILD_ID` to register them instantly in one test server; global registration can take a while to appear the first time.

> **Why a venv and not the yt-dlp binary?** The one-file yt-dlp binaries unpack themselves on every run, which took about 6.5s per lookup on macOS in testing, against 0.3s from a venv. The venv also brings `certifi`, EJS (YouTube's JS challenge solver) and `curl_cffi` (browser impersonation). Set `YTDLP_INSTALL_MODE=binary` to use the standalone binary instead, or `YTDLP_PATH` to use your own install.

### 3. Configure

- **`.env`** holds credentials and deployment settings. Every variable is listed and explained in [`.env.example`](.env.example).
- **`config.json`** holds defaults: default volume, max queue size, playlist import cap, allowed text and voice channels, default DJ role, idle and empty leave timers, rate limits, and yt-dlp client settings. Env vars of the same name override it.
- **Per-server settings** (volume, DJ role, 24/7 mode, music channel) are set with `/settings` and stored in SQLite.

No paid API is used. Spotify API credentials are optional; see the Spotify notes in [docs/PLATFORMS.md](docs/PLATFORMS.md#spotify).

---

## YouTube bot check ("Sign in to confirm you're not a bot")

YouTube shows this mostly to **datacenter and VPS IP addresses**. When it happens, the user sees a clear message rather than silence, and the bot retries once with a fallback set of YouTube clients (`YTDLP_FALLBACK_PLAYER_CLIENTS`). If it keeps happening:

1. Log in to YouTube in a private browser window, ideally with a throwaway account.
2. Export the cookies in Netscape `cookies.txt` format, for example with a "cookies.txt" browser extension, or `yt-dlp --cookies-from-browser firefox --cookies cookies.txt --skip-download "https://www.youtube.com"`. Then close that window without logging out.
3. Set `YTDLP_COOKIES_FILE=./secrets/cookies.txt` (gitignored) and restart. The bot works on a private copy and never rewrites your file.

The same cookies file unlocks age-restricted videos and login-only sites such as Vimeo. Accounts used for automated access can be rate-limited or flagged, so don't use your main account.

**About the common "use the android/ios client" advice:** it is out of date. As of yt-dlp nightly 2026.10.21, the `ios` client fails outright, and `android`/`android_vr` require PO tokens (each returned only one format in testing). The bot therefore uses yt-dlp's maintained `default` client set and falls back to `web_embedded,web_safari,android_vr`. Both lists can be overridden in `.env` if the situation changes. Advanced users can add a PO-token provider plugin to `.venv-ytdlp`; see yt-dlp's PO Token Guide.

**First-track delay:** YouTube now holds media URLs back for about 5 seconds, roughly the length of a pre-roll ad, and returns 403 before that. The bot waits for that window. Later tracks are pre-resolved while the current one plays, so the delay is usually only noticeable on the first track.

---

## Reliability

- **Isolation:** each server has its own player: queue, history, voice connection, FFmpeg process and state. Nothing is shared between servers except the SQLite file and a global limit on concurrent extractions.
- **State machine:** `disconnected → connecting → idle ⇄ loading → playing ⇄ paused`, plus `reconnecting`. Transitions are checked against an explicit table, and illegal ones are refused and logged.
- **Voice drops:** the bot rejoins with backoff (up to 5 attempts) and resumes the track at its position. The card shows "Reconnecting…" in place, so chat doesn't fill with messages. If a stream dies mid-track, the bot resumes from the same position, first with the same URL and then with a freshly resolved one.
- **Leaving:** when the voice channel empties, the bot pauses and leaves after 2 minutes, resuming if someone comes back. When the queue ends, it leaves after 5 minutes. 24/7 mode disables both and rejoins after restarts.
- **Failures:** every extraction error is mapped to a user-facing message with a fix. A track that fails at play time is announced and skipped. After 5 failures in a row the bot stops rather than burning through the queue.
- **Rate limits:** each user gets 6 lookups per 30s, at most 4 yt-dlp processes run at once, Spotify 429s are honoured, and autocomplete is cached.
- **Event loop:** FFmpeg does all decoding, filtering and Opus encoding, so Node only demuxes Ogg pages. SQLite calls are single indexed statements. In the smoke runs, event-loop delay p99 was about 12ms during playback, at the limit of the 10ms measurement resolution.
- **Ops:** `GET /healthz` returns 200 when the gateway is connected and 503 while starting or shutting down. The JSON body includes guild and player counts and the yt-dlp version. Logs are structured JSON (pino); pipe them through `npx pino-pretty` locally. On SIGTERM or SIGINT the bot closes every card ("Bot restarting"), leaves voice, kills child processes and closes the database.

## Hosting notes

- **Network:** voice uses outbound UDP, so the host must allow it. Residential and home-server IPs hit the YouTube bot check far less often than cloud IPs.
- **Resources:** about 120 MB RAM base, plus roughly 20–40 MB per active server for FFmpeg (and yt-dlp when piping). Opus encoding uses a few percent of one core per stream.
- **Persistence:** keep `data/` (SQLite) on a volume. `.venv-ytdlp/` can be rebuilt at any time.
- **Updates:** a restart is all it takes to pick up a yt-dlp fix. Run `docker compose restart`, or set up a nightly restart if YouTube breaks often.

## Development

```bash
npm test          # unit tests (no network)
npm run smoke     # end-to-end: real yt-dlp/FFmpeg/sources, fake Discord gateway
npm run smoke:lyrics  # end-to-end lyrics: synced, plain, instrumental, manual override, live card, cache, stalled provider
```

`npm run smoke` drives the real command handlers, button router, permission checks and player against live sources. It confirms audio by counting the Opus packets actually dispatched to a fake voice connection.

```
src/
  index.js              boot, intents fallback, health, graceful shutdown
  config.js             .env + config.json
  db.js                 SQLite: settings, playlists, history
  bot/                  slash commands, buttons/selects/modals, permissions, play flow, music-channel trigger, /lyrics
  lyrics/               lyrics service (waterfall, cache), LRC parser, matching, providers/ (lrclib, musixmatch, genius)
  player/               GuildPlayer (state machine), PlayerManager, FFmpeg stream, track model
  sources/              yt-dlp runner + error mapping, binaries/venv management, Spotify, resolver, autocomplete
  ui/                   now-playing card, queue view, picker, modal, lyrics views
```

## Licence

GPL-3.0-only — see [LICENSE](LICENSE). Created by LuniVex; please keep the credit headers in the source files and the `[Credit]` startup log line when you copy or modify the bot.
