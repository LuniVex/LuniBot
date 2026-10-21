# Lunibot website

The website for the [lunibot](https://github.com/LuniVex/lunibot) bots: a showcase and download site for a collection of self-hosted Discord bots. Each bot has its own page and its own download, served from this site. GitHub source and releases are offered as a secondary link.

Stack: Next.js (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · deploy-ready for Vercel.

## Layout

```
data/bots.json    The one file you edit to add or change a bot
scripts/          pack-bots.mjs builds the download zips
public/downloads/ The committed zips and checksums the site serves
app/              Routes: / (hub), /bots/[slug], /about, /api/*, sitemap, robots, OG images
components/       BotCard, Tag, StatusBadge, DownloadPanel, Button, Section, ...
lib/              bots.json loader, download reader, store, stats, motion presets
skills/           Design rules (loaded through CLAUDE.md); references/ and mock/ hold style references and a static mock
```

The bot source code is **not in this repo**. It lives in [LuniVex/lunibot](https://github.com/LuniVex/lunibot). `npm run pack` rebuilds the zips only when a `bots/<slug>/` folder sits next to the site (for example a local checkout of that repo); otherwise it keeps the committed zips.

## Setup

```bash
npm install
npm run dev                  # http://localhost:3000 (builds the zips first)
npm run build && npm start   # production check
```

The Discord invite is `site.discord` in `data/bots.json`. Optional: `NEXT_PUBLIC_SITE_URL` sets the canonical URL for OpenGraph/sitemap/robots. On Vercel, `VERCEL_PROJECT_PRODUCTION_URL` is used automatically. Deploy by importing the repo in Vercel; `vercel.json` only adds security headers.

## Add a new bot

1. Add its source to the bots repo, and (to build its zip) put a copy at `bots/<slug>/` next to the site.
2. Add an entry to `data/bots.json` under `bots`:

```json
{
  "name": "My Bot",
  "slug": "my-bot",
  "tagline": "One line shown on the card.",
  "description": "Longer description for the bot page.",
  "language": "TypeScript",
  "runtime": "Node.js 20+",
  "tags": ["discord", "music"],
  "status": "active",
  "version": "1.0.0",
  "released": "2026-10-21",
  "updated": "2026-10-21",
  "license": "MIT",
  "features": ["..."],
  "commands": [{ "name": "/play <song>", "description": "..." }],
  "requirements": ["..."],
  "telemetry": "none",
  "download": {
    "file": "/downloads/my-bot/my-bot-1.0.0.zip",
    "sourceDir": "bots/my-bot",
    "github": { "repo": "LuniVex/lunibot", "path": "my-bot", "releases": "https://github.com/LuniVex/lunibot/releases" }
  }
}
```

`status` is `active`, `beta` or `archived`. `telemetry` is `"none"` or a sentence about where data goes. `released` is "First released" and `updated` is "Last updated". Bump `version` and `updated` when you change a bot, and the zip name should follow the version.

## How downloads are hosted

- `npm run pack` (runs automatically before `dev` and `build`) zips each bot's `sourceDir` into `public/downloads/<slug>/<slug>-<version>.zip` and writes a `.sha256` file next to it. Next.js serves `public/` as static files, so the download button is a plain link to `/downloads/...`.
- Excluded from every zip: `node_modules`, `.env`, `.git`, `data`, `transcripts`, `recordings`, `notes`, `cache`, logs.
- Zip timestamps are fixed, so the same source always produces the same checksum.
- Size comes from the file at build time, the checksum from the `.sha256` file, version and last-updated from `bots.json`.
- `public/downloads/` is committed. This repo does not contain `bots/`, so on a fresh clone or on Vercel `npm run pack` finds no source folder and keeps the committed zips. With `bots/` present next to the site, it rebuilds them. After changing a bot, rebuild and commit the new zip.

## Download counts and upvotes (server-side)

Counts live on the server, so they are shared by all visitors and survive deploys.

- **Production store: Upstash Redis.** Vercel KV and Vercel Postgres are no longer offered directly; Redis now comes from the Vercel Marketplace. In your Vercel project open **Storage > Create > Upstash Redis** and connect it. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`; no code change is needed. Until you do, the stats/vote routes return 503 on Vercel and the UI shows "unavailable" instead of fake numbers.
- **Local dev:** with no Redis variables set, a JSON file at `.data/store.json` (git-ignored) is used, written by the server, so numbers persist across restarts. This is not for Vercel, whose filesystem is ephemeral.
- **Downloads:** buttons link to `/api/download/<slug>`, which counts the request and redirects (302) to the file in `public/downloads/`. One download per visitor per bot per hour is counted, and crawler user agents are ignored. Anyone who opens `/downloads/...` directly bypasses the count.
- **Upvotes:** `POST /api/votes/<slug>` toggles the visitor's vote. A visitor is an anonymous random ID in an httpOnly cookie (`lb_vid`, one year). Clearing cookies lets someone vote again; without accounts that cannot be prevented.
- **Routes:** `GET /api/stats` (hub summary), `GET /api/stats/<slug>` (totals + 30-day series + votes), `GET|POST /api/votes/<slug>`, `GET /api/download/<slug>`.
- **Dates:** "First released" is `released` in `data/bots.json` and "Last updated" is `updated`. No formal releases exist yet, so `released` is the date of each bot's first commit in the source repo (Modmail 2026-07-01, DiscMeet 2026-06-27). Edit them if you want a different meaning.

## Design and motion

Rules live in `skills/` and are loaded through `CLAUDE.md`. Tokens (paper/ink/accent colours, the 1.25 type scale, 2px radius, 1px borders) are in `app/globals.css`, and Tailwind's default palette, shadows and radii are removed so only tokens exist.

Motion uses one spring (`lib/motion.ts`), transform and opacity only, and respects `prefers-reduced-motion`. Route changes animate in through `app/template.tsx` (enter transitions only; the App Router does not support exit animations without hacks). Loading skeletons are in `app/loading.tsx` and `app/bots/[slug]/loading.tsx`.

## Known limitations

- No screenshots exist in the source; bots show a monogram.
- "View source" and "Latest release" point at `LuniVex/lunibot`. "Latest release" will show an empty page until you publish a release there.
- Neither bot has a LICENSE file (DiscMeet's `package.json` declares MIT). The About page says so.
