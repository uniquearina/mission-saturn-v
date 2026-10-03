-- Портреты «ребёнок-космонавт»: журнал запросов (для лимитов) и готовые картинки для вошедших.
CREATE TABLE IF NOT EXISTS portrait_log (
  key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_portrait_log ON portrait_log(key, created_at);
CREATE TABLE IF NOT EXISTS portraits (
  kid_id INTEGER NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  scene TEXT NOT NULL,          -- source (исходное фото), avatar, ch1
  data TEXT NOT NULL,           -- data:image/jpeg;base64,...
  created_at INTEGER NOT NULL,
  PRIMARY KEY (kid_id, scene)
);
