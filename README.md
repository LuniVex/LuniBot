# LuniBot

Showcase and download site for LuniVex's self-hosted Discord bots. Each bot has its own page, its own download served from this site, live download counts and upvotes.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Framer Motion · Upstash Redis. Ready for Vercel.

## Setup

Requires Node.js 24 (pinned in `.nvmrc` and `engines`; Vercel reads the same field).

```bash
nvm use
npm install
npm run dev     # http://localhost:3001
npm run build   # production build
npm run lint
```

Copy `.env.example` to `.env.local` if you need to set anything locally. Nothing is required for local development: download counts and votes are written to `.data/store.json`.

### Deploying to Vercel

1. Import the repository in Vercel.
2. In the project, open **Storage** and add **Upstash for Redis** from the Marketplace. Vercel then sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. Optionally set `NEXT_PUBLIC_SITE_URL` to the site's public address (used for sitemap, robots and link previews).

Without Redis connected, the site still works and downloads still work, but the stats and vote endpoints answer `503` with a message saying Redis is missing. They refuse rather than writing to Vercel's temporary filesystem and losing the numbers.

## Layout

```
data/bots.json          Every bot. The one file to edit when adding or changing a bot.
public/downloads/       The zips the site serves, each with a .sha256 checksum file next to it
app/                    Pages (/, /bots/[slug], /about, 404) and API routes (/api/*)
components/             UI components
lib/                    Data loading, datastore, analytics, formatting, motion settings
scripts/checksums.mjs   Writes the .sha256 files for the zips
```

## Adding a bot

1. Put the zip at `public/downloads/<slug>/<slug>-<version>.zip`. Include the bot's `LICENSE` file in it.
2. Run `npm run checksums` to write its `.sha256` file.
3. Add a logo to the `icons` map in `components/AppIcon.tsx`: a tile colour and a white SVG drawing on a 24×24 grid. Skip this step and the bot shows its first letter on a grey tile.
4. Add an entry to `data/bots.json`:

```json
{
  "name": "My Bot",
  "slug": "my-bot",
  "tagline": "One line shown on the tile.",
  "description": "A few sentences for the bot's page. The first sentence is shown darker than the rest.",
  "language": "JavaScript",
  "runtime": "Node.js 18+",
  "tags": ["discord", "music"],
  "status": "beta",
  "version": "1.0.0",
  "icon": "my-logo",
  "features": ["..."],
  "commands": [{ "name": "/play <song>", "description": "..." }],
  "requirements": ["Node.js 18+", "Discord bot token"],
  "telemetry": "none",
  "released": "2026-10-21",
  "updated": "2026-10-21",
  "license": "GPL-3.0-only",
  "download": {
    "file": "/downloads/my-bot/my-bot-1.0.0.zip",
    "sourceDir": "bots/my-bot",
    "github": { "repo": "LuniVex/lunibot", "path": "my-bot", "releases": "https://github.com/LuniVex/lunibot/releases" }
  }
}
```

`status` is `active`, `beta` or `archived`. `telemetry` is `"none"` or a sentence saying what leaves the user's machine. `license` is an SPDX ID; `GPL-3.0-only` and `MIT` get a full name and link (see `lib/license.ts`). Bots appear on the hub in the order they appear in this file.

## How downloads and analytics work

- The Download buttons point to `/api/download/<slug>`. That route counts the download, then redirects to the zip in `public/downloads`. Files are always served from this site, never from GitHub; the GitHub links on each bot page are a secondary way to view the source.
- A download counts at most once per hour per visitor. Search engines and link-preview crawlers are not counted. If the datastore is down, the download still goes through, it just isn't counted.
- For each bot the datastore keeps an all-time total and one counter per day (kept for about 13 months). The bot page shows today, the last 7 and 30 days, and a 30-day chart.
- Upvotes: one per visitor per bot, and pressing again removes it. Votes from other websites are refused.
- Visitors are told apart by a single anonymous, httpOnly cookie (`lb_vid`) holding a random ID. There is no other tracking.

API routes:

| Route | Method | Returns |
| --- | --- | --- |
| `/api/download/[slug]` | GET | Counts the download, redirects to the zip |
| `/api/stats` | GET | Downloads total and votes for every bot (used by the hub) |
| `/api/stats/[slug]` | GET | Total, today, last 7 and 30 days, and the daily series |
| `/api/votes/[slug]` | GET, POST | The vote count and whether this visitor voted; POST toggles the vote |

## Licence

Every bot is released under the GNU General Public License v3.0 (`GPL-3.0-only`). Each zip contains the full text in its `LICENSE` file.
