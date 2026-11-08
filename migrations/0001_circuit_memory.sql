-- CIRCUIT Persistent Memory v1 — Cloudflare D1 schema
CREATE TABLE IF NOT EXISTS circuit_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 1200),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_circuit_memories_user_updated
  ON circuit_memories (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS memory_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memory_login_attempts_ip_time
  ON memory_login_attempts (ip_hash, attempted_at);
