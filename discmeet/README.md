# DiscMeet

A Discord meeting note-taker. It joins your voice channel, records each speaker separately, transcribes with OpenAI Whisper, and posts structured AI-written meeting notes. It also includes a per-user expense tracker.

- **Language:** JavaScript (Node.js ≥ 18, discord.js v14, @discordjs/voice)
- **External services:** OpenAI (Whisper for transcription, a GPT chat model for notes). Audio and transcripts are sent to OpenAI.
- **Entry point:** `src/index.js` (source folder was `discmeet-clone` in the original repo)

## Commands

| Command | What it does |
| --- | --- |
| `/join` | Join your voice channel and start recording |
| `/summarize` | End the recording and generate AI meeting notes |
| `/leave` | Leave the voice channel |
| `/status` | Show current recording session info |
| `/resummarize` | Re-run the summary on the last cached session (debug tool) |
| `/expense add\|list\|edit\|remove\|total` | Track expenses, view a month, and compare against a monthly budget |

Session header, transcript (`.txt` attachment) and summary are posted to `LOG_CHANNEL_ID` when set, otherwise to the command channel.

## Requirements

- Node.js 18+
- Discord bot token and application (client) ID
- An OpenAI API key (usage is billed by OpenAI)
- Gateway intents used: Guilds, GuildVoiceStates

## Run

```bash
cp .env.example .env     # fill in the values
npm ci
npm run deploy           # register slash commands (once, or after changing them)
npm start                # or: npm run dev
```

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | yes | | Bot token |
| `CLIENT_ID` | yes | | Application (client) ID |
| `OPENAI_API_KEY` | yes | | OpenAI key |
| `WHISPER_MODEL` | no | `whisper-1` | Transcription model |
| `SUMMARY_MODEL` | no | `gpt-4o-mini` | Notes model |
| `SILENCE_DURATION` | no | `300` | ms of silence that ends a speech segment |
| `LOG_CHANNEL_ID` | no | | Archive channel |
| `IDLE_STATUS` | no | `Watching over meetings` | Presence text when idle |
| `DEBUG` | no | | Any value enables debug logging |

Local runtime folders (`recordings/`, `notes/`, `data/`, `cache/`) are created by the bot and git-ignored.

## Notes / things to check

- Files over 25 MB are skipped for transcription (Whisper API limit, see `src/transcription/whisper.js`).
- `package.json` declares MIT, but there is no LICENSE file in the source.
- The file `src/commands/stop.js` implements `/summarize`.
