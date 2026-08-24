-- Migration 0001: the multi-tool foundation.
-- One `instances` table serves every tool (tool_type discriminates).
-- `claims` is here from day one so the gift registry port needs no
-- schema change: the UNIQUE constraint is what makes slot-claiming
-- atomic — a second claimant gets a constraint violation, not a race.

CREATE TABLE instances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT UNIQUE NOT NULL,   -- public URL:    /s/:slug
  edit_token  TEXT UNIQUE NOT NULL,   -- organiser URL: /e/:token (the only credential)
  tool_type   TEXT NOT NULL,          -- 'sweep' | 'registry' | 'kringle' | ...
  title       TEXT NOT NULL DEFAULT '',
  data        TEXT NOT NULL,          -- tool-specific JSON
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX idx_instances_tool ON instances (tool_type);

CREATE TABLE claims (
  instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  slot_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  message     TEXT NOT NULL DEFAULT '',
  cents       INTEGER NOT NULL DEFAULT 0,
  ref         TEXT NOT NULL DEFAULT '',
  paid        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (instance_id, slot_id)
);

-- Minimal health metrics: created / redrawn / deleted per tool.
-- Deliberately no per-view logging (noise, and it burns D1 writes).
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id INTEGER,
  tool_type   TEXT NOT NULL,
  kind        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
