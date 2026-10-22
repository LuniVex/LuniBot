# Modmail

A Discord modmail bot. Members DM the bot; each conversation becomes a public thread in a single tickets channel where staff reply, claim, and close it. Closed tickets are archived as transcript files.

- **Language:** JavaScript (Node.js ≥ 22.12, discord.js v14)
- **Storage:** SQLite via `better-sqlite3` (tables: config, tickets, user_ticket_counts, messages, snippets, transcripts, permissions)
- **Entry point:** `src/index.js`

## Commands

Slash commands, registered automatically when the bot becomes ready.

| Command | What it does |
| --- | --- |
| `/reply <message> [anonymous]` | Reply to the user from inside a ticket thread |
| `/claim` / `/unclaim` | Claim or release a ticket thread (renames it; unclaiming pings the staff role) |
| `/close [reason]` | Close the ticket and generate a transcript |
| `/closeall` | Emergency: force-close every open ticket in the database |
| `/logs user <target>` | Paginated history of a user's past tickets |
| `/logs search <query>` | Search closed transcripts for text |
| `/snippet add\|remove\|list\|use` | Manage and send canned responses |
| `/config color\|activity\|emoji\|view` | Change bot settings |
| `/help` | List commands |

## Requirements

- Node.js 22.12+ (or Docker, which uses Node 24)
- A Discord application with a bot token
- Privileged intents enabled in the Developer Portal: **Message Content** and **Server Members**
- Build tools for `better-sqlite3` if no prebuilt binary matches your platform (the Dockerfile installs `python3 make g++`)

## Run

```bash
cp .env.example .env     # fill in the values
npm ci
npm start                # or: npm run dev  (auto-restart)
```

Docker:

```bash
docker compose up -d --build
```

Data persists in `./data` (SQLite) and `./transcripts`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token |
| `GUILD_ID` | yes | Server the bot operates in |
| `TICKETS_CHANNEL_ID` | yes | Text channel where ticket threads are created |
| `ARCHIVE_CHANNEL_ID` | yes | Private channel where transcripts are posted |
| `STAFF_ROLE_ID` | yes | Role allowed to use modmail commands |
| `DATABASE_PATH` | no | Absolute path to the SQLite file |

## Notes / things to check

- `.env.example` lists every variable the code reads. Never commit your real `.env`.
- `/help` does not list `/claim`, `/unclaim` or `/closeall`, although they exist.
- Claiming and unclaiming rename the thread. Discord rate-limits channel renames (2 per 10 minutes per thread), so a quick claim/unclaim/claim can fail; try again after a few minutes.
- Licensed under GPL-3.0. See `LICENSE`.

## License

Copyright (C) 2026 LuniVex

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the `LICENSE` file for the full text.
