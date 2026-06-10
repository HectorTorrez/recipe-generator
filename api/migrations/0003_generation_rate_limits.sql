CREATE TABLE generation_rate_limits (
  bucket_key TEXT NOT NULL,
  window_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_key)
);
