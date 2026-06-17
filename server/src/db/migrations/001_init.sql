-- CODEX relational schema. The former single world JSON blob is normalized into tables.
-- All timestamps are unix epoch milliseconds. IDs are app-generated text (uuid-like).

PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',   -- 'admin' | 'user'
  settings      TEXT NOT NULL DEFAULT '{}',      -- JSON: app/user preferences (Settings modal)
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                    -- sha256 of the opaque cookie token
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE worlds (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  tagline    TEXT NOT NULL DEFAULT '',
  calendar   TEXT NOT NULL DEFAULT '{}',          -- small JSON: epoch, months[], daysPerMonth
  notes      TEXT NOT NULL DEFAULT '',            -- freeform lore document
  theme      TEXT NOT NULL DEFAULT 'dark',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_worlds_user ON worlds(user_id);

CREATE TABLE entities (
  id           TEXT PRIMARY KEY,
  world_id     TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,                      -- char|place|faction|item|event|creature|culture|language|concept|spell
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  canon        TEXT NOT NULL DEFAULT 'canon',      -- canon|draft|speculative
  birth        INTEGER,                            -- year (nullable)
  death        INTEGER,
  occurs       INTEGER,                            -- event "when" year (nullable)
  mana         INTEGER,                            -- spell-only
  created_year INTEGER,                            -- spell-only
  map_x        REAL,                               -- map pin % (nullable)
  map_y        REAL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_entities_world ON entities(world_id);
CREATE INDEX idx_entities_world_type ON entities(world_id, type);
CREATE INDEX idx_entities_world_name ON entities(world_id, name);

-- Full-text search over name + description, kept in sync via triggers.
CREATE VIRTUAL TABLE entities_fts USING fts5(
  name, description, content='entities', content_rowid='rowid'
);
CREATE TRIGGER entities_ai AFTER INSERT ON entities BEGIN
  INSERT INTO entities_fts(rowid, name, description) VALUES (new.rowid, new.name, new.description);
END;
CREATE TRIGGER entities_ad AFTER DELETE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, name, description) VALUES ('delete', old.rowid, old.name, old.description);
END;
CREATE TRIGGER entities_au AFTER UPDATE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, name, description) VALUES ('delete', old.rowid, old.name, old.description);
  INSERT INTO entities_fts(rowid, name, description) VALUES (new.rowid, new.name, new.description);
END;

CREATE TABLE entity_fields (
  id        TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  key       TEXT NOT NULL,
  value     TEXT NOT NULL DEFAULT '',
  sort      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_fields_entity ON entity_fields(entity_id);

CREATE TABLE entity_tags (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (entity_id, tag)
);

CREATE TABLE relationships (
  id        TEXT PRIMARY KEY,
  world_id  TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type      TEXT NOT NULL
);
CREATE INDEX idx_rels_world ON relationships(world_id);
CREATE INDEX idx_rels_source ON relationships(source_id);
CREATE INDEX idx_rels_target ON relationships(target_id);

CREATE TABLE lexicon (
  id        TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  word      TEXT NOT NULL DEFAULT '',
  gloss     TEXT NOT NULL DEFAULT '',
  sort      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_lexicon_entity ON lexicon(entity_id);

CREATE TABLE eras (
  id       TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name     TEXT NOT NULL DEFAULT '',
  start    INTEGER,
  end      INTEGER,
  color    TEXT NOT NULL DEFAULT '#6b8a9a',
  sort     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_eras_world ON eras(world_id);

CREATE TABLE economy (
  id          TEXT PRIMARY KEY,
  world_id    TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  rarity      TEXT NOT NULL DEFAULT '',
  value       TEXT NOT NULL DEFAULT '',
  danger      TEXT NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_economy_world ON economy(world_id);

CREATE TABLE journal (
  id         TEXT PRIMARY KEY,
  world_id   TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  campaign   TEXT NOT NULL DEFAULT '',
  date       TEXT NOT NULL DEFAULT '',
  year       INTEGER,
  body       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_journal_world ON journal(world_id);

-- Images stored as files on disk; this table holds references + metadata.
CREATE TABLE assets (
  id         TEXT PRIMARY KEY,
  world_id   TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  entity_id  TEXT REFERENCES entities(id) ON DELETE CASCADE,  -- nullable: world-level (e.g. map)
  kind       TEXT NOT NULL DEFAULT 'image',                   -- 'image' | 'map'
  file_path  TEXT NOT NULL,                                   -- relative path under assetsDir
  thumb_path TEXT,
  mime       TEXT NOT NULL DEFAULT 'image/webp',
  size       INTEGER NOT NULL DEFAULT 0,
  width      INTEGER,
  height     INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_assets_world ON assets(world_id);
CREATE INDEX idx_assets_entity ON assets(entity_id);

-- Branches are read-only alternate snapshots; kept pragmatically as a serialized JSON copy.
CREATE TABLE branches (
  id         TEXT PRIMARY KEY,
  world_id   TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  data       TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_branches_world ON branches(world_id);
