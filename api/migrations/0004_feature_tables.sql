CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  preferences_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE recipe_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  recipe_json TEXT NOT NULL,
  request_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_favorites_user ON recipe_favorites(user_id, created_at DESC);

CREATE TABLE shared_generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entry_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
