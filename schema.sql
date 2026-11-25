-- Beatrix: Paul's assistant, monitored by Katherine (his PA).
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,                 -- paul | assistant | katherine
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',  -- sent | held (waiting on Katherine) | discarded
  private INTEGER NOT NULL DEFAULT 0,   -- 1 = Katherine's own note, never shown to Paul
  edited INTEGER NOT NULL DEFAULT 0,    -- 1 = Katherine changed the assistant's draft
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',  -- open | doing | done | dropped
  due TEXT,                             -- YYYY-MM-DD or NULL
  note TEXT NOT NULL DEFAULT '',        -- Katherine's result note, shown to Paul
  created_by TEXT NOT NULL,             -- paul | assistant | katherine
  source_msg INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- rev (bumped on every write, lets clients skip unchanged polls), mode, kat_seen
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Sign-in without codes: each phone or browser makes its own random token and asks for a seat.
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,                     -- SHA-256 of the device's token (the token itself is never stored)
  role TEXT NOT NULL,                      -- paul | katherine
  status TEXT NOT NULL DEFAULT 'pending',  -- pending (waiting for Vincent) | active | revoked
  label TEXT NOT NULL DEFAULT '',          -- "iPhone", "Android app", ...
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  last_seen TEXT
);
-- settings.enroll_until: while this time is in the future, the first device to ask for a free seat gets it at once.
