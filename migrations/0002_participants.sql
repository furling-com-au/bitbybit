-- Migration 0002: participants — the private-link mechanic.
-- Kris Kringle: rows created at draw time (name pre-filled, assignment
-- in data); a participant claims their name to receive their token.
-- Role dealer: rows created blank (role in data); joining claims a
-- random unclaimed row atomically.

CREATE TABLE participants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,    -- /p/:token — the participant's private URL
  name        TEXT NOT NULL DEFAULT '',
  data        TEXT NOT NULL DEFAULT '{}',
  claimed_at  TEXT,                    -- set when a person takes this row
  viewed_at   TEXT,                    -- set on first open of the private page
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_participants_instance ON participants (instance_id);

-- Names must be unique within an instance once set; blank rows
-- (unclaimed role slots) are exempt.
CREATE UNIQUE INDEX idx_participants_instance_name
  ON participants (instance_id, name) WHERE name <> '';
