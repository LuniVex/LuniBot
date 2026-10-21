# lunibot

LuniVex's Lunibot official repo, containing all the bots showcased on the website.

Each bot is a standalone Node.js program in its own folder, with its own dependencies, `.env.example` and README. There is no shared code between them, so you can use one without the other.

## Bots

| Bot | What it does | Folder |
| --- | --- | --- |
| **Modmail** | Turns member DMs into staff-managed support threads, with transcripts and snippets. | [`modmail/`](modmail) |
| **DiscMeet** | Records a Discord voice channel, transcribes it with OpenAI Whisper, and posts structured meeting notes. Also tracks expenses. | [`discmeet/`](discmeet) |

Both are version `1.0.0`, written in JavaScript on [discord.js](https://discord.js.org) v14, and need Node.js 18 or newer.

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
```

## Running a bot

Pick a folder and follow its README. The steps are the same shape for both:

```bash
cd modmail                # or discmeet
cp .env.example .env      # fill in the values
npm ci
npm start
```

DiscMeet additionally needs `npm run deploy` once to register its slash commands. Modmail registers its commands itself when it starts.

## Configuration and secrets

Every variable a bot reads is listed in that bot's `.env.example`, with a comment on what it is and where to get it. Copy it to `.env` and fill it in. `.env` files are git-ignored, so never commit one: a Discord bot token gives full control of the bot, and an OpenAI key bills your account.

## Third-party services

- **Modmail** talks only to Discord.
- **DiscMeet** sends recorded audio and transcripts to OpenAI for transcription and summaries. OpenAI usage is billed to your own API key.

## Licence

No LICENSE file is present in either bot's source. DiscMeet's `package.json` declares MIT, Modmail declares nothing. Until a licence file is added, treat the code as all rights reserved by the author: you may read and run it, but ask before redistributing or modifying it.

## Known quirks

- Modmail's `docker-compose.yml` publishes port 3000, but nothing listens on it any more.
- Modmail's `/help` output omits `/claim`, `/unclaim`, `/closeall` and the `helpchannel` and `staffrole` config options, although they exist.
