/**
 * Modmail — src/database/schema.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const db = require('./db');

/**
 * Creates all tables and seeds default config values.
 * Safe to call on every startup (IF NOT EXISTS).
 */
function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      channel_id TEXT,
      status     TEXT    NOT NULL DEFAULT 'open',
      subject    TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      closed_at  TEXT,
      closed_by  TEXT
    );

    CREATE TABLE IF NOT EXISTS user_ticket_counts (
      user_id TEXT    PRIMARY KEY,
      count   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id          INTEGER NOT NULL,
      author_id          TEXT    NOT NULL,
      dm_message_id      TEXT,
      channel_message_id TEXT,
      content            TEXT,
      attachments        TEXT,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    );

    CREATE TABLE IF NOT EXISTS snippets (
      name       TEXT PRIMARY KEY,
      content    TEXT NOT NULL,
      anonymous  INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id  INTEGER NOT NULL,
      user_id    TEXT    NOT NULL,
      file_path  TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      command_name TEXT    NOT NULL,
      target_type  TEXT    NOT NULL,
      target_id    TEXT    NOT NULL,
      allowed      INTEGER NOT NULL DEFAULT 1,
      UNIQUE(command_name, target_type, target_id)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      ticket_id UNINDEXED,
      content='messages',
      content_rowid='id'
    );

    -- Triggers to keep FTS index synced with messages table
    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, content, ticket_id) VALUES (new.id, new.content, new.ticket_id);
    END;
    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content, ticket_id) VALUES('delete', old.id, old.content, old.ticket_id);
    END;
    CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content, ticket_id) VALUES('delete', old.id, old.content, old.ticket_id);
      INSERT INTO messages_fts(rowid, content, ticket_id) VALUES (new.id, new.content, new.ticket_id);
    END;

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_tickets_user_id    ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_channel_id ON tickets(channel_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status     ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_messages_ticket_id  ON messages(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_messages_dm_id      ON messages(dm_message_id);
    CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_message_id);
  `);

  // Seed default config values
  const insertDefault = db.prepare(
    'INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)'
  );

  const defaults = {
    embed_color: '5865F2',
    activity_status: 'DM me for help',
    reaction_emoji: '📬',
  };

  for (const [key, value] of Object.entries(defaults)) {
    insertDefault.run(key, value);
  }

  console.log('[Database] Schema initialized.');

  // Migration for new transcript_url and claimed_by columns
  try {
    db.exec('ALTER TABLE tickets ADD COLUMN transcript_url TEXT;');
  } catch (err) {}
  
  try {
    db.exec('ALTER TABLE tickets ADD COLUMN claimed_by TEXT;');
  } catch (err) {}
}

module.exports = { initialize };
