-- AEGIS shared state.
--
-- Two tables, because the app stores two shapes: collections it rewrites as a
-- whole, and an append-only log it only ever adds to.
--
-- Run once against a new database:  npm run db:setup

CREATE TABLE IF NOT EXISTS aegis_collection (
  name    text PRIMARY KEY,
  items   jsonb  NOT NULL DEFAULT '[]'::jsonb,
  -- Bumped on every write. A conditional update that names the version it
  -- read cannot overwrite a change it never saw.
  version bigint NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS aegis_event (
  -- A sequence, so ids stay monotonic under any concurrency without the
  -- application counting anything.
  id      bigserial PRIMARY KEY,
  type    text        NOT NULL,
  payload jsonb       NOT NULL,
  at      timestamptz NOT NULL DEFAULT now()
);

-- Clients resume the live stream with "everything after id N", which is the
-- only way this table is ever read.
CREATE INDEX IF NOT EXISTS aegis_event_id_idx ON aegis_event (id);
