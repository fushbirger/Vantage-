-- Vantage database schema (SQLite dialect)
-- Non-custodial: Vantage never stores or moves funds. These tables are a ledger.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  phone         TEXT,
  avatar_color  TEXT NOT NULL DEFAULT '#0f6b5d',
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_profiles (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  preferred_rail TEXT NOT NULL DEFAULT 'tarus'
                 CHECK (preferred_rail IN ('tarus', 'tarusqr', 'pocket')),
  tarus_proxy    TEXT,
  tarus_qr_data  TEXT,
  pocket_link    TEXT,
  whatsapp_opt_in INTEGER NOT NULL DEFAULT 1,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "groups" (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '✈️',
  kind        TEXT NOT NULL DEFAULT 'trip'
              CHECK (kind IN ('trip', 'dinner', 'gift', 'home', 'other')),
  description TEXT,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  -- 1 = every expense needs a yes from each other person it touches.
  require_confirmation INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS group_members (
  id        TEXT PRIMARY KEY,
  group_id  TEXT NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at INTEGER NOT NULL,
  -- 'invited' people have not accepted: no ledger access, cannot be in expenses.
  status    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active')),
  invited_by TEXT REFERENCES users(id),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id               TEXT PRIMARY KEY,
  group_id         TEXT NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
  paid_by          TEXT NOT NULL REFERENCES users(id),
  title            TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'general',
  amount_cents     INTEGER NOT NULL CHECK (amount_cents > 0),      -- original currency minor units
  currency         TEXT NOT NULL DEFAULT 'BND',
  fx_rate_to_bnd   REAL NOT NULL DEFAULT 1,                         -- 1 unit of currency = N BND
  amount_bnd_cents INTEGER NOT NULL CHECK (amount_bnd_cents > 0),   -- canonical ledger amount
  split_rule       TEXT NOT NULL DEFAULT 'equal'
                   CHECK (split_rule IN ('equal', 'exact', 'percent', 'shares')),
  receipt_data     TEXT,                                            -- compressed data URL, or null
  items_json       TEXT,                                            -- itemisation [{name, amountCents}]
  notes            TEXT,
  spent_at         INTEGER NOT NULL,
  created_at       INTEGER NOT NULL,
  created_by       TEXT REFERENCES users(id),                       -- who entered it (may differ from payer)
  status           TEXT NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('pending', 'confirmed', 'rejected')),
  resolved_at      INTEGER
);

-- One row per person who must say yes before an expense reaches the ledger.
CREATE TABLE IF NOT EXISTS expense_confirmations (
  id           TEXT PRIMARY KEY,
  expense_id   TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'confirmed', 'rejected')),
  responded_at INTEGER,
  UNIQUE (expense_id, user_id)
);

-- Account connections: a mutual, accepted link between two people.
-- Only connected people can be invited into the same group.
CREATE TABLE IF NOT EXISTS connections (
  id           TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at   INTEGER NOT NULL,
  responded_at INTEGER,
  CHECK (requester_id <> addressee_id)
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id               TEXT PRIMARY KEY,
  expense_id       TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id),
  amount_bnd_cents INTEGER NOT NULL CHECK (amount_bnd_cents >= 0),
  share_units      REAL,
  percent          REAL,
  UNIQUE (expense_id, user_id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
  from_user   TEXT NOT NULL REFERENCES users(id),
  to_user     TEXT NOT NULL REFERENCES users(id),
  amount_bnd_cents INTEGER NOT NULL CHECK (amount_bnd_cents > 0),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'completed', 'rejected')),
  rail        TEXT NOT NULL DEFAULT 'tarus'
              CHECK (rail IN ('tarus', 'tarusqr', 'pocket', 'cash', 'other')),
  proof_data  TEXT,                                                -- optional payment screenshot
  note        TEXT,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS pools (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  note        TEXT,
  goal_bnd_cents INTEGER NOT NULL CHECK (goal_bnd_cents > 0),
  deadline    INTEGER,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pool_pledges (
  id          TEXT PRIMARY KEY,
  pool_id     TEXT NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  amount_bnd_cents INTEGER NOT NULL CHECK (amount_bnd_cents > 0),
  status      TEXT NOT NULL DEFAULT 'pledged'
              CHECK (status IN ('pledged', 'received')),
  note        TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id          TEXT PRIMARY KEY,
  group_id    TEXT REFERENCES "groups"(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  phone       TEXT,
  template    TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued'
              CHECK (status IN ('queued', 'simulated', 'sent', 'failed')),
  error       TEXT,
  created_at  INTEGER NOT NULL,
  sent_at     INTEGER
);

CREATE TABLE IF NOT EXISTS whatsapp_events (
  id          TEXT PRIMARY KEY,
  direction   TEXT NOT NULL CHECK (direction IN ('inbound', 'status')),
  payload     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id, spent_at DESC);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pools_group ON pools(group_id);
CREATE INDEX IF NOT EXISTS idx_pledges_pool ON pool_pledges(pool_id);
CREATE INDEX IF NOT EXISTS idx_outbox_user ON whatsapp_outbox(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_confirmations_expense ON expense_confirmations(expense_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_user ON expense_confirmations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_connections_requester ON connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_connections_addressee ON connections(addressee_id);
