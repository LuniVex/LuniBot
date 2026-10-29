# Supported platforms and caveats

Anything **yt-dlp** can extract can be played: [1800+ sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md). The table covers the platforms people use most.

**Status** means what was verified end-to-end on **2026-10-23** with yt-dlp nightly `2026.10.21.233146`, from a residential IP without cookies. "Verified" means the link resolved and the bot produced real Opus audio from it, or for list types, that it resolved and imported. Sites change often; a restart pulls the latest yt-dlp.

| Platform | Links that work | Status | Caveats |
|---|---|---|---|
| **YouTube** | videos, `youtu.be`, Shorts, search text | ✅ verified (search, video, failure handling) | See the [YouTube](#youtube) notes below: bot check on server IPs, about 5s delay on the first track |
| **YouTube playlists / Mixes** | `playlist?list=…`, `watch?v=…&list=…` | ✅ verified (album playlist: 19 tracks; Mix: capped at 200) | A `watch?v=…&list=…` link loads the list starting from that video. Radio Mixes never end, so they stop at `maxPlaylistItems` (200). `playlist?list=RD…` Mix links are rejected by YouTube ("unviewable"); share the `watch?v=…&list=RD…` form instead |
| **YouTube live** | live `watch` URLs | ✅ verified (24/7 lofi stream) | No seeking. Nightcore is disabled on live streams. Upcoming premieres get a "not started yet" message |
| **YouTube Music** | `music.youtube.com/watch`, playlists | ✅ track verified | Same engine as YouTube; shows a YouTube Music badge |
| **Spotify** | track, album, playlist, artist links; `spotify:` URIs; `spotify.link` short links | ✅ verified (track, album, playlist, artist) | Audio is DRM-protected, so each song is **matched on YouTube** (SoundCloud as fallback); see [Spotify](#spotify) |
| **SoundCloud** | tracks, sets, user pages | ✅ verified (track playback, 11-track set) | Go+ (paid) tracks are only 30-second previews. Set entries show a placeholder title until they play |
| **Bandcamp** | tracks, albums | ✅ track verified (played to the end, auto-advanced) | Album pages import as playlists (not separately verified). Tracks the artist hasn't made streamable can't play |
| **Twitch** | live channels, VODs, clips | ✅ live channel verified (audio-only HLS) | An offline channel gets "isn't live right now". Subscriber-only VODs need cookies. Ads in the stream are heard as audio |
| **archive.org** | items and collections | ✅ verified (audio item streamed through yt-dlp; 487-item collection capped at 200) | Uses cookie-bound URLs, so it streams through yt-dlp → FFmpeg (still never written to disk). Video items without an audio track are reported as "no audio track" |
| **Vimeo** | — | ❌ fails without login (2026-10-23) | Vimeo now refuses anonymous extraction ("web client only works when logged-in"). Adding Vimeo cookies to `YTDLP_COOKIES_FILE` should make it work (not tested) |
| **Mixcloud** | shows, DJ mixes | ✅ verified (search + playback) | Mostly long DJ mixes rather than single songs |
| **Audius** | tracks | ✅ verified (search + playback) | Independent artists; streams are piped through yt-dlp |
| **Apple Music, Deezer, Tidal, Amazon Music** | — | ❌ not supported | DRM-only, and unlike Spotify there is no free metadata path. Search by song name instead |
| **Anything else** | any yt-dlp-supported URL | depends on the site | Login-walled sites need cookies; DRM sites can't play. Unsupported links get a clear message with a link to the supported-sites list |

## YouTube

- **"Sign in to confirm you're not a bot":** shown mostly to datacenter and VPS IPs. The bot retries once with fallback player clients. If YouTube still refuses, the user sees a message explaining the bot check and suggesting a different source. The fix is `YTDLP_COOKIES_FILE` (see the README).
- **Player clients:** `default` (yt-dlp's maintained set), with `web_embedded,web_safari,android_vr` as a fallback. As of this date the commonly recommended `android`/`ios` clients don't work without PO tokens: `ios` fails outright, and `android`/`android_vr` return a single format. Override with `YTDLP_PLAYER_CLIENTS` if that changes.
- **About 5s before the first track starts:** YouTube now withholds media URLs for roughly the length of a pre-roll ad (`available_at`), and requests before then get HTTP 403. The bot waits for it. Later tracks are pre-resolved during the current track, so the wait is usually hidden.
- **JS challenges:** yt-dlp needs a JavaScript runtime for YouTube. The bot passes the Node running it (≥ 22). The `yt-dlp[default]` install includes the EJS solver scripts.
- **Age-restricted:** needs cookies from an age-verified account. **Members-only and private** videos can't be played.
- **Seeking:** used to resume after a voice drop and when volume or filters change. Direct streams seek instantly. Piped sources (cookie-bound formats) seek by decoding forward, which is slower on long tracks.

## Spotify

Spotify can't be streamed: its audio is DRM-protected. The bot reads the metadata (title, artists, duration) and plays the best match from YouTube, falling back to SoundCloud.

- **Matching** scores candidates on title words, primary artist and duration (±3s is best; >30s off is heavily penalised). It prefers official "Artist - Topic" audio, and penalises covers, live, remix, sped-up and similar versions unless the Spotify title contains those words too.
- **No match:** a single track gets an immediate "couldn't find it" reply. In a playlist, the unmatched track is announced in chat and skipped.
- **Playlists and albums are matched lazily**, one track ahead of playback, so a 200-track playlist doesn't fire 200 searches up front.
- **Metadata source:**
  - **Without credentials (default):** Spotify's public embed page. Works for public tracks, albums, playlists, and an artist's top tracks. Very long playlists may be truncated to what the embed page lists.
  - **With `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`:** the Web API is used first for tracks, albums and playlists, with full album pagination. Since **February 2026**, Development Mode apps must be owned by a **Spotify Premium** account, and the API only returns playlist contents for playlists the app owner owns or collaborates on. Other playlists, and artists, automatically fall back to the embed page. There's no cost unless you count the Premium requirement, which is why credentials are optional.
- Podcast episodes in playlists are skipped.

## Search

- Typed searches go through every music site that can be both searched and streamed for free, in this order: **YouTube → SoundCloud → Bandcamp → Audius → Mixcloud → Internet Archive**. The first site whose results actually contain your words wins. Covers, karaoke and sped-up versions rank below the original unless you ask for them. Change the order or drop a site with `search.providers` in `config.json` or `SEARCH_PROVIDERS` in `.env`.
- YouTube and SoundCloud are searched through yt-dlp. Bandcamp, Audius, Mixcloud and the Internet Archive are searched through their free public search APIs, with no keys needed; the Bandcamp one is the endpoint behind bandcamp.com's own search box and isn't documented. Playback always goes through yt-dlp.
- **When a site refuses a song** (YouTube's bot check, DRM, region lock, a deleted video), the bot looks up the same song (artist + title + duration) on the next site and plays that instead of skipping. You get one notice, e.g. "Couldn't play X from YouTube or SoundCloud, so it's playing from Bandcamp instead". If a whole site refuses this server (bot check, rate limit), it's skipped for 30 minutes (`search.blockMinutes`). `/settings view` shows the order and anything currently skipped. Spotify songs and blocked YouTube links go through the same chain.
- **Limits:** Bilibili and Niconico are left out because their search refuses automated requests or needs an account. Spotify, Apple Music, Deezer and Tidal are DRM-only, so they're used for song details, never audio. Major-label songs are often DRM-locked on SoundCloud too, so without YouTube a mainstream song can end up as a re-upload or a cover from Bandcamp or Audius.
- A clear match plays immediately. If the top result doesn't contain the query, or a short query matches several different songs (e.g. "hello"), the requester gets a picker. Use `/play … choose:true` to always get one.
- Autocomplete suggests your recently played tracks when the box is empty, and YouTube search suggestions as you type.
