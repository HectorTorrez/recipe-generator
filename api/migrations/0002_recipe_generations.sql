CREATE TABLE recipe_generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT,
  created_at INTEGER NOT NULL,
  request_json TEXT NOT NULL,
  recipes_json TEXT NOT NULL
);

CREATE INDEX idx_recipe_generations_user ON recipe_generations(user_id, created_at DESC);
CREATE UNIQUE INDEX idx_recipe_generations_source ON recipe_generations(user_id, source_id);
