BEGIN;

CREATE TABLE IF NOT EXISTS advisor_chat_messages (
  id SERIAL PRIMARY KEY,
  advisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('advisor', 'client')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS advisor_tasks (
  id SERIAL PRIMARY KEY,
  advisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  user_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  title VARCHAR(240) NOT NULL,
  due_at TIMESTAMPTZ,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'advisor_chat_messages'
      AND column_name = 'created_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE advisor_chat_messages
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN read_at TYPE TIMESTAMPTZ USING read_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'advisor_tasks'
      AND column_name = 'due_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE advisor_tasks
      ALTER COLUMN due_at TYPE TIMESTAMPTZ USING due_at AT TIME ZONE 'America/Guatemala',
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS advisor_chat_conversation_idx
ON advisor_chat_messages(advisor_id, user_id, created_at, id);

CREATE INDEX IF NOT EXISTS advisor_chat_cursor_idx
ON advisor_chat_messages(advisor_id, user_id, id);

CREATE INDEX IF NOT EXISTS advisor_chat_unread_idx
ON advisor_chat_messages(advisor_id, user_id, sender_role, id)
WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS advisor_tasks_owner_idx
ON advisor_tasks(advisor_id, status, due_at, id);

COMMIT;
