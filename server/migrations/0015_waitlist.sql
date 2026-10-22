-- Waiting list before launch (/waitinglist): one row per email; signing up again updates the name and business type.
CREATE TABLE waitlist (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ms',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
