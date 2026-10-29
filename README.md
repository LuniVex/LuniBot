# lunibot

LuniVex's Lunibot official repo, containing all the bots showcased on the website.

Each bot is a standalone Node.js program in its own folder, with its own dependencies, `.env.example` and README. There is no shared code between them, so you can use one without the other.

## Bots

| Bot | What it does | Folder |
| --- | --- | --- |
| **Modmail** | Turns member DMs into staff-managed support threads, with transcripts and snippets. | [`modmail/`](modmail) |
| **DiscMeet** | Records a Discord voice channel, transcribes it with OpenAI Whisper, and posts structured meeting notes. Also tracks expenses. | [`discmeet/`](discmeet) |
| **Music Bot** | Plays music from YouTube, Spotify, SoundCloud, Bandcamp, Twitch and 1800+ other sites, with button controls, filters, saved playlists and live synced lyrics. | [`music bot/`](music%20bot) |

All are written in JavaScript on [discord.js](https://discord.js.org) v14 and need Node.js 22.12 or newer. Modmail and DiscMeet are version `1.0.2`; Music Bot is `1.0.1` and also needs Python 3.10+ (it installs yt-dlp itself).

## Layout

```
modmail/              Modmail bot
  src/                commands, events, handlers, SQLite database layer
  .env.example        every environment variable the bot reads
  Dockerfile, docker-compose.yml
  README.md           commands, requirements, how to run
discmeet/             DiscMeet bot
  src/                commands, voice recording, transcription, summaries
  .env.example
  README.md
music bot/            Music Bot
  src/                player, sources (yt-dlp, Spotify), lyrics, UI
  .env.example, config.json
  Dockerfile, docker-compose.yml
  README.md, SETUP.txt, docs/PLATFORMS.md
```

## Running a bot

Pick a folder and follow its SETUP.txt (step by step) or README. The steps are the same shape for every bot:

```bash
cd modmail                # or discmeet, or "music bot" (quotes: the name has a space)
cp .env.example .env      # fill in the values
npm ci
npm start
```

DiscMeet additionally needs `npm run deploy` once to register its slash commands. Modmail and Music Bot register their commands themselves when they start.

## Configuration and secrets

Every variable a bot reads is listed in that bot's `.env.example`, with a comment on what it is and where to get it. Copy it to `.env` and fill it in. `.env` files are git-ignored, so never commit one: a Discord bot token gives full control of the bot, and an OpenAI key bills your account.

## Third-party services

- **Modmail** talks only to Discord.
- **DiscMeet** sends recorded audio and transcripts to OpenAI for transcription and summaries. OpenAI usage is billed to your own API key.
- **Music Bot** streams from the sites people link (via yt-dlp), reads Spotify metadata, and fetches lyrics from LRCLIB (free, no key). Musixmatch, Genius and the Spotify API are optional and only used if you add their keys. No paid service is required.

## Licence

Every bot is licensed **GPL-3.0-only**. The full text is in each bot's `LICENSE` file, and each `package.json` declares it. Please keep the LuniVex credit headers and startup credit line when you copy or modify a bot.

## Known quirks

- Modmail's `docker-compose.yml` publishes port 3000, but nothing listens on it any more.
- Modmail's `/help` output omits `/claim`, `/unclaim`, `/closeall` and the `helpchannel` and `staffrole` config options, although they exist.
