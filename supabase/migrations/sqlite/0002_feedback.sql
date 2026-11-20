CREATE TABLE app_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('Opinião', 'Sugestão', 'Problema')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX app_feedback_user ON app_feedback(user_id, created_at);
PRAGMA user_version=2;
