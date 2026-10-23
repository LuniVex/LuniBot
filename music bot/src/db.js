/**
 * Music Bot — src/db.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

// better-sqlite3 is synchronous, but every statement here is a single indexed lookup or
// a small transaction (sub-millisecond), so it never stalls the event loop meaningfully.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id              TEXT PRIMARY KEY,
  volume                INTEGER,
  dj_role_id            TEXT,
  always_on             INTEGER NOT NULL DEFAULT 0,
  music_channel_id      TEXT,
  last_voice_channel_id TEXT,
  last_text_channel_id  TEXT,
  updated_at            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id   TEXT NOT NULL,
  name       TEXT NOT NULL COLLATE NOCASE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id  INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  url          TEXT NOT NULL,
  title        TEXT NOT NULL,
  artist       TEXT,
  duration_sec INTEGER,
  source       TEXT,
  PRIMARY KEY (playlist_id, position)
);

CREATE TABLE IF NOT EXISTS play_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id     TEXT NOT NULL,
  user_id      TEXT,
  url          TEXT NOT NULL,
  title        TEXT NOT NULL,
  artist       TEXT,
  source       TEXT,
  played_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_guild ON play_history (guild_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_user ON play_history (user_id, played_at DESC);

CREATE TABLE IF NOT EXISTS lyrics_cache (
  cache_key  TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id          TEXT PRIMARY KEY,
  lyrics_offset_ms INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL
);
`;

export class Store {
  constructor(file = config.databasePath) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 3000');
    this.db.exec(SCHEMA);
    this.#prepare();
  }

  #prepare() {
    const q = (sql) => this.db.prepare(sql);
    this.stmts = {
      getSettings: q('SELECT * FROM guild_settings WHERE guild_id = ?'),
      ensureSettings: q('INSERT OR IGNORE INTO guild_settings (guild_id, updated_at) VALUES (?, ?)'),
      alwaysOnGuilds: q('SELECT * FROM guild_settings WHERE always_on = 1 AND last_voice_channel_id IS NOT NULL'),

      findPlaylist: q('SELECT * FROM playlists WHERE owner_id = ? AND name = ?'),
      insertPlaylist: q('INSERT INTO playlists (owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'),
      touchPlaylist: q('UPDATE playlists SET updated_at = ? WHERE id = ?'),
      clearPlaylist: q('DELETE FROM playlist_tracks WHERE playlist_id = ?'),
      insertPlaylistTrack: q(`INSERT INTO playlist_tracks (playlist_id, position, url, title, artist, duration_sec, source)
                              VALUES (?, ?, ?, ?, ?, ?, ?)`),
      playlistTracks: q('SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position'),
      listPlaylists: q(`SELECT p.name, p.updated_at, COUNT(t.position) AS track_count
                        FROM playlists p LEFT JOIN playlist_tracks t ON t.playlist_id = p.id
                        WHERE p.owner_id = ? GROUP BY p.id ORDER BY p.name LIMIT 100`),
      searchPlaylists: q("SELECT name FROM playlists WHERE owner_id = ? AND name LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 25"),
      deletePlaylist: q('DELETE FROM playlists WHERE owner_id = ? AND name = ?'),

      addHistory: q(`INSERT INTO play_history (guild_id, user_id, url, title, artist, source, played_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`),
      recentForUser: q(`SELECT title, url, MAX(played_at) AS last FROM play_history
                        WHERE user_id = ? GROUP BY url ORDER BY last DESC LIMIT ?`),
      pruneHistory: q('DELETE FROM play_history WHERE played_at < ?'),

      getLyrics: q('SELECT payload FROM lyrics_cache WHERE cache_key = ? AND expires_at > ?'),
      putLyrics: q(`INSERT INTO lyrics_cache (cache_key, payload, expires_at) VALUES (?, ?, ?)
                    ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at`),
      pruneLyrics: q('DELETE FROM lyrics_cache WHERE expires_at <= ?'),
      getOffset: q('SELECT lyrics_offset_ms FROM user_settings WHERE user_id = ?'),
      setOffset: q(`INSERT INTO user_settings (user_id, lyrics_offset_ms, updated_at) VALUES (?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET lyrics_offset_ms = excluded.lyrics_offset_ms, updated_at = excluded.updated_at`),
    };
  }

  getSettings(guildId) {
    const row = this.stmts.getSettings.get(guildId);
    return {
      volume: row?.volume ?? config.defaultVolume,
      djRoleId: row?.dj_role_id ?? config.djRoleId,
      alwaysOn: Boolean(row?.always_on),
      musicChannelId: row?.music_channel_id ?? null,
      lastVoiceChannelId: row?.last_voice_channel_id ?? null,
      lastTextChannelId: row?.last_text_channel_id ?? null,
    };
  }

  static COLUMNS = {
    volume: 'volume',
    djRoleId: 'dj_role_id',
    alwaysOn: 'always_on',
    musicChannelId: 'music_channel_id',
    lastVoiceChannelId: 'last_voice_channel_id',
    lastTextChannelId: 'last_text_channel_id',
  };

  updateSettings(guildId, patch) {
    const sets = [];
    const values = [];
    for (const [key, value] of Object.entries(patch)) {
      const col = Store.COLUMNS[key];
      if (!col) throw new Error(`Unknown setting ${key}`);
      sets.push(`${col} = ?`);
      values.push(typeof value === 'boolean' ? Number(value) : value);
    }
    if (sets.length === 0) return this.getSettings(guildId);
    const now = Date.now();
    this.db.transaction(() => {
      this.stmts.ensureSettings.run(guildId, now);
      this.db.prepare(`UPDATE guild_settings SET ${sets.join(', ')}, updated_at = ? WHERE guild_id = ?`).run(...values, now, guildId);
    })();
    return this.getSettings(guildId);
  }

  alwaysOnGuilds() {
    return this.stmts.alwaysOnGuilds.all();
  }

  /** Create or overwrite a user's playlist. Returns the number of tracks saved. */
  savePlaylist(ownerId, name, tracks) {
    const now = Date.now();
    const saveable = tracks.filter((t) => t.url);
    this.db.transaction(() => {
      let row = this.stmts.findPlaylist.get(ownerId, name);
      if (!row) {
        const info = this.stmts.insertPlaylist.run(ownerId, name, now, now);
        row = { id: info.lastInsertRowid };
      } else {
        this.stmts.touchPlaylist.run(now, row.id);
        this.stmts.clearPlaylist.run(row.id);
      }
      saveable.forEach((t, i) => {
        this.stmts.insertPlaylistTrack.run(row.id, i, t.url, t.title, t.artist ?? null, t.durationSec ?? null, t.source ?? null);
      });
    })();
    return saveable.length;
  }

  getPlaylist(ownerId, name) {
    const row = this.stmts.findPlaylist.get(ownerId, name);
    if (!row) return null;
    const tracks = this.stmts.playlistTracks.all(row.id).map((t) => ({
      url: t.url, title: t.title, artist: t.artist, durationSec: t.duration_sec, source: t.source,
    }));
    return { name: row.name, tracks };
  }

  listPlaylists(ownerId) {
    return this.stmts.listPlaylists.all(ownerId);
  }

  searchPlaylistNames(ownerId, prefix) {
    const escaped = prefix.replace(/[\\%_]/g, (c) => `\\${c}`);
    return this.stmts.searchPlaylists.all(ownerId, `%${escaped}%`).map((r) => r.name);
  }

  deletePlaylist(ownerId, name) {
    return this.stmts.deletePlaylist.run(ownerId, name).changes > 0;
  }

  addHistory(guildId, userId, track) {
    if (!track.url) return;
    this.stmts.addHistory.run(guildId, userId ?? null, track.url, track.title, track.artist ?? null, track.source?.name ?? null, Date.now());
  }

  recentForUser(userId, limit = 10) {
    return this.stmts.recentForUser.all(userId, limit);
  }

  pruneHistory(maxAgeDays = 90) {
    return this.stmts.pruneHistory.run(Date.now() - maxAgeDays * 86_400_000).changes;
  }

  getLyrics(key) {
    const row = this.stmts.getLyrics.get(key, Date.now());
    return row ? JSON.parse(row.payload) : null;
  }

  putLyrics(key, payload, ttlMs) {
    this.stmts.putLyrics.run(key, JSON.stringify(payload), Date.now() + ttlMs);
  }

  pruneLyrics() {
    return this.stmts.pruneLyrics.run(Date.now()).changes;
  }

  getLyricsOffset(userId) {
    return this.stmts.getOffset.get(userId)?.lyrics_offset_ms ?? 0;
  }

  setLyricsOffset(userId, offsetMs) {
    this.stmts.setOffset.run(userId, Math.round(offsetMs), Date.now());
  }

  close() {
    this.db.close();
  }
}
