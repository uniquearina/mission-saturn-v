-- Доверенные почты: вход в игру — только им (и владельцу из OWNER_EMAIL). Список ведёт владелец.
CREATE TABLE IF NOT EXISTS family (
  email TEXT PRIMARY KEY,
  added_at INTEGER NOT NULL
);
